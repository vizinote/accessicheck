const { getBrowser } = require('../scanner');
const { renderOneShot, renderPro, renderMonitoring, normalizeLang } = require('./templates');

const RENDERERS = {
  oneshot: renderOneShot,
  pro: renderPro,
  monitoring: renderMonitoring,
};

async function generateReportHtml(scan, lang) {
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
  // Langue du rapport : paramètre explicite > champ scan.lang > français.
  const reportLang = normalizeLang(lang || normalized.lang || (normalized.result || {}).lang || 'fr');
  return renderer(normalized, reportLang);
}

async function generateReportPdf(scan, lang) {
  const html = await generateReportHtml(scan, lang);
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
