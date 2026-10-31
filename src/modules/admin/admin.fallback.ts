import { OrderStatus, AttemptStatus, ReportStatus, Role, Language } from '@prisma/client';

// ==================== USERS STORE ====================
export interface MockAdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  preferredLanguage: Language;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    orders: number;
    attempts: number;
  };
  orders?: any[];
  attempts?: any[];
}

export const mockUsersStore: MockAdminUser[] = [
  {
    id: 'admin-user-id',
    name: 'Administrator',
    email: 'admin@example.com',
    role: Role.ADMIN,
    preferredLanguage: Language.EN,
    isActive: true,
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-10-31T08:00:00.000Z',
    _count: { orders: 0, attempts: 0 },
  },
  {
    id: 'demo-user-1',
    name: 'Demo Candidate',
    email: 'user1@test.com',
    role: Role.USER,
    preferredLanguage: Language.EN,
    isActive: true,
    createdAt: '2026-03-10T11:20:00.000Z',
    updatedAt: '2026-10-31T08:15:00.000Z',
    _count: { orders: 2, attempts: 2 },
  },
  {
    id: 'user-priya-sharma',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: Role.USER,
    preferredLanguage: Language.EN,
    isActive: true,
    createdAt: '2026-04-12T14:32:00.000Z',
    updatedAt: '2026-10-30T16:45:00.000Z',
    _count: { orders: 2, attempts: 2 },
  },
  {
    id: 'user-rahul-verma',
    name: 'Rahul Verma',
    email: 'rahul.v@example.com',
    role: Role.USER,
    preferredLanguage: Language.HI,
    isActive: true,
    createdAt: '2026-05-18T10:15:00.000Z',
    updatedAt: '2026-10-29T11:20:00.000Z',
    _count: { orders: 1, attempts: 1 },
  },
  {
    id: 'user-ananya-patel',
    name: 'Ananya Patel',
    email: 'ananya.p@example.com',
    role: Role.USER,
    preferredLanguage: Language.EN,
    isActive: true,
    createdAt: '2026-06-05T08:45:00.000Z',
    updatedAt: '2026-10-28T14:10:00.000Z',
    _count: { orders: 3, attempts: 3 },
  },
  {
    id: 'user-vikram-malhotra',
    name: 'Vikram Malhotra',
    email: 'vikram.m@example.com',
    role: Role.USER,
    preferredLanguage: Language.EN,
    isActive: true,
    createdAt: '2026-07-22T16:20:00.000Z',
    updatedAt: '2026-10-27T09:30:00.000Z',
    _count: { orders: 1, attempts: 1 },
  },
  {
    id: 'user-sneha-kulkarni',
    name: 'Sneha Kulkarni',
    email: 'sneha.k@example.com',
    role: Role.USER,
    preferredLanguage: Language.EN,
    isActive: true,
    createdAt: '2026-08-14T12:10:00.000Z',
    updatedAt: '2026-10-25T15:40:00.000Z',
    _count: { orders: 2, attempts: 2 },
  },
  {
    id: 'user-arjun-nair',
    name: 'Arjun Nair',
    email: 'arjun.n@example.com',
    role: Role.USER,
    preferredLanguage: Language.HI,
    isActive: true,
    createdAt: '2026-09-02T13:55:00.000Z',
    updatedAt: '2026-10-24T18:05:00.000Z',
    _count: { orders: 1, attempts: 1 },
  },
  {
    id: 'user-pooja-reddy',
    name: 'Pooja Reddy',
    email: 'pooja.reddy@example.com',
    role: Role.USER,
    preferredLanguage: Language.EN,
    isActive: false,
    createdAt: '2026-09-19T09:15:00.000Z',
    updatedAt: '2026-10-20T10:12:00.000Z',
    _count: { orders: 1, attempts: 1 },
  },
];

// ==================== ORDERS STORE ====================
export interface MockAdminOrder {
  id: string;
  userId: string;
  productId: string;
  attemptId: string;
  amountInPaise: number;
  currency: string;
  status: OrderStatus;
  razorpayOrderId: string | null;
  createdAt: string;
  paidAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  product: {
    id: string;
    name: { en: string; hi: string };
    slug: string;
    priceInPaise: number;
  };
  report?: {
    id: string;
    status: ReportStatus;
  } | null;
  payments?: any[];
}

export const mockOrdersStore: MockAdminOrder[] = [
  {
    id: 'ord_101',
    userId: 'user-priya-sharma',
    productId: '1',
    attemptId: 'att_101',
    amountInPaise: 49900,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: 'order_SG_9918231',
    createdAt: '2026-10-30T10:15:00.000Z',
    paidAt: '2026-10-30T10:16:30.000Z',
    user: { id: 'user-priya-sharma', name: 'Priya Sharma', email: 'priya.sharma@example.com' },
    product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' }, priceInPaise: 49900 },
    report: { id: 'rep_101', status: ReportStatus.RELEASED },
  },
  {
    id: 'ord_102',
    userId: 'user-rahul-verma',
    productId: '2',
    attemptId: 'att_102',
    amountInPaise: 79900,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: 'order_SG_8829104',
    createdAt: '2026-10-29T14:20:00.000Z',
    paidAt: '2026-10-29T14:22:15.000Z',
    user: { id: 'user-rahul-verma', name: 'Rahul Verma', email: 'rahul.v@example.com' },
    product: { id: '2', slug: 'career-aptitude', name: { en: 'Career & Cognitive Aptitude', hi: 'कैरियर और संज्ञानात्मक योग्यता' }, priceInPaise: 79900 },
    report: { id: 'rep_102', status: ReportStatus.GENERATED },
  },
  {
    id: 'ord_103',
    userId: 'user-ananya-patel',
    productId: '5',
    attemptId: 'att_103',
    amountInPaise: 99900,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: 'order_SG_7736192',
    createdAt: '2026-10-28T09:40:00.000Z',
    paidAt: '2026-10-28T09:42:00.000Z',
    user: { id: 'user-ananya-patel', name: 'Ananya Patel', email: 'ananya.p@example.com' },
    product: { id: '5', slug: 'pro-leadership-suite', name: { en: 'Pro Leadership Assessment Suite', hi: 'प्रो नेतृत्व मूल्यांकन सुइट' }, priceInPaise: 99900 },
    report: { id: 'rep_103', status: ReportStatus.PENDING_REVIEW },
  },
  {
    id: 'ord_104',
    userId: 'user-vikram-malhotra',
    productId: '3',
    attemptId: 'att_104',
    amountInPaise: 59900,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: 'order_SG_6645210',
    createdAt: '2026-10-27T16:10:00.000Z',
    paidAt: '2026-10-27T16:12:45.000Z',
    user: { id: 'user-vikram-malhotra', name: 'Vikram Malhotra', email: 'vikram.m@example.com' },
    product: { id: '3', slug: 'emotional-resilience', name: { en: 'Emotional Resilience & EQ', hi: 'भावनात्मक लचीलापन और ईक्यू' }, priceInPaise: 59900 },
    report: { id: 'rep_104', status: ReportStatus.RELEASED },
  },
  {
    id: 'ord_105',
    userId: 'user-sneha-kulkarni',
    productId: '6',
    attemptId: 'att_105',
    amountInPaise: 49900,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: 'order_SG_5532198',
    createdAt: '2026-10-26T11:05:00.000Z',
    paidAt: '2026-10-26T11:07:20.000Z',
    user: { id: 'user-sneha-kulkarni', name: 'Sneha Kulkarni', email: 'sneha.k@example.com' },
    product: { id: '6', slug: 'cognitive-aptitude-mastery', name: { en: 'Cognitive Aptitude Mastery', hi: 'संज्ञानात्मक योग्यता महारत' }, priceInPaise: 49900 },
    report: { id: 'rep_105', status: ReportStatus.RELEASED },
  },
  {
    id: 'ord_106',
    userId: 'user-arjun-nair',
    productId: '4',
    attemptId: 'att_106',
    amountInPaise: 0,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: null,
    createdAt: '2026-10-25T13:30:00.000Z',
    paidAt: '2026-10-25T13:30:00.000Z',
    user: { id: 'user-arjun-nair', name: 'Arjun Nair', email: 'arjun.n@example.com' },
    product: { id: '4', slug: 'free-leadership-sampler', name: { en: 'Free Leadership Sampler', hi: 'निःशुल्क नेतृत्व नमूना' }, priceInPaise: 0 },
    report: { id: 'rep_106', status: ReportStatus.RELEASED },
  },
  {
    id: 'ord_107',
    userId: 'user-pooja-reddy',
    productId: '1',
    attemptId: 'att_107',
    amountInPaise: 49900,
    currency: 'INR',
    status: OrderStatus.FAILED,
    razorpayOrderId: 'order_SG_4421093',
    createdAt: '2026-10-24T15:20:00.000Z',
    paidAt: null,
    user: { id: 'user-pooja-reddy', name: 'Pooja Reddy', email: 'pooja.reddy@example.com' },
    product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' }, priceInPaise: 49900 },
    report: null,
  },
  {
    id: 'ord_108',
    userId: 'demo-user-1',
    productId: '1',
    attemptId: 'att_108',
    amountInPaise: 49900,
    currency: 'INR',
    status: OrderStatus.PAID,
    razorpayOrderId: 'order_SG_3319082',
    createdAt: '2026-10-31T07:45:00.000Z',
    paidAt: '2026-10-31T07:46:10.000Z',
    user: { id: 'demo-user-1', name: 'Demo Candidate', email: 'user1@test.com' },
    product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' }, priceInPaise: 49900 },
    report: { id: 'rep_108', status: ReportStatus.RELEASED },
  },
];

// ==================== ATTEMPTS STORE ====================
export interface MockAdminAttempt {
  id: string;
  userId: string;
  productId: string;
  assessmentId: string;
  assessmentVersion: number;
  language: Language;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  scoreSummary: any;
  user: {
    id: string;
    name: string;
    email: string;
  };
  product: {
    id: string;
    name: { en: string; hi: string };
    slug: string;
  };
  assessment: {
    id: string;
    title: { en: string; hi: string };
  };
  responses?: any[];
}

export const mockAttemptsStore: MockAdminAttempt[] = [
  {
    id: 'att_101',
    userId: 'user-priya-sharma',
    productId: '1',
    assessmentId: 'a1',
    assessmentVersion: 1,
    language: Language.EN,
    status: AttemptStatus.SUBMITTED,
    startedAt: '2026-10-30T09:40:00.000Z',
    expiresAt: '2026-10-30T10:00:00.000Z',
    submittedAt: '2026-10-30T09:58:12.000Z',
    scoreSummary: { overallScore: 84, archetype: 'Strategic Navigator', percentile: 92 },
    user: { id: 'user-priya-sharma', name: 'Priya Sharma', email: 'priya.sharma@example.com' },
    product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' } },
    assessment: { id: 'a1', title: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' } },
  },
  {
    id: 'att_102',
    userId: 'user-rahul-verma',
    productId: '2',
    assessmentId: 'a2',
    assessmentVersion: 1,
    language: Language.HI,
    status: AttemptStatus.SUBMITTED,
    startedAt: '2026-10-29T13:50:00.000Z',
    expiresAt: '2026-10-29T14:15:00.000Z',
    submittedAt: '2026-10-29T14:10:45.000Z',
    scoreSummary: { overallScore: 78, archetype: 'Analytical Architect', percentile: 85 },
    user: { id: 'user-rahul-verma', name: 'Rahul Verma', email: 'rahul.v@example.com' },
    product: { id: '2', slug: 'career-aptitude', name: { en: 'Career & Cognitive Aptitude', hi: 'कैरियर और संज्ञानात्मक योग्यता' } },
    assessment: { id: 'a2', title: { en: 'Career & Cognitive Aptitude', hi: 'कैरियर और संज्ञानात्मक योग्यता' } },
  },
  {
    id: 'att_103',
    userId: 'user-ananya-patel',
    productId: '5',
    assessmentId: 'a5',
    assessmentVersion: 1,
    language: Language.EN,
    status: AttemptStatus.SUBMITTED,
    startedAt: '2026-10-28T09:00:00.000Z',
    expiresAt: '2026-10-28T09:30:00.000Z',
    submittedAt: '2026-10-28T09:27:10.000Z',
    scoreSummary: { overallScore: 91, archetype: 'Transformational Visionary', percentile: 98 },
    user: { id: 'user-ananya-patel', name: 'Ananya Patel', email: 'ananya.p@example.com' },
    product: { id: '5', slug: 'pro-leadership-suite', name: { en: 'Pro Leadership Assessment Suite', hi: 'प्रो नेतृत्व मूल्यांकन सुइट' } },
    assessment: { id: 'a5', title: { en: 'Pro Leadership Assessment Suite', hi: 'प्रो नेतृत्व मूल्यांकन सुइट' } },
  },
  {
    id: 'att_104',
    userId: 'user-vikram-malhotra',
    productId: '3',
    assessmentId: 'a3',
    assessmentVersion: 1,
    language: Language.EN,
    status: AttemptStatus.SUBMITTED,
    startedAt: '2026-10-27T15:40:00.000Z',
    expiresAt: '2026-10-27T15:55:00.000Z',
    submittedAt: '2026-10-27T15:52:00.000Z',
    scoreSummary: { overallScore: 82, archetype: 'Empathetic Catalyst', percentile: 88 },
    user: { id: 'user-vikram-malhotra', name: 'Vikram Malhotra', email: 'vikram.m@example.com' },
    product: { id: '3', slug: 'emotional-resilience', name: { en: 'Emotional Resilience & EQ', hi: 'भावनात्मक लचीलापन और ईक्यू' } },
    assessment: { id: 'a3', title: { en: 'Emotional Resilience & EQ', hi: 'भावनात्मक लचीलापन और ईक्यू' } },
  },
  {
    id: 'att_105',
    userId: 'user-sneha-kulkarni',
    productId: '6',
    assessmentId: 'a6',
    assessmentVersion: 1,
    language: Language.EN,
    status: AttemptStatus.SUBMITTED,
    startedAt: '2026-10-26T10:30:00.000Z',
    expiresAt: '2026-10-26T10:50:00.000Z',
    submittedAt: '2026-10-26T10:48:15.000Z',
    scoreSummary: { overallScore: 88, archetype: 'Logical Strategist', percentile: 94 },
    user: { id: 'user-sneha-kulkarni', name: 'Sneha Kulkarni', email: 'sneha.k@example.com' },
    product: { id: '6', slug: 'cognitive-aptitude-mastery', name: { en: 'Cognitive Aptitude Mastery', hi: 'संज्ञानात्मक योग्यता महारत' } },
    assessment: { id: 'a6', title: { en: 'Cognitive Aptitude Mastery', hi: 'संज्ञानात्मक योग्यता महारत' } },
  },
  {
    id: 'att_106',
    userId: 'user-arjun-nair',
    productId: '4',
    assessmentId: 'a4',
    assessmentVersion: 1,
    language: Language.HI,
    status: AttemptStatus.IN_PROGRESS,
    startedAt: '2026-10-25T13:20:00.000Z',
    expiresAt: '2026-10-25T13:25:00.000Z',
    submittedAt: null,
    scoreSummary: null,
    user: { id: 'user-arjun-nair', name: 'Arjun Nair', email: 'arjun.n@example.com' },
    product: { id: '4', slug: 'free-leadership-sampler', name: { en: 'Free Leadership Sampler', hi: 'निःशुल्क नेतृत्व नमूना' } },
    assessment: { id: 'a4', title: { en: 'Free Leadership Sampler', hi: 'निःशुल्क नेतृत्व नमूना' } },
  },
  {
    id: 'att_108',
    userId: 'demo-user-1',
    productId: '1',
    assessmentId: 'a1',
    assessmentVersion: 1,
    language: Language.EN,
    status: AttemptStatus.SUBMITTED,
    startedAt: '2026-10-31T07:20:00.000Z',
    expiresAt: '2026-10-31T07:40:00.000Z',
    submittedAt: '2026-10-31T07:38:00.000Z',
    scoreSummary: { overallScore: 86, archetype: 'Collaborative Executor', percentile: 90 },
    user: { id: 'demo-user-1', name: 'Demo Candidate', email: 'user1@test.com' },
    product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' } },
    assessment: { id: 'a1', title: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' } },
  },
];

// ==================== REPORTS STORE ====================
export interface MockAdminReport {
  id: string;
  orderId: string;
  status: ReportStatus;
  version: number;
  pdfUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  content?: any;
  revisions?: any[];
  order: {
    id: string;
    userId: string;
    productId: string;
    attemptId: string;
    user: { id: string; name: string; email: string };
    product: { id: string; slug: string; name: { en: string; hi: string }; priceInPaise: number };
    attempt?: any;
  };
}

export const mockReportsStore: MockAdminReport[] = [
  {
    id: 'rep_101',
    orderId: 'ord_101',
    status: ReportStatus.RELEASED,
    version: 1,
    pdfUrl: '/api/v1/reports/rep_101/download',
    errorMessage: null,
    createdAt: '2026-10-30T10:17:00.000Z',
    updatedAt: '2026-10-30T10:20:00.000Z',
    content: {
      candidateName: 'Priya Sharma',
      archetype: 'Strategic Navigator',
      overallScore: 84,
      executiveSummary: 'Priya displays exceptional clarity under high-pressure strategic pivots. Excels in cross-functional alignment.',
      dimensions: [
        { name: 'Strategic Vision', score: 88, benchmark: 75 },
        { name: 'Adaptability & Resilience', score: 85, benchmark: 70 },
        { name: 'Execution Agility', score: 82, benchmark: 74 },
        { name: 'Interpersonal Empathy', score: 81, benchmark: 72 },
      ],
    },
    revisions: [
      { id: 'rev_101_1', version: 1, editedBy: 'System AI Engine', reason: 'Initial generation complete', createdAt: '2026-10-30T10:17:00.000Z' },
    ],
    order: {
      id: 'ord_101',
      userId: 'user-priya-sharma',
      productId: '1',
      attemptId: 'att_101',
      user: { id: 'user-priya-sharma', name: 'Priya Sharma', email: 'priya.sharma@example.com' },
      product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' }, priceInPaise: 49900 },
    },
  },
  {
    id: 'rep_102',
    orderId: 'ord_102',
    status: ReportStatus.GENERATED,
    version: 1,
    pdfUrl: null,
    errorMessage: null,
    createdAt: '2026-10-29T14:23:00.000Z',
    updatedAt: '2026-10-29T14:25:00.000Z',
    content: {
      candidateName: 'Rahul Verma',
      archetype: 'Analytical Architect',
      overallScore: 78,
      executiveSummary: 'Demonstrates deep structured problem-solving and rigorous quantitative reasoning methodology.',
    },
    revisions: [],
    order: {
      id: 'ord_102',
      userId: 'user-rahul-verma',
      productId: '2',
      attemptId: 'att_102',
      user: { id: 'user-rahul-verma', name: 'Rahul Verma', email: 'rahul.v@example.com' },
      product: { id: '2', slug: 'career-aptitude', name: { en: 'Career & Cognitive Aptitude', hi: 'कैरियर और संज्ञानात्मक योग्यता' }, priceInPaise: 79900 },
    },
  },
  {
    id: 'rep_103',
    orderId: 'ord_103',
    status: ReportStatus.PENDING_REVIEW,
    version: 1,
    pdfUrl: null,
    errorMessage: null,
    createdAt: '2026-10-28T09:43:00.000Z',
    updatedAt: '2026-10-28T09:45:00.000Z',
    content: {
      candidateName: 'Ananya Patel',
      archetype: 'Transformational Visionary',
      overallScore: 91,
      executiveSummary: 'Outstanding executive presence with high systemic influence and change management mastery.',
    },
    revisions: [],
    order: {
      id: 'ord_103',
      userId: 'user-ananya-patel',
      productId: '5',
      attemptId: 'att_103',
      user: { id: 'user-ananya-patel', name: 'Ananya Patel', email: 'ananya.p@example.com' },
      product: { id: '5', slug: 'pro-leadership-suite', name: { en: 'Pro Leadership Assessment Suite', hi: 'प्रो नेतृत्व मूल्यांकन सुइट' }, priceInPaise: 99900 },
    },
  },
  {
    id: 'rep_104',
    orderId: 'ord_104',
    status: ReportStatus.RELEASED,
    version: 1,
    pdfUrl: '/api/v1/reports/rep_104/download',
    errorMessage: null,
    createdAt: '2026-10-27T16:13:00.000Z',
    updatedAt: '2026-10-27T16:15:00.000Z',
    content: {
      candidateName: 'Vikram Malhotra',
      archetype: 'Empathetic Catalyst',
      overallScore: 82,
      executiveSummary: 'High EQ metric with strong consensus-building aptitude in complex enterprise situations.',
    },
    revisions: [],
    order: {
      id: 'ord_104',
      userId: 'user-vikram-malhotra',
      productId: '3',
      attemptId: 'att_104',
      user: { id: 'user-vikram-malhotra', name: 'Vikram Malhotra', email: 'vikram.m@example.com' },
      product: { id: '3', slug: 'emotional-resilience', name: { en: 'Emotional Resilience & EQ', hi: 'भावनात्मक लचीलापन और ईक्यू' }, priceInPaise: 59900 },
    },
  },
  {
    id: 'rep_105',
    orderId: 'ord_105',
    status: ReportStatus.RELEASED,
    version: 1,
    pdfUrl: '/api/v1/reports/rep_105/download',
    errorMessage: null,
    createdAt: '2026-10-26T11:08:00.000Z',
    updatedAt: '2026-10-26T11:10:00.000Z',
    content: {
      candidateName: 'Sneha Kulkarni',
      archetype: 'Logical Strategist',
      overallScore: 88,
      executiveSummary: 'Exceptional deductive logic with rapid pattern recognition across quantitative datasets.',
    },
    revisions: [],
    order: {
      id: 'ord_105',
      userId: 'user-sneha-kulkarni',
      productId: '6',
      attemptId: 'att_105',
      user: { id: 'user-sneha-kulkarni', name: 'Sneha Kulkarni', email: 'sneha.k@example.com' },
      product: { id: '6', slug: 'cognitive-aptitude-mastery', name: { en: 'Cognitive Aptitude Mastery', hi: 'संज्ञानात्मक योग्यता महारत' }, priceInPaise: 49900 },
    },
  },
  {
    id: 'rep_108',
    orderId: 'ord_108',
    status: ReportStatus.RELEASED,
    version: 1,
    pdfUrl: '/api/v1/reports/rep_108/download',
    errorMessage: null,
    createdAt: '2026-10-31T07:47:00.000Z',
    updatedAt: '2026-10-31T07:50:00.000Z',
    content: {
      candidateName: 'Demo Candidate',
      archetype: 'Collaborative Executor',
      overallScore: 86,
      executiveSummary: 'Demonstrates balanced collaborative and decisive behaviors benchmarked for product leaders.',
    },
    revisions: [],
    order: {
      id: 'ord_108',
      userId: 'demo-user-1',
      productId: '1',
      attemptId: 'att_108',
      user: { id: 'demo-user-1', name: 'Demo Candidate', email: 'user1@test.com' },
      product: { id: '1', slug: 'personality-dynamics', name: { en: 'Personality & Leadership Dynamics', hi: 'व्यक्तित्व और नेतृत्व गतिशीलता' }, priceInPaise: 49900 },
    },
  },
];

// ==================== AUDIT LOGS STORE ====================
export interface MockAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  ipAddress: string | null;
  details: any;
  createdAt: string;
}

export const mockAuditLogsStore: MockAuditLog[] = [
  {
    id: 'aud_1',
    action: 'REPORT_RELEASED',
    entityType: 'Report',
    entityId: 'rep_108',
    actorId: 'admin-user-id',
    ipAddress: '127.0.0.1',
    details: { reason: 'Executive review completed and approved' },
    createdAt: '2026-10-31T07:50:00.000Z',
  },
  {
    id: 'aud_2',
    action: 'ORDER_PAID',
    entityType: 'Order',
    entityId: 'ord_108',
    actorId: 'demo-user-1',
    ipAddress: '127.0.0.1',
    details: { amountInPaise: 49900, gateway: 'RAZORPAY' },
    createdAt: '2026-10-31T07:46:10.000Z',
  },
  {
    id: 'aud_3',
    action: 'ATTEMPT_SUBMITTED',
    entityType: 'Attempt',
    entityId: 'att_108',
    actorId: 'demo-user-1',
    ipAddress: '127.0.0.1',
    details: { scoreSummary: { overallScore: 86 } },
    createdAt: '2026-10-31T07:38:00.000Z',
  },
  {
    id: 'aud_4',
    action: 'REPORT_RELEASED',
    entityType: 'Report',
    entityId: 'rep_101',
    actorId: 'admin-user-id',
    ipAddress: '192.168.1.10',
    details: { reason: 'Automated auto-release validation passed' },
    createdAt: '2026-10-30T10:20:00.000Z',
  },
  {
    id: 'aud_5',
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: 'admin-user-id',
    actorId: 'admin-user-id',
    ipAddress: '127.0.0.1',
    details: { method: 'PASSWORD' },
    createdAt: '2026-10-30T09:00:00.000Z',
  },
  {
    id: 'aud_6',
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: '1',
    actorId: 'admin-user-id',
    ipAddress: '127.0.0.1',
    details: { field: 'priceInPaise', value: 49900 },
    createdAt: '2026-10-29T11:00:00.000Z',
  },
];

