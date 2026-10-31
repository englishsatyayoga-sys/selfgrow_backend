import { PdfRenderer } from './PdfRenderer';
import { logger } from '../../config/logger';

export class PuppeteerPdfRenderer implements PdfRenderer {
  private browser: any = null;
  private browserPromise: Promise<any> | null = null;
  private activePages: number = 0;
  private maxPages: number;
  private waitQueue: Array<() => void> = [];

  constructor(maxConcurrentPages: number = 4) {
    this.maxPages = maxConcurrentPages;
  }

  private async getBrowser(): Promise<any> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.browserPromise) {
      return this.browserPromise;
    }

    this.browserPromise = (async () => {
      logger.info('Initializing Puppeteer headless browser instance...');
      const puppeteerModule = await import('puppeteer');
      const puppeteer = puppeteerModule.default || puppeteerModule;

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-first-run',
          '--no-zygote',
        ],
      });

      this.browser = browser;
      browser.on('disconnected', () => {
        logger.warn('Puppeteer browser instance disconnected');
        this.browser = null;
        this.browserPromise = null;
      });

      return browser;
    })();

    try {
      return await this.browserPromise;
    } finally {
      this.browserPromise = null;
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activePages < this.maxPages) {
      this.activePages++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activePages++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activePages--;
    if (this.waitQueue.length > 0 && this.activePages < this.maxPages) {
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    }
  }

  async render(html: string): Promise<Buffer> {
    await this.acquireSlot();
    const browser = await this.getBrowser();
    let page: any = null;

    try {
      page = await browser.newPage();

      // Zero-network enforcement: block any remote http/https requests
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const url = req.url();
        if (url.startsWith('data:') || url.startsWith('file:') || url === 'about:blank') {
          req.continue();
        } else {
          // Block external network calls
          req.abort();
        }
      });

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
      });

      // Wait for local @font-face fonts to be parsed and rendered
      await page.evaluateHandle('document.fonts.ready');

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      });

      return Buffer.from(pdfUint8Array);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Puppeteer PDF render failed');
      throw err;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (closeErr) {
          logger.warn({ error: closeErr }, 'Failed closing puppeteer page');
        }
      }
      this.releaseSlot();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        logger.info('Puppeteer browser closed cleanly');
      } catch (err) {
        logger.error({ error: err }, 'Error closing puppeteer browser');
      } finally {
        this.browser = null;
      }
    }
  }
}

