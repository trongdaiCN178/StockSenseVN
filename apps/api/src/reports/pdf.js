import { access } from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { ApiError } from '../errors.js';

const DISCLAIMER = 'Báo cáo chỉ cung cấp thông tin tham khảo, không phải khuyến nghị đầu tư. Dữ liệu có thể chậm hoặc chưa đầy đủ.';

export async function createPdfReport({ title, subtitle, sections }) {
  const fontPath = process.env.REPORT_FONT_PATH;
  if (!fontPath) throw new ApiError(503, 'REPORT_FONT_NOT_CONFIGURED', 'Set REPORT_FONT_PATH to a Unicode TrueType font (for Vietnamese PDF output).');
  try { await access(fontPath); }
  catch { throw new ApiError(503, 'REPORT_FONT_UNAVAILABLE', 'The configured report font file is unavailable.'); }

  const doc = new PDFDocument({ size: 'A4', margins: { top: 52, bottom: 52, left: 48, right: 48 }, bufferPages: true });
  doc.registerFont('StockSense', fontPath);
  doc.font('StockSense');

  const boldFontPath = process.env.REPORT_FONT_BOLD_PATH;
  if (boldFontPath) {
    try { await access(boldFontPath); doc.registerFont('StockSense-Bold', boldFontPath); }
    catch { /* fall back to the regular weight below */ }
  }
  const italicFontPath = process.env.REPORT_FONT_ITALIC_PATH;
  if (italicFontPath) {
    try { await access(italicFontPath); doc.registerFont('StockSense-Italic', italicFontPath); }
    catch { /* fall back to the regular weight below */ }
  }
  const boldFont = doc._fontFamilies?.['StockSense-Bold'] ? 'StockSense-Bold' : 'StockSense';
  const italicFont = doc._fontFamilies?.['StockSense-Italic'] ? 'StockSense-Italic' : 'StockSense';
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font(boldFont).fillColor('#087f6e').fontSize(10).text('STOCKSENSE VN');
  doc.font(boldFont).moveDown(0.7).fillColor('#132b3a').fontSize(22).text(title, { width: 500 });
  if (subtitle) doc.font(italicFont).moveDown(0.25).fillColor('#526575').fontSize(10).text(subtitle);
  doc.font('StockSense').moveDown(0.5).fillColor('#526575').fontSize(9).text(`Ngày tạo: ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}`);
  doc.moveDown(1);

  for (const section of sections) {
    if (doc.y > 700) doc.addPage();
    doc.font(boldFont).fillColor('#087f6e').fontSize(13).text(section.heading, { underline: false });
    doc.font('StockSense').moveDown(0.35).fillColor('#243744').fontSize(10);
    for (const line of section.lines) {
      doc.text(String(line ?? '—'), { width: 500, lineGap: 3 });
      doc.moveDown(0.15);
    }
    doc.moveDown(0.8);
  }

  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    const bottom = doc.page.height - 38;
    doc.moveTo(48, bottom - 12).lineTo(doc.page.width - 48, bottom - 12).strokeColor('#d9e2e7').stroke();
    doc.fillColor('#697d89').fontSize(8).text(DISCLAIMER, 48, bottom - 5, { width: 440, lineBreak: false });
    doc.text(`${page + 1}/${range.count}`, doc.page.width - 76, bottom - 5, { width: 28, align: 'right' });
  }
  doc.end();
  return finished;
}

export function formatReportValue(value) {
  if (value === null || value === undefined || value === '') return 'Chưa có dữ liệu';
  if (typeof value === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  if (value instanceof Date || /^\d{4}-\d{2}-\d{2}T/.test(String(value))) {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
  }
  return String(value);
}
