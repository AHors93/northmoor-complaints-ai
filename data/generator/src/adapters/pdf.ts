import type { PolicyDoc } from '@northmoor/shared';
import PDFDocument from 'pdfkit';

/** Renders the markdown subset the policies use: headings, paragraphs and bullet lists. */
export function renderPolicyPdf(policy: PolicyDoc, markdown: string): Promise<Buffer> {
  // PDFKit stamps the current time and derives the file id from it. A fixed date keeps the
  // bytes identical on every run.
  const date = new Date(`${policy.effectiveDate}T00:00:00Z`);
  const pdf = new PDFDocument({
    size: 'A4',
    margin: 64,
    info: { Title: policy.title, Author: 'Northmoor Lending', CreationDate: date, ModDate: date },
  });
  const done = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    pdf.on('error', reject);
  });
  for (const block of markdown.trim().split(/\n{2,}/)) {
    if (block.startsWith('## ')) {
      pdf.moveDown(0.5).font('Helvetica-Bold').fontSize(14).text(block.slice(3));
    } else if (block.startsWith('# ')) {
      pdf.font('Helvetica-Bold').fontSize(20).text(block.slice(2));
    } else {
      pdf.font('Helvetica').fontSize(11);
      const items = block.startsWith('- ')
        ? block.split(/\n(?=- )/).map((item) => `• ${item.slice(2)}`)
        : [block];
      for (const item of items) pdf.text(item.replaceAll(/\s*\n\s*/g, ' '));
    }
    pdf.moveDown(0.5);
  }
  pdf.end();
  return done;
}
