import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { resetMockDb, mockDb, mockAttempts } from './setup';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../src/config/env';
import { defaultScoringStrategy } from '../src/modules/scoring/scoring.service';
import { sanitizeText } from '../src/utils/sanitize';

describe('Phase 3: Assessment Attempts, Timer, Auto-Save & Scoring', () => {
  let userToken: string;
  let userBToken: string;
  let userA: any;
  let userB: any;
  let product: any;
  let assessment: any;
  let q1: any;
  let q2: any;
  let q3Text: any;
  let opt1A: string;
  let opt1B: string;
  let opt2A: string;
  let opt2B: string;
  let opt2C: string;

  beforeEach(async () => {
    resetMockDb();

    opt1A = crypto.randomUUID();
    opt1B = crypto.randomUUID();
    opt2A = crypto.randomUUID();
    opt2B = crypto.randomUUID();
    opt2C = crypto.randomUUID();

    // Create User A
    userA = await mockDb.user.create({
      data: {
        name: 'User A',
        email: 'user_a@example.com',
        role: 'USER',
        passwordHash: 'dummy',
      },
    });

    userToken = jwt.sign(
      { sub: userA.id, email: userA.email, role: 'USER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Create User B
    userB = await mockDb.user.create({
      data: {
        name: 'User B',
        email: 'user_b@example.com',
        role: 'USER',
        passwordHash: 'dummy',
      },
    });

    userBToken = jwt.sign(
      { sub: userB.id, email: userB.email, role: 'USER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Create Assessment with timer (30 minutes = 1800 seconds)
    assessment = await mockDb.assessment.create({
      data: {
        slug: 'leadership-eval',
        title: { en: 'Leadership Eval', hi: 'नेतृत्व मूल्यांकन' },
        description: { en: 'Evaluation desc' },
        kind: 'MIXED',
        timeLimitSeconds: 1800,
        version: 1,
        isActive: true,
      },
    });

    // Create Question 1: SINGLE_CHOICE (Required)
    q1 = await mockDb.question.create({
      data: {
        assessmentId: assessment.id,
        order: 1,
        type: 'SINGLE_CHOICE',
        text: { en: 'How do you delegate tasks?', hi: 'आप कार्य कैसे सौंपते हैं?' },
        isRequired: true,
        dimension: 'Delegation',
        isActive: true,
      },
    });

    await mockDb.option.create({
      data: { id: opt1A, questionId: q1.id, order: 1, label: { en: 'Directly with outcomes' }, score: 5, isActive: true },
    });
    await mockDb.option.create({
      data: { id: opt1B, questionId: q1.id, order: 2, label: { en: 'Micromanage' }, score: 1, isActive: true },
    });

    // Create Question 2: MULTI_CHOICE (Required)
    q2 = await mockDb.question.create({
      data: {
        assessmentId: assessment.id,
        order: 2,
        type: 'MULTI_CHOICE',
        text: { en: 'Select core leadership traits:', hi: 'नेतृत्व लक्षण चुनें:' },
        isRequired: true,
        dimension: 'Strategy',
        isActive: true,
      },
    });

    await mockDb.option.create({
      data: { id: opt2A, questionId: q2.id, order: 1, label: { en: 'Empathy' }, score: 4, isActive: true },
    });
    await mockDb.option.create({
      data: { id: opt2B, questionId: q2.id, order: 2, label: { en: 'Long-term Vision' }, score: 4, isActive: true },
    });
    await mockDb.option.create({
      data: { id: opt2C, questionId: q2.id, order: 3, label: { en: 'Rigidity' }, score: 0, isActive: true },
    });

    // Create Question 3: TEXT (Required)
    q3Text = await mockDb.question.create({
      data: {
        assessmentId: assessment.id,
        order: 3,
        type: 'TEXT',
        text: { en: 'Describe a conflict resolution scenario:', hi: 'विवाद समाधान परिदृश्य का वर्णन करें:' },
        isRequired: true,
        maxLength: 500,
        isActive: true,
      },
    });

    // Create Product
    product = await mockDb.product.create({
      data: {
        slug: 'leadership-pack',
        name: { en: 'Leadership Pack' },
        description: { en: 'Full pack' },
        assessmentId: assessment.id,
        priceInPaise: 49900,
        currency: 'INR',
        isActive: true,
      },
    });
  });

  describe('Pure Scoring Unit Tests', () => {
    it('should calculate dimension sums, total score, and percentage accurately', () => {
      const questions = [
        {
          id: 'q1',
          type: 'SINGLE_CHOICE',
          dimension: 'Leadership',
          options: [
            { id: 'o1', score: 5 },
            { id: 'o2', score: 2 },
          ],
        },
        {
          id: 'q2',
          type: 'MULTI_CHOICE',
          dimension: 'Strategy',
          options: [
            { id: 'o3', score: 4 },
            { id: 'o4', score: 4 },
          ],
        },
        {
          id: 'q3',
          type: 'TEXT',
          dimension: 'Open',
        },
      ];

      const responses = [
        { questionId: 'q1', selectedOptionIds: ['o1'] }, // 5 points
        { questionId: 'q2', selectedOptionIds: ['o3', 'o4'] }, // 8 points
        { questionId: 'q3', selectedOptionIds: [], textAnswer: 'AI evaluation text' },
      ];

      const result = defaultScoringStrategy(questions as any, responses);

      expect(result.totalScore).toBe(13);
      expect(result.maxTotalScore).toBe(13);
      expect(result.percentage).toBe(100);
      expect(result.dimensions['Leadership'].score).toBe(5);
      expect(result.dimensions['Strategy'].score).toBe(8);
      expect(result.textAnswers.length).toBe(1);
      expect(result.textAnswers[0].text).toBe('AI evaluation text');
    });
  });

  describe('Shared Text Sanitization', () => {
    it('should strip control characters, normalize whitespace, and enforce max length', () => {
      const raw = '  Hello\x00\x1F World!   \n\n\n\nHow are you?   ';
      const sanitized = sanitizeText(raw, 25);

      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1F');
      expect(sanitized.length).toBeLessThanOrEqual(25);
      expect(sanitized.startsWith('Hello World!')).toBe(true);
    });
  });

  describe('POST /api/v1/attempts (Start & Resume)', () => {
    it('should start a new attempt with server expiresAt and question snapshot', async () => {
      const response = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const attempt = response.body.data.attempt;
      expect(attempt.status).toBe('IN_PROGRESS');
      expect(attempt.userId).toBe(userA.id);
      expect(attempt.expiresAt).toBeDefined();
      expect(attempt.snapshot.questions.length).toBe(3);
    });

    it('should resume an existing IN_PROGRESS attempt instead of creating a duplicate', async () => {
      // First start
      const firstRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = firstRes.body.data.attempt.id;

      // Second start call for same product
      const secondRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      expect(secondRes.status).toBe(201);
      expect(secondRes.body.data.attempt.id).toBe(attemptId);
    });
  });

  describe('GET /api/v1/attempts/:id (Client View & Score Leakage Prevention)', () => {
    it('should NEVER leak question dimensions or option scores to client in attempt view', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      const getRes = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Cookie', [`accessToken=${userToken}`]);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);

      const attempt = getRes.body.data.attempt;
      expect(attempt.remainingTimeSeconds).toBeGreaterThan(0);
      expect(attempt.scoreSummary).toBeUndefined();

      for (const q of attempt.questions) {
        expect(q.dimension).toBeUndefined();
        for (const opt of q.options) {
          expect(opt.score).toBeUndefined();
        }
      }
    });

    it('should return 404 (not 403) when user attempts to access another user attempt', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      // User B tries to view User A's attempt
      const getRes = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Cookie', [`accessToken=${userBToken}`]);

      expect(getRes.status).toBe(404);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.error.code).toBe('ATTEMPT_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/attempts/:id/answers (Auto-save & Upsert)', () => {
    it('should upsert answers and validate option constraints', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      // 1. Save valid answers
      const saveRes = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          answers: [
            { questionId: q1.id, selectedOptionIds: [opt1A] },
            { questionId: q2.id, selectedOptionIds: [opt2A, opt2B] },
            { questionId: q3Text.id, textAnswer: 'My resolution strategy...' },
          ],
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.data.savedCount).toBe(3);

      // 2. Upsert update (modifying choice)
      const updateRes = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          answers: [{ questionId: q1.id, selectedOptionIds: [opt1B] }],
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.savedCount).toBe(1);
    });

    it('should reject SINGLE_CHOICE answer with multiple options', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      const badRes = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          answers: [{ questionId: q1.id, selectedOptionIds: [opt1A, opt1B] }],
        });

      expect(badRes.status).toBe(400);
      expect(badRes.body.error.code).toBe('INVALID_ANSWER');
    });
  });

  describe('Server-Side Timer & Expiry Enforcement', () => {
    it('should mark attempt EXPIRED and reject saves when timer runs out', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      // Manually simulate timer expiry in mock DB
      const attempt = mockAttempts.get(attemptId);
      attempt.expiresAt = new Date(Date.now() - 5000); // 5 seconds in the past

      const saveRes = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          answers: [{ questionId: q1.id, selectedOptionIds: [opt1A] }],
        });

      expect(saveRes.status).toBe(400);
      expect(saveRes.body.error.code).toBe('ATTEMPT_EXPIRED');

      // Attempt status in DB must be updated to EXPIRED
      expect(mockAttempts.get(attemptId).status).toBe('EXPIRED');
    });
  });

  describe('POST /api/v1/attempts/:id/submit (Completeness & Scoring)', () => {
    it('should reject submission if required questions are not answered', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      // Save only 1 of 3 required questions
      await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          answers: [{ questionId: q1.id, selectedOptionIds: [opt1A] }],
        });

      // Submit attempt
      const submitRes = await request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('Cookie', [`accessToken=${userToken}`]);

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.error.code).toBe('INCOMPLETE_ATTEMPT');
    });

    it('should successfully submit complete attempt, lock status, and store scoreSummary', async () => {
      const startRes = await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const attemptId = startRes.body.data.attempt.id;

      // Answer all 3 questions
      await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers`)
        .set('Cookie', [`accessToken=${userToken}`])
        .send({
          answers: [
            { questionId: q1.id, selectedOptionIds: [opt1A] }, // 5 points
            { questionId: q2.id, selectedOptionIds: [opt2A, opt2B] }, // 4+4=8 points
            { questionId: q3Text.id, textAnswer: 'Resolved conflict via open alignment.' },
          ],
        });

      const submitRes = await request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('Cookie', [`accessToken=${userToken}`]);

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);

      const data = submitRes.body.data;
      expect(data.status).toBe('SUBMITTED');
      expect(data.submittedAt).toBeDefined();
      expect(data.scoreSummary).toBeDefined();
      expect(data.scoreSummary.totalScore).toBe(13);
      expect(data.scoreSummary.percentage).toBe(100);
      expect(data.scoreSummary.dimensions['Delegation'].score).toBe(5);
      expect(data.scoreSummary.dimensions['Strategy'].score).toBe(8);
      expect(data.scoreSummary.textAnswers.length).toBe(1);
    });
  });

  describe('GET /api/v1/attempts (My Attempts List)', () => {
    it('should list user attempts with pagination', async () => {
      await request(app)
        .post('/api/v1/attempts')
        .set('Cookie', [`accessToken=${userToken}`])
        .send({ productId: product.id, language: 'EN' });

      const listRes = await request(app)
        .get('/api/v1/attempts?page=1&limit=10')
        .set('Cookie', [`accessToken=${userToken}`]);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.items.length).toBe(1);
      expect(listRes.body.data.items[0].productSlug).toBe(product.slug);
    });
  });
});
