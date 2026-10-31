import fs from 'fs';
import path from 'path';

let cachedFontCss: string | null = null;

export function getFontFacesCss(): string {
  if (cachedFontCss) {
    return cachedFontCss;
  }

  const fontsDir = path.resolve(__dirname, '../../../assets/fonts');

  const regularLatin = fs.readFileSync(path.join(fontsDir, 'NotoSans-Regular.woff')).toString('base64');
  const boldLatin = fs.readFileSync(path.join(fontsDir, 'NotoSans-Bold.woff')).toString('base64');
  const regularDevanagari = fs.readFileSync(path.join(fontsDir, 'NotoSansDevanagari-Regular.woff')).toString('base64');
  const boldDevanagari = fs.readFileSync(path.join(fontsDir, 'NotoSansDevanagari-Bold.woff')).toString('base64');

  cachedFontCss = `
    @font-face {
      font-family: 'Noto Sans';
      font-style: normal;
      font-weight: 400;
      src: url('data:font/woff;base64,${regularLatin}') format('woff');
    }
    @font-face {
      font-family: 'Noto Sans';
      font-style: normal;
      font-weight: 700;
      src: url('data:font/woff;base64,${boldLatin}') format('woff');
    }
    @font-face {
      font-family: 'Noto Sans Devanagari';
      font-style: normal;
      font-weight: 400;
      src: url('data:font/woff;base64,${regularDevanagari}') format('woff');
    }
    @font-face {
      font-family: 'Noto Sans Devanagari';
      font-style: normal;
      font-weight: 700;
      src: url('data:font/woff;base64,${boldDevanagari}') format('woff');
    }
  `;

  return cachedFontCss;
}

