export interface FallbackOption {
  id: string;
  order: number;
  label: { en: string; hi: string };
  score: number;
}

export interface FallbackQuestion {
  id: string;
  order: number;
  section: string;
  type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT';
  text: { en: string; hi: string };
  isRequired: boolean;
  maxLength?: number;
  dimension: string;
  options: FallbackOption[];
}

export interface FallbackAssessment {
  id: string;
  slug: string;
  title: { en: string; hi: string };
  description: { en: string; hi: string };
  kind: 'OBJECTIVE' | 'SUBJECTIVE' | 'MIXED';
  version: number;
  isActive: boolean;
  timeLimitSeconds: number;
  questions: FallbackQuestion[];
}

export interface FallbackProduct {
  id: string;
  slug: string;
  name: { en: string; hi: string };
  description: { en: string; hi: string };
  priceInPaise: number;
  currency: string;
  isActive: boolean;
  assessmentId: string;
  assessment: FallbackAssessment;
}

export const FALLBACK_PRODUCTS_DB: FallbackProduct[] = [
  {
    id: '1',
    slug: 'personality-dynamics',
    name: {
      en: 'Personality & Leadership Dynamics',
      hi: 'व्यक्तित्व और नेतृत्व गतिशीलता',
    },
    description: {
      en: 'Comprehensive psychometric analysis covering behavioral archetypes, decision-making, and emotional intelligence.',
      hi: 'व्यापक मनोवैज्ञानिक विश्लेषण जो व्यवहारिक दृष्टिकोण, निर्णय लेने और भावनात्मक बुद्धिमत्ता को कवर करता है।',
    },
    priceInPaise: 49900,
    currency: 'INR',
    isActive: true,
    assessmentId: 'a1',
    assessment: {
      id: 'a1',
      slug: 'personality-dynamics',
      title: {
        en: 'Personality & Leadership Dynamics',
        hi: 'व्यक्तित्व और नेतृत्व गतिशीलता',
      },
      description: {
        en: 'Understand your behavioral archetype',
        hi: 'अपने व्यवहारिक स्वरूप को समझें',
      },
      kind: 'OBJECTIVE',
      version: 1,
      isActive: true,
      timeLimitSeconds: 1200,
      questions: [
        {
          id: 'q1',
          order: 1,
          section: 'Behavioral Archetype',
          type: 'SINGLE_CHOICE',
          text: {
            en: 'When facing an unexpected deadline shift, how do you typically respond?',
            hi: 'अप्रत्याशित समय सीमा में बदलाव का सामना करते समय, आप आमतौर पर कैसे प्रतिक्रिया करते हैं?',
          },
          isRequired: true,
          dimension: 'adaptability',
          options: [
            {
              id: 'o1_1',
              order: 1,
              label: {
                en: 'Rapidly reorganize priorities and inform the team',
                hi: 'प्राथमिकताओं को तेजी से पुनर्गठित करें और टीम को सूचित करें',
              },
              score: 10,
            },
            {
              id: 'o1_2',
              order: 2,
              label: {
                en: 'Evaluate the root cause before taking action',
                hi: 'कार्रवाई करने से पहले मूल कारण का मूल्यांकन करें',
              },
              score: 8,
            },
            {
              id: 'o1_3',
              order: 3,
              label: {
                en: 'Rely on existing processes to mitigate delays',
                hi: 'देरी को कम करने के लिए मौजूदा प्रक्रियाओं पर भरोसा करें',
              },
              score: 6,
            },
            {
              id: 'o1_4',
              order: 4,
              label: {
                en: 'Request deadline extension immediately',
                hi: 'तुरंत समय सीमा विस्तार का अनुरोध करें',
              },
              score: 4,
            },
          ],
        },
        {
          id: 'q2',
          order: 2,
          section: 'Cognitive Versatility',
          type: 'SINGLE_CHOICE',
          text: {
            en: 'How do you handle ambiguous requirements in a complex initiative?',
            hi: 'आप किसी जटिल पहल में अस्पष्ट आवश्यकताओं को कैसे संभालते हैं?',
          },
          isRequired: true,
          dimension: 'problem_solving',
          options: [
            {
              id: 'o2_1',
              order: 1,
              label: {
                en: 'Formulate hypotheses and prototype rapidly',
                hi: 'परिकल्पनाएं बनाएं और तेजी से प्रोटोटाइप करें',
              },
              score: 10,
            },
            {
              id: 'o2_2',
              order: 2,
              label: {
                en: 'Interview stakeholders to clarify constraints',
                hi: 'बाधाओं को स्पष्ट करने के लिए हितधारकों का साक्षात्कार लें',
              },
              score: 9,
            },
            {
              id: 'o2_3',
              order: 3,
              label: {
                en: 'Wait for detailed documentation',
                hi: 'विस्तृत दस्तावेज़ीकरण की प्रतीक्षा करें',
              },
              score: 4,
            },
            {
              id: 'o2_4',
              order: 4,
              label: {
                en: 'Delegate the uncertain aspects to peers',
                hi: 'अनिश्चित पहलुओं को साथियों को सौंपें',
              },
              score: 3,
            },
          ],
        },
        {
          id: 'q3',
          order: 3,
          section: 'Strategic Leadership',
          type: 'SINGLE_CHOICE',
          text: {
            en: 'When resolving conflicting viewpoints among senior stakeholders, your primary approach is:',
            hi: 'वरिष्ठ हितधारकों के बीच परस्पर विरोधी दृष्टिकोणों को सुलझाते समय, आपका प्राथमिक दृष्टिकोण क्या है:',
          },
          isRequired: true,
          dimension: 'leadership',
          options: [
            {
              id: 'o3_1',
              order: 1,
              label: {
                en: 'Align on shared business outcomes with objective data',
                hi: 'उद्देश्य डेटा के साथ साझा व्यावसायिक परिणामों पर संरेखित करें',
              },
              score: 10,
            },
            {
              id: 'o3_2',
              order: 2,
              label: {
                en: 'Facilitate a structured compromise between factions',
                hi: 'गुटों के बीच एक संरचित समझौते की सुविधा प्रदान करें',
              },
              score: 8,
            },
            {
              id: 'o3_3',
              order: 3,
              label: {
                en: 'Escalate to executive leadership for final ruling',
                hi: 'अंतिम निर्णय के लिए कार्यकारी नेतृत्व तक बात पहुंचाएं',
              },
              score: 5,
            },
            {
              id: 'o3_4',
              order: 4,
              label: {
                en: 'Adopt the majority vote approach',
                hi: 'बहुमत दृष्टिकोण को अपनाएं',
              },
              score: 6,
            },
          ],
        },
        {
          id: 'q4',
          order: 4,
          section: 'Emotional Composure',
          type: 'SINGLE_CHOICE',
          text: {
            en: 'Under acute high-pressure situations, how do you maintain executive presence?',
            hi: 'अत्यधिक उच्च दबाव वाली स्थितियों में, आप कार्यकारी उपस्थिति कैसे बनाए रखते हैं?',
          },
          isRequired: true,
          dimension: 'resilience',
          options: [
            {
              id: 'o4_1',
              order: 1,
              label: {
                en: 'Calibrate breathing, isolate critical variables, and direct clear next steps',
                hi: 'गहरी सांस लें, महत्वपूर्ण चरों को अलग करें और स्पष्ट अगले कदम निर्देशित करें',
              },
              score: 10,
            },
            {
              id: 'o4_2',
              order: 2,
              label: {
                en: 'Pause briefly to collect thoughts before responding',
                hi: 'जवाब देने से पहले विचारों को एकत्र करने के लिए कुछ देर रुकें',
              },
              score: 8,
            },
            {
              id: 'o4_3',
              order: 3,
              label: {
                en: 'Internalize the stress and push through the workload',
                hi: 'तनाव को आंतरिक रूप से सहें और कार्यभार को आगे बढ़ाएं',
              },
              score: 5,
            },
            {
              id: 'o4_4',
              order: 4,
              label: {
                en: 'Express candid frustration to vent pressure',
                hi: 'दबाव कम करने के लिए स्पष्ट निराशा व्यक्त करें',
              },
              score: 2,
            },
          ],
        },
        {
          id: 'q5',
          order: 5,
          section: 'Decision Speed',
          type: 'SINGLE_CHOICE',
          text: {
            en: 'With 70% of information available, when do you trigger key decisions?',
            hi: '70% जानकारी उपलब्ध होने पर, आप मुख्य निर्णय कब ट्रिगर करते हैं?',
          },
          isRequired: true,
          dimension: 'decisiveness',
          options: [
            {
              id: 'o5_1',
              order: 1,
              label: {
                en: 'Decide immediately and iterate based on real feedback',
                hi: 'तुरंत निर्णय लें और वास्तविक प्रतिक्रिया के आधार पर पुनरावृति करें',
              },
              score: 10,
            },
            {
              id: 'o5_2',
              order: 2,
              label: {
                en: 'Conduct a quick risk-reward matrix before committing',
                hi: 'प्रतिबद्ध होने से पहले एक त्वरित जोखिम-इनाम मैट्रिक्स का संचालन करें',
              },
              score: 8,
            },
            {
              id: 'o5_3',
              order: 3,
              label: {
                en: 'Wait until 90%+ certainty is achieved',
                hi: 'जब तक 90%+ निश्चितता प्राप्त न हो जाए तब तक प्रतीक्षा करें',
              },
              score: 4,
            },
            {
              id: 'o5_4',
              order: 4,
              label: {
                en: 'Defer to avoid potential error',
                hi: 'संभावित त्रुटि से बचने के लिए टालें',
              },
              score: 2,
            },
          ],
        },
      ],
    },
  },
  {
    id: '2',
    slug: 'career-aptitude',
    name: {
      en: 'Career & Cognitive Aptitude',
      hi: 'करियर और संज्ञानात्मक योग्यता',
    },
    description: {
      en: 'Identify highest-fit roles, industry trajectories, and critical thinking potential.',
      hi: 'सर्वोत्तम उपयुक्त भूमिकाओं, उद्योग प्रक्षेपवक्र और महत्वपूर्ण सोच क्षमता की पहचान करें।',
    },
    priceInPaise: 79900,
    currency: 'INR',
    isActive: true,
    assessmentId: 'a2',
    assessment: {
      id: 'a2',
      slug: 'career-aptitude',
      title: {
        en: 'Career & Cognitive Aptitude',
        hi: 'करियर और संज्ञानात्मक योग्यता',
      },
      description: {
        en: 'Identify highest-fit roles',
        hi: 'सर्वोत्तम उपयुक्त भूमिकाओं की पहचान करें',
      },
      kind: 'MIXED',
      version: 1,
      isActive: true,
      timeLimitSeconds: 1500,
      questions: [],
    },
  },
  {
    id: '3',
    slug: 'emotional-resilience',
    name: {
      en: 'Emotional Resilience & EQ',
      hi: 'भावनात्मक लचीलापन और ईक्यू',
    },
    description: {
      en: 'Measure stress handling, interpersonal adaptability, and cognitive composure.',
      hi: 'तनाव से निपटने, पारस्परिक अनुकूलन क्षमता और संज्ञानात्मक संयम को मापें।',
    },
    priceInPaise: 59900,
    currency: 'INR',
    isActive: true,
    assessmentId: 'a3',
    assessment: {
      id: 'a3',
      slug: 'emotional-resilience',
      title: {
        en: 'Emotional Resilience & EQ',
        hi: 'भावनात्मक लचीलापन और ईक्यू',
      },
      description: {
        en: 'Measure stress handling',
        hi: 'तनाव से निपटने की क्षमता को मापें',
      },
      kind: 'OBJECTIVE',
      version: 1,
      isActive: true,
      timeLimitSeconds: 900,
      questions: [],
    },
  },
];

// In-memory fallback stores for offline local dev mode
export const inMemoryAttempts = new Map<string, any>();
export const inMemoryOrders = new Map<string, any>();
export const inMemoryReports = new Map<string, any>();

