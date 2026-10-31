import fs from 'fs';
import path from 'path';
import { renderReportHtml, ReportRenderData } from '../src/modules/reports/templates/reportCompiler';
import { defaultPdfRenderer } from '../src/integrations/pdf';

async function main() {
  console.log('Generating visual test sample PDFs...');

  const sampleEn: ReportRenderData = {
    reportId: 'sample-report-en-001',
    candidateName: 'Rahul Sharma',
    assessmentTitle: 'Senior Software Engineer Assessment',
    language: 'EN',
    generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    executiveSummary: 'Candidate demonstrated exemplary architectural problem-solving and clean code discipline. Strong technical depth in distributed systems and cloud security.',
    sections: [
      {
        title: 'System Design & Architecture',
        content: 'Demonstrated high competence in designing fault-tolerant, horizontally scalable event-driven services. Appropriately applied idempotent request handlers and circuit-breakers.',
        recommendations: [
          'Further explore database connection pooling tuning under high concurrency.',
          'Consider adopting OpenTelemetry distributed tracing across all downstream services.',
        ],
      },
      {
        title: 'Security & Data Governance',
        content: 'Follows principle of least privilege, strict Zod schema validation at API boundaries, and timing-safe signature verifications.',
        recommendations: [
          'Add automated dependency vulnerability scanners in continuous delivery pipeline.',
        ],
      },
    ],
    scoreSummary: {
      totalScore: 92,
      maxPossibleScore: 100,
      percentage: 92,
      dimensionScores: {
        'System Design': { score: 48, max: 50, percentage: 96 },
        'Security': { score: 24, max: 25, percentage: 96 },
        'Code Quality': { score: 20, max: 25, percentage: 80 },
      },
    },
  };

  const sampleHi: ReportRenderData = {
    reportId: 'sample-report-hi-002',
    candidateName: 'अजय कुमार',
    assessmentTitle: 'वरिष्ठ सॉफ्टवेयर इंजीनियर मूल्यांकन',
    language: 'HI',
    generatedDate: new Date().toLocaleDateString('hi-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
    executiveSummary: 'उम्मीदवार ने उत्कृष्ट वास्तुकला समस्या समाधान और स्वच्छ कोड अनुशासन का प्रदर्शन किया। वितरित प्रणालियों और क्लाउड सुरक्षा में तकनीकी गहराई मजबूत है।',
    sections: [
      {
        title: 'सिस्टम डिजाइन और वास्तुकला',
        content: 'दोष-सहिष्णु (fault-tolerant) और क्षैतिज रूप से स्केलेबल सेवाओं को डिजाइन करने में उच्च क्षमता प्रदर्शित की गई। अनुरोध सत्यापन और डेटा अखंडता के सिद्धांतों का सही उपयोग किया गया।',
        recommendations: [
          'उच्च समवर्ती भार के तहत डेटाबेस कनेक्शन पूल ट्यूनिंग का अधिक अभ्यास करें।',
          'सभी सेवाओं में वितरित ट्रेसिंग (Distributed Tracing) लागू करने पर विचार करें।',
        ],
      },
      {
        title: 'सुरक्षा और डेटा अनुपालन',
        content: 'न्यूनतम विशेषाधिकार के सिद्धांत, सख्त स्कीमा सत्यापन और सुरक्षित टाइमिंग-सेफ हस्ताक्षर सत्यापन का अनुपालन किया गया।',
        recommendations: [
          'स्वचालित निर्भरता सुरक्षा जांच को सीआई/सीडी पाइपलाइन में शामिल करें।',
        ],
      },
    ],
    scoreSummary: {
      totalScore: 88,
      maxPossibleScore: 100,
      percentage: 88,
      dimensionScores: {
        'सिस्टम डिजाइन': { score: 44, max: 50, percentage: 88 },
        'सुरक्षा': { score: 25, max: 25, percentage: 100 },
        'कोड गुणवत्ता': { score: 19, max: 25, percentage: 76 },
      },
    },
  };

  const htmlEn = renderReportHtml(sampleEn);
  const pdfEn = await defaultPdfRenderer.render(htmlEn);
  fs.writeFileSync(path.resolve(__dirname, '../sample-en.pdf'), pdfEn);
  console.log(`✓ Generated sample-en.pdf (${pdfEn.length} bytes)`);

  const htmlHi = renderReportHtml(sampleHi);
  const pdfHi = await defaultPdfRenderer.render(htmlHi);
  fs.writeFileSync(path.resolve(__dirname, '../sample-hi.pdf'), pdfHi);
  console.log(`✓ Generated sample-hi.pdf (${pdfHi.length} bytes)`);

  await defaultPdfRenderer.close();
  console.log('Sample PDF visual check generation complete.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error generating sample PDFs:', err);
    process.exit(1);
  });
}

