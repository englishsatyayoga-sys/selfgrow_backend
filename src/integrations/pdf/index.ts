import { PdfRenderer } from './PdfRenderer';
import { PuppeteerPdfRenderer } from './puppeteer.pdf';

export * from './PdfRenderer';
export * from './puppeteer.pdf';

export const defaultPdfRenderer: PdfRenderer = new PuppeteerPdfRenderer();

