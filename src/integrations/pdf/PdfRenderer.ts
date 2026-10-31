export interface PdfRenderer {
  render(html: string): Promise<Buffer>;
  close(): Promise<void>;
}

