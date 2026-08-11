const { getBrowser } = require('../scanner');
const { renderOneShot, renderPro, renderMonitoring } = require('./templates');

const RENDERERS = {
  oneshot: renderOneShot,
  pro: renderPro,
  monitoring: renderMonitoring,
};

async function generateReportHtml(scan) {
  const offer = scan.offer || 'oneshot';
  const renderer = RENDERERS[offer];
  if (!renderer) {
    throw new Error(`Offre de rapport inconnue : ${offer}`);
  }
  const normalized = { ...scan };
  if (typeof normalized.result === 'string') {
    try {
      normalized.result = JSON.parse(normalized.result);
    } catch (err) {
      throw new Error('Résultat de scan invalide (JSON cassé).');
    }
  }
  return renderer(normalized);
}

async function generateReportPdf(scan) {
  const html = await generateReportHtml(scan);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

module.exports = {
  generateReportHtml,
  generateReportPdf,
};
