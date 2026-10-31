import { db } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { AuthUser } from '../../types/express';
import { Role } from '@prisma/client';
import { recordAudit } from '../audit/audit.service';
import crypto from 'crypto';

export class UsersService {
  async getAllUsers() {
    return db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(targetUserId: string, requestingUser: AuthUser) {
    // Ownership check: regular users can only access their own user data
    if (requestingUser.role !== Role.ADMIN && requestingUser.id !== targetUserId) {
      throw ApiError.forbidden('You can only access your own user data', 'FORBIDDEN');
    }

    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return user;
  }

  /**
   * DPDP Data Portability Export
   * Exports full personal data profile, assessment attempts, and orders in machine-readable JSON.
   */
  async exportUserData(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        preferredLanguage: true,
        consentAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
        attempts: {
          select: {
            id: true,
            productId: true,
            language: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            scoreSummary: true,
            responses: {
              select: {
                questionId: true,
                selectedOptionIds: true,
                textAnswer: true,
                answeredAt: true,
              },
            },
          },
        },
        orders: {
          select: {
            id: true,
            productId: true,
            amountInPaise: true,
            currency: true,
            status: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return {
      exportedAt: new Date().toISOString(),
      dpdpNotice:
        'This portable export contains all candidate personal data and assessment records held by the platform.',
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage,
        consentAcceptedAt: user.consentAcceptedAt,
        accountCreated: user.createdAt,
      },
      assessmentAttempts: user.attempts,
      financialOrders: user.orders,
    };
  }

  /**
   * DPDP Right to Erasure / Anonymization
   * Anonymizes PII, revokes all sessions, and deactivates the account.
   * Retains financial transaction and order linkage with anonymized identity to meet tax & accounting obligations.
   */
  async anonymizeUser(userId: string, requestingUser: AuthUser, reason?: string) {
    if (requestingUser.role !== Role.ADMIN && requestingUser.id !== userId) {
      throw ApiError.forbidden('You can only request anonymization of your own account', 'FORBIDDEN');
    }

    const existingUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    if (!existingUser.isActive && existingUser.name === 'Anonymized User') {
      throw ApiError.conflict('User account is already anonymized', 'USER_ALREADY_ANONYMIZED');
    }

    return db.$transaction(async (tx: any) => {
      const anonymizedEmail = `deleted-${userId.slice(0, 8)}-${crypto.randomBytes(4).toString('hex')}@anonymized.local`;
      const scrambledHash = `$argon2id$v=19$m=65536,t=3,p=4$${crypto.randomBytes(32).toString('base64')}`;

      // Revoke all active refresh token sessions
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Anonymize user record
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Anonymized User',
          email: anonymizedEmail,
          passwordHash: scrambledHash,
          isActive: false,
        },
      });

      // Audit log entry for erasure compliance
      await recordAudit(tx, {
        actorId: requestingUser.id,
        entityType: 'User',
        entityId: userId,
        action: 'ANONYMIZE_ACCOUNT',
        before: { email: existingUser.email, name: existingUser.name, isActive: existingUser.isActive },
        after: { email: anonymizedEmail, name: 'Anonymized User', isActive: false, reason: reason || 'DPDP request' },
      });

      return {
        success: true,
        message: 'Account personal data successfully erased and anonymized.',
        userId,
      };
    });
  }
}

export const usersService = new UsersService();

