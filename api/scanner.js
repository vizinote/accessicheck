const crypto = require('crypto');
const { URL } = require('url');

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

function normalizeUrl(url) {
  url = (url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

function isPrivateUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname)) return true;
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      const second = parseInt(hostname.split('.')[1], 10);
      if (hostname.startsWith('172.') && second >= 16 && second <= 31) return true;
      if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function validateUrl(url) {
  if (!url) return 'URL manquante.';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Protocole non autorisé.';
    if (isPrivateUrl(url)) return 'Adresse locale ou privée non autorisée.';
    if (!parsed.hostname || !parsed.hostname.includes('.')) return 'Nom de domaine invalide.';
  } catch {
    return 'URL invalide.';
  }
  return null;
}

module.exports = {
  generateId,
  normalizeUrl,
  validateUrl,
};
