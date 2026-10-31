import { PrismaClient, Role, Language, AssessmentKind, QuestionType } from '@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const db = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Seed Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

  let admin = await db.user.findUnique({
    where: { email: adminEmail },
  });

  if (!admin) {
    const passwordHash = await argon2.hash(adminPassword);
    admin = await db.user.create({
      data: {
        name: 'System Admin',
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
        preferredLanguage: Language.EN,
        consentAcceptedAt: new Date(),
        isActive: true,
      },
    });
    console.log(`Admin user created: ${admin.email}`);
  } else {
    console.log(`Admin user already exists: ${admin.email}`);
  }

  // 2. Seed Assessment 1: Objective (5 questions)
  const objectiveSlug = 'leadership-readiness-index';
  let objectiveAssessment = await db.assessment.findUnique({
    where: { slug: objectiveSlug },
  });

  if (!objectiveAssessment) {
    objectiveAssessment = await db.assessment.create({
      data: {
        slug: objectiveSlug,
        title: {
          en: 'Leadership Readiness Index',
          hi: 'नेतृत्व तत्परता सूचकांक',
        },
        description: {
          en: 'Comprehensive assessment to evaluate strategic vision, delegation, and emotional intelligence.',
          hi: 'रणनीतिक दृष्टि, प्रतिनिधिमंडल और भावनात्मक बुद्धिमत्ता का मूल्यांकन करने के लिए व्यापक परीक्षण।',
        },
        kind: AssessmentKind.OBJECTIVE,
        timeLimitSeconds: 1800,
        version: 1,
        isActive: true,
      },
    });

    const objectiveQuestions = [
      {
        order: 1,
        section: 'Communication',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'How do you handle severe disagreement within your team during project delivery?',
          hi: 'परियोजना वितरण के दौरान आप अपनी टीम के भीतर गंभीर असहमति को कैसे संभालते हैं?',
        },
        dimension: 'Conflict Management',
        options: [
          { order: 1, label: { en: 'Make an executive decision unilaterally', hi: 'एकतरफा कार्यकारी निर्णय लें' }, score: 1 },
          { order: 2, label: { en: 'Postpone the discussion until emotions calm down', hi: 'चर्चा को तब तक स्थगित करें जब तक भावनाएं शांत न हो जाएं' }, score: 2 },
          { order: 3, label: { en: 'Facilitate open dialog and align on objective criteria', hi: 'खुले संवाद की सुविधा प्रदान करें और वस्तुनिष्ठ मानदंडों पर संरेखित करें' }, score: 4 },
          { order: 4, label: { en: 'Take a majority team vote regardless of technical trade-offs', hi: 'तकनीकी व्यापार-नापसंद की परवाह किए बिना टीम का बहुमत वोट लें' }, score: 2 },
        ],
      },
      {
        order: 2,
        section: 'Delegation',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'When assigning a high-stakes task to a junior engineer, you:',
          hi: 'किसी जूनियर इंजीनियर को उच्च-जोखिम वाला कार्य सौंपते समय, आप:',
        },
        dimension: 'Delegation & Trust',
        options: [
          { order: 1, label: { en: 'Micromanage every commit and pull request daily', hi: 'प्रतिदिन प्रत्येक कमिट और पीआर का माइक्रोमैनेज करें' }, score: 1 },
          { order: 2, label: { en: 'Provide clear outcomes, guidance, and set scheduled check-ins', hi: 'स्पष्ट परिणाम, मार्गदर्शन प्रदान करें और निर्धारित चेक-इन सेट करें' }, score: 4 },
          { order: 3, label: { en: 'Assign with no context to test resilience under fire', hi: 'बिना संदर्भ के सौंपें ताकि तनाव में लचीलेपन का परीक्षण हो सके' }, score: 1 },
          { order: 4, label: { en: 'Do the core logic yourself and delegate only documentation', hi: 'मुख्य तर्क स्वयं करें और केवल दस्तावेज़ीकरण सौंपें' }, score: 2 },
        ],
      },
      {
        order: 3,
        section: 'Strategic Vision',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'What is your primary factor when prioritizing quarterly engineering roadmap initiatives?',
          hi: 'त्रैमासिक इंजीनियरिंग रोडमैप पहलों को प्राथमिकता देते समय आपका प्राथमिक कारक क्या है?',
        },
        dimension: 'Strategic Thinking',
        options: [
          { order: 1, label: { en: 'Long-term business value aligned with customer impact', hi: 'ग्राहक प्रभाव के साथ संरेखित दीर्घकालिक व्यावसायिक मूल्य' }, score: 4 },
          { order: 2, label: { en: 'Whichever stakeholder escalates loudest to executive leadership', hi: 'जो भी हितधारक कार्यकारी नेतृत्व को सबसे जोर से शिकायत करता है' }, score: 1 },
          { order: 3, label: { en: 'Adopting modern frameworks purely for engineering novelty', hi: 'विशुद्ध रूप से नवीनता के लिए नए फ्रेमवर्क अपनाना' }, score: 1 },
          { order: 4, label: { en: 'Completing easiest backlog tickets first for velocity stats', hi: 'गति आंकड़ों के लिए पहले आसान बैकस्टॉक टिकट पूरे करना' }, score: 2 },
        ],
      },
      {
        order: 4,
        section: 'People Development',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'How frequently do you engage in structured 1:1 career growth discussions with direct reports?',
          hi: 'आप प्रत्यक्ष अधीनस्थों के साथ संरचित 1:1 करियर विकास चर्चाओं में कितनी बार संलग्न होते हैं?',
        },
        dimension: 'People Development',
        options: [
          { order: 1, label: { en: 'Bi-weekly with dedicated development goal tracking', hi: 'समर्पित विकास लक्ष्य ट्रैकिंग के साथ पाक्षिक' }, score: 4 },
          { order: 2, label: { en: 'Only during formal annual performance appraisal cycles', hi: 'केवल औपचारिक वार्षिक प्रदर्शन मूल्यांकन चक्रों के दौरान' }, score: 1 },
          { order: 3, label: { en: 'Whenever the employee requests promotion discussions', hi: 'जब भी कर्मचारी पदोन्नति चर्चा का अनुरोध करता है' }, score: 2 },
          { order: 4, label: { en: 'Never, team standups suffice for feedback', hi: 'कभी नहीं, फीडबैक के लिए टीम स्टैंडअप ही काफी हैं' }, score: 0 },
        ],
      },
      {
        order: 5,
        section: 'Resilience',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'During a production outage affecting primary revenue streams, what is your first leadership action?',
          hi: 'प्राथमिक राजस्व को प्रभावित करने वाले आउटेज के दौरान, आपकी पहली नेतृत्व कार्रवाई क्या है?',
        },
        dimension: 'Crisis Leadership',
        options: [
          { order: 1, label: { en: 'Establish incident command, delegate mitigation, and provide calm updates', hi: 'घटना कमान स्थापित करें, शमन सौंपें, और शांत अपडेट दें' }, score: 4 },
          { order: 2, label: { en: 'Identify and publicly call out the developer whose commit broke production', hi: 'उस डेवलपर की पहचान करें और सार्वजनिक रूप से डांटें' }, score: 0 },
          { order: 3, label: { en: 'Disconnect all alerts until the incident naturally stabilizes', hi: 'अलर्ट डिस्कनेक्ट करें जब तक स्थिति खुद ठीक न हो जाए' }, score: 0 },
          { order: 4, label: { en: 'Immediately refund all customers before assessing blast radius', hi: 'प्रभाव का आकलन करने से पहले तुरंत सभी ग्राहकों को रिफंड करें' }, score: 1 },
        ],
      },
    ];

    for (const q of objectiveQuestions) {
      const createdQ = await db.question.create({
        data: {
          assessmentId: objectiveAssessment.id,
          order: q.order,
          section: q.section,
          type: q.type,
          text: q.text,
          dimension: q.dimension,
          isRequired: true,
          isActive: true,
        },
      });

      await db.option.createMany({
        data: q.options.map((opt) => ({
          questionId: createdQ.id,
          order: opt.order,
          label: opt.label,
          score: opt.score,
          isActive: true,
        })),
      });
    }

    console.log(`Created Objective Assessment with 5 questions: ${objectiveSlug}`);
  } else {
    console.log(`Objective Assessment already exists: ${objectiveSlug}`);
  }

  // 3. Seed Assessment 2: Mixed (4 questions: 2 Single Choice, 1 Multi Choice, 1 Text)
  const mixedSlug = 'cognitive-problem-solving-suite';
  let mixedAssessment = await db.assessment.findUnique({
    where: { slug: mixedSlug },
  });

  if (!mixedAssessment) {
    mixedAssessment = await db.assessment.create({
      data: {
        slug: mixedSlug,
        title: {
          en: 'Cognitive & Problem Solving Suite',
          hi: 'संज्ञानात्मक एवं समस्या समाधान सुइट',
        },
        description: {
          en: 'Multi-format assessment blending analytical logic with open situational problem solving.',
          hi: 'खुली स्थितिजन्य समस्या समाधान के साथ विश्लेषणात्मक तर्क का सम्मिश्रण बहु-प्रारूप मूल्यांकन।',
        },
        kind: AssessmentKind.MIXED,
        timeLimitSeconds: 2400,
        version: 1,
        isActive: true,
      },
    });

    // Question 1: Single Choice
    const q1 = await db.question.create({
      data: {
        assessmentId: mixedAssessment.id,
        order: 1,
        section: 'Logical Deduction',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'If all Servers in Region A are resilient, and System X is in Region A, what must be true?',
          hi: 'यदि रीजन ए के सभी सर्वर लचीले हैं, और सिस्टम एक्स रीजन ए में है, तो क्या सत्य होना चाहिए?',
        },
        isRequired: true,
        isActive: true,
      },
    });
    await db.option.createMany({
      data: [
        { questionId: q1.id, order: 1, label: { en: 'System X is resilient', hi: 'सिस्टम एक्स लचीला है' }, score: 5, isActive: true },
        { questionId: q1.id, order: 2, label: { en: 'System X is vulnerable', hi: 'सिस्टम एक्स असुरक्षित है' }, score: 0, isActive: true },
        { questionId: q1.id, order: 3, label: { en: 'System X cannot fail', hi: 'सिस्टम एक्स कभी विफल नहीं हो सकता' }, score: 0, isActive: true },
      ],
    });

    // Question 2: Multi Choice
    const q2 = await db.question.create({
      data: {
        assessmentId: mixedAssessment.id,
        order: 2,
        section: 'System Reliability',
        type: QuestionType.MULTI_CHOICE,
        text: {
          en: 'Select ALL engineering practices that actively mitigate cascading distributed failures:',
          hi: 'उन सभी इंजीनियरिंग प्रथाओं का चयन करें जो व्यापक विफलताओं को कम करती हैं:',
        },
        isRequired: true,
        isActive: true,
      },
    });
    await db.option.createMany({
      data: [
        { questionId: q2.id, order: 1, label: { en: 'Circuit breakers and graceful degradation', hi: 'सर्किट ब्रेकर और शालीन गिरावट' }, score: 3, isActive: true },
        { questionId: q2.id, order: 2, label: { en: 'Exponential backoff with jitter on retries', hi: 'पुनः प्रयास पर घातीय बैकऑफ़' }, score: 3, isActive: true },
        { questionId: q2.id, order: 3, label: { en: 'Synchronous blocking calls between all microservices', hi: 'सभी माइक्रोसेवाओं के बीच समकालिक कॉल्स' }, score: -2, isActive: true },
        { questionId: q2.id, order: 4, label: { en: 'Bulkheading critical resource pools', hi: 'महत्वपूर्ण संसाधन पूलों की बल्कहेडिंग' }, score: 3, isActive: true },
      ],
    });

    // Question 3: Single Choice
    const q3 = await db.question.create({
      data: {
        assessmentId: mixedAssessment.id,
        order: 3,
        section: 'Analytical Estimation',
        type: QuestionType.SINGLE_CHOICE,
        text: {
          en: 'A service handles 10,000 requests/sec with an average payload of 2KB. What is required bandwidth?',
          hi: 'एक सेवा 2KB के औसत पेलोड के साथ 10,000 अनुरोध/सेकंड संभालती है। आवश्यक बैंडविड्थ क्या है?',
        },
        isRequired: true,
        isActive: true,
      },
    });
    await db.option.createMany({
      data: [
        { questionId: q3.id, order: 1, label: { en: '20 MB/s (~160 Mbps)', hi: '20 एमबी/सेकंड (~160 एमबीपीएस)' }, score: 5, isActive: true },
        { questionId: q3.id, order: 2, label: { en: '2 MB/s (~16 Mbps)', hi: '2 एमबी/सेकंड (~16 एमबीपीएस)' }, score: 0, isActive: true },
        { questionId: q3.id, order: 3, label: { en: '200 MB/s (~1.6 Gbps)', hi: '200 एमबी/सेकंड (~1.6 जीबीपीएस)' }, score: 0, isActive: true },
      ],
    });

    // Question 4: Open Text Response
    await db.question.create({
      data: {
        assessmentId: mixedAssessment.id,
        order: 4,
        section: 'Situational Judgment',
        type: QuestionType.TEXT,
        text: {
          en: 'Describe a situation where you balanced technical debt versus urgent feature demands. What was your framework?',
          hi: 'ऐसी स्थिति का वर्णन करें जहाँ आपने तकनीकी ऋण बनाम आवश्यक सुविधाओं को संतुलित किया। आपका ढांचा क्या था?',
        },
        maxLength: 1000,
        isRequired: true,
        isActive: true,
      },
    });

    console.log(`Created Mixed Assessment with 4 questions: ${mixedSlug}`);
  } else {
    console.log(`Mixed Assessment already exists: ${mixedSlug}`);
  }

  // 4. Seed 3 Products (1 Free, 2 Paid)
  const productsToSeed = [
    {
      slug: 'free-leadership-sampler',
      name: {
        en: 'Leadership Readiness Assessment (Free Starter)',
        hi: 'नेतृत्व तत्परता मूल्यांकन (निःशुल्क स्टार्टर)',
      },
      description: {
        en: 'Introductory assessment to discover your leadership tendencies and decision style.',
        hi: 'अपनी नेतृत्व प्रवृत्तियों और निर्णय शैली को जानने के लिए परिचयात्मक मूल्यांकन।',
      },
      assessmentId: objectiveAssessment.id,
      priceInPaise: 0,
      currency: 'INR',
      autoRelease: true,
      isActive: true,
    },
    {
      slug: 'pro-leadership-suite',
      name: {
        en: 'Executive Leadership Pro Benchmark',
        hi: 'कार्यकारी नेतृत्व प्रो बेंचमार्क',
      },
      description: {
        en: 'Full diagnostic evaluation with percentile benchmarking and AI-powered recommendations.',
        hi: 'प्रतिशतक बेंचमार्किंग और एआई-संचालित सिफारिशों के साथ पूर्ण नैदानिक ​​मूल्यांकन।',
      },
      assessmentId: objectiveAssessment.id,
      priceInPaise: 49900, // ₹499 in paise
      currency: 'INR',
      autoRelease: true,
      isActive: true,
    },
    {
      slug: 'cognitive-aptitude-mastery',
      name: {
        en: 'Cognitive & Analytical Mastery Program',
        hi: 'संज्ञानात्मक एवं विश्लेषणात्मक महारत कार्यक्रम',
      },
      description: {
        en: 'Deep multi-modal assessment including open-ended situational analysis.',
        hi: 'ओपन-एंडेड स्थितिजन्य विश्लेषण सहित गहरा मल्टी-मोडल मूल्यांकन।',
      },
      assessmentId: mixedAssessment.id,
      priceInPaise: 99900, // ₹999 in paise
      currency: 'INR',
      autoRelease: true,
      isActive: true,
    },
  ];

  for (const prod of productsToSeed) {
    const existing = await db.product.findUnique({
      where: { slug: prod.slug },
    });

    if (!existing) {
      await db.product.create({
        data: prod,
      });
      console.log(`Created Product: ${prod.slug} (₹${prod.priceInPaise / 100})`);
    } else {
      console.log(`Product already exists: ${prod.slug}`);
    }
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
