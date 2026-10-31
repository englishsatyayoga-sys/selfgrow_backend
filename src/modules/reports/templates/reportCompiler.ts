import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { getFontFacesCss } from './fonts';

const templatesDir = path.resolve(__dirname);

// Read and compile layouts and partials
const baseLayoutSrc = fs.readFileSync(path.join(templatesDir, 'layouts/base.hbs'), 'utf-8');
const baseEmailSrc = fs.readFileSync(path.join(templatesDir, 'emails/base.email.hbs'), 'utf-8');

const summaryPartialSrc = fs.readFileSync(path.join(templatesDir, 'partials/summary.hbs'), 'utf-8');
const sectionsPartialSrc = fs.readFileSync(path.join(templatesDir, 'partials/sections.hbs'), 'utf-8');
const breakdownPartialSrc = fs.readFileSync(path.join(templatesDir, 'partials/breakdown.hbs'), 'utf-8');

const emailEnSrc = fs.readFileSync(path.join(templatesDir, 'emails/released.en.hbs'), 'utf-8');
const emailHiSrc = fs.readFileSync(path.join(templatesDir, 'emails/released.hi.hbs'), 'utf-8');

// Register partials
Handlebars.registerPartial('summary', summaryPartialSrc);
Handlebars.registerPartial('sections', sectionsPartialSrc);
Handlebars.registerPartial('breakdown', breakdownPartialSrc);

// Precompile templates
const baseLayoutTemplate = Handlebars.compile(baseLayoutSrc);
const baseEmailTemplate = Handlebars.compile(baseEmailSrc);
const emailEnTemplate = Handlebars.compile(emailEnSrc);
const emailHiTemplate = Handlebars.compile(emailHiSrc);

// Precompile composite report body
const reportBodyTemplate = Handlebars.compile(`
  {{> summary}}
  {{> sections}}
  {{> breakdown}}
`);

export interface ReportRenderData {
  reportId: string;
  candidateName: string;
  assessmentTitle: string;
  language: 'EN' | 'HI';
  generatedDate: string;
  executiveSummary: string;
  sections: Array<{
    title: string;
    content: string;
    recommendations?: string[];
  }>;
  scoreSummary?: {
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    dimensionScores?: Record<
      string,
      { score: number; max: number; percentage: number }
    >;
  };
}

export function renderReportHtml(data: ReportRenderData): string {
  const isHi = data.language === 'HI';

  const viewData = {
    ...data,
    lang: isHi ? 'hi' : 'en',
    reportTypeLabel: isHi ? 'व्यापक मूल्यांकन रिपोर्ट' : 'Comprehensive Evaluation Report',
    candidateLabel: isHi ? 'उम्मीदवार' : 'Candidate',
    dateLabel: isHi ? 'दिनांक' : 'Date',
    summaryTitle: isHi ? 'कार्यकारी सारांश' : 'Executive Summary',
    scoreLabel: isHi ? 'कुल प्राप्तांक' : 'Overall Score',
    dimensionsTitle: isHi ? 'आयाम अनुसार विश्लेषण' : 'Dimension Breakdown',
    confidentialityNotice: isHi
      ? 'यह रिपोर्ट गोपनीय है और केवल अधिकृत उम्मीदवार के लिए तैयार की गई है।'
      : 'This report is strictly confidential and generated for the authorized candidate.',
  };

  const bodyContent = reportBodyTemplate(viewData);
  const fontCss = getFontFacesCss();

  return baseLayoutTemplate({
    ...viewData,
    fontCss,
    bodyContent,
  });
}

export interface ReleaseEmailData {
  candidateName: string;
  assessmentTitle: string;
  language: 'EN' | 'HI';
  downloadUrl: string;
}

export function renderReleaseEmail(data: ReleaseEmailData): { subject: string; html: string; text: string } {
  const isHi = data.language === 'HI';
  const innerHtml = isHi ? emailHiTemplate(data) : emailEnTemplate(data);
  const html = baseEmailTemplate({ bodyContent: innerHtml });

  const subject = isHi
    ? `आपकी मूल्यांकन रिपोर्ट तैयार है: ${data.assessmentTitle}`
    : `Your Assessment Report is Ready: ${data.assessmentTitle}`;

  const text = isHi
    ? `नमस्ते ${data.candidateName},\n\nआपकी ${data.assessmentTitle} मूल्यांकन रिपोर्ट जारी कर दी गई है।\nडाउनलोड करने के लिए इस लिंक पर जाएं:\n${data.downloadUrl}\n\nसादर,\nअसेसमेंट प्लेटफॉर्म टीम`
    : `Hello ${data.candidateName},\n\nYour assessment report for ${data.assessmentTitle} is now ready and released.\nDownload your PDF report here:\n${data.downloadUrl}\n\nBest regards,\nAssessment Platform Team`;

  return { subject, html, text };
}

