import { Prisma } from '@prisma/client';

export interface RecordAuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  ip?: string | null;
}

export type DbTransactionClient = Prisma.TransactionClient | {
  auditLog: {
    create: (args: { data: any }) => Promise<any>;
  };
};

/**
 * Writes an AuditLog entry within the supplied database transaction.
 */
export const recordAudit = async (
  tx: DbTransactionClient,
  params: RecordAuditParams
): Promise<any> => {
  return tx.auditLog.create({
    data: {
      actorId: params.actorId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before !== undefined ? params.before : undefined,
      after: params.after !== undefined ? params.after : undefined,
      ip: params.ip || null,
    },
  });
};

