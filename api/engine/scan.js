'use strict';

const pa11y = require('pa11y');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.SCAN_TIMEOUT || '30000', 10);
const DEFAULT_RETRIES = parseInt(process.env.MAX_RETRIES || '2', 10) - 1; // -1 car la boucle fait attempt=0..DEFAULT_RETRIES

const VALID_OFFERS = new Set(['oneshot', 'pro', 'monitoring']);

const BLOCKING_KEYWORDS = [
	'captcha', 'recaptcha', 'g-recaptcha', 'hcaptcha',
	'cloudflare', 'ddos-guard', 'ddos', 'bot detection',
	'security check', 'verify you are human', 'are you a robot',
	'access denied', 'forbidden'
];

const LOGIN_KEYWORDS = [
	'login', 'log in', 'sign in', 'connexion', 'connectez-vous',
	'mot de passe', 'password', 'identifier', 'authentification',
	'authentication', 'auth', 'signin', 'login-form'
];

const CATEGORIES = {
	contrast: { label: 'Contrastes WCAG AA' },
	imagesAlt: { label: 'Images sans alternative textuelle' },
	headings: { label: 'Structure de titres (h1-h6)' },
	forms: { label: 'Formulaires (labels, champs requis)' },
	language: { label: 'Langue de la page' },
	landmarks: { label: 'Landmarks ARIA' },
	names: { label: 'Noms accessibles des boutons et liens' }
};

const AXE_RULE_TO_CATEGORY = {
	'color-contrast': 'contrast',
	'image-alt': 'imagesAlt',
	'role-img-alt': 'imagesAlt',
	'heading-order': 'headings',
	'page-has-heading-one': 'headings',
	'empty-heading': 'headings',
	'label': 'forms',
	'select-required': 'forms',
	'form-field-multiple-labels': 'forms',
	'label-title-only': 'forms',
	'label-content-name-mismatch': 'forms',
	'html-has-lang': 'language',
	'html-lang-valid': 'language',
	'html-xml-lang-mismatch': 'language',
	'valid-lang': 'language',
	'region': 'landmarks',
	'landmark-one-main': 'landmarks',
	'banner-is-top-level': 'landmarks',
	'complementary-landmark': 'landmarks',
	'contentinfo-landmark': 'landmarks',
	'main-landmark': 'landmarks',
	'navigation-landmark': 'landmarks',
	'button-name': 'names',
	'link-name': 'names',
	'input-button-name': 'names',
	'input-image-alt': 'names'
};

const PA11Y_CODE_TO_CATEGORY = [
	{ test: (code) => /G18|G145|F24/.test(code), category: 'contrast' },
	{ test: (code) => /H37|H36|H67|F65|ARIA6/.test(code), category: 'imagesAlt' },
	{ test: (code) => /H42|G130|G141|H69|H80/.test(code), category: 'headings' },
	{ test: (code) => /H44|H49|H71|H91|F68|ARIA1|ARIA9|ARIA13|ARIA14/.test(code), category: 'forms' },
	{ test: (code) => /H57|H58/.test(code), category: 'language' },
	{ test: (code) => /ARIA11|ARIA12|ARIA13|ARIA14|ARIA20|ARIA6/.test(code), category: 'landmarks' },
	{ test: (code) => /H30|H91|ARIA4|ARIA5|ARIA7|ARIA8|ARIA9|ARIA10/.test(code), category: 'names' }
];

function validateOffer(offer) {
	if (!offer) return 'Offre manquante.';
	if (!VALID_OFFERS.has(offer)) return `Offre inconnue : ${offer}. Valeurs acceptées : ${Array.from(VALID_OFFERS).join(', ')}.`;
	return null;
}

function emptyResults() {
	const results = {};
	for (const key of Object.keys(CATEGORIES)) {
		results[key] = { count: 0, issues: [] };
	}
	return results;
}

function isNetworkError(error) {
	const msg = (error && error.message) || String(error);
	return /(ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|ERR_NETWORK|ERR_CONNECTION|Navigation timeout|net::ERR|TimeoutError)/i.test(msg);
}

function normalizeAxeTarget(target) {
	if (Array.isArray(target)) {
		return target.map(t => (Array.isArray(t) ? t.join(' ') : String(t))).join(', ');
	}
	return String(target);
}

function pa11yIssueToCategory(code) {
	for (const mapping of PA11Y_CODE_TO_CATEGORY) {
		if (mapping.test(code)) return mapping.category;
	}
	return null;
}

function computeScore(results) {
	let total = 0;
	for (const key of Object.keys(CATEGORIES)) {
		total += results[key].count;
	}
	return Math.max(0, 100 - total * 2);
}

function categorizeResults(axeResults, pa11yResults) {
	const results = emptyResults();

	if (axeResults && axeResults.violations) {
		for (const violation of axeResults.violations) {
			const category = AXE_RULE_TO_CATEGORY[violation.id];
			if (!category) continue;
			for (const node of violation.nodes) {
				results[category].issues.push({
					source: 'axe-core',
					rule: violation.id,
					impact: node.impact || violation.impact || 'unknown',
					message: `${violation.help}. ${node.failureSummary || ''}`.trim(),
					selector: normalizeAxeTarget(node.target),
					helperUrl: violation.helpUrl
				});
				results[category].count += 1;
			}
		}
	}

	if (pa11yResults && pa11yResults.issues) {
		for (const issue of pa11yResults.issues) {
			const category = pa11yIssueToCategory(issue.code);
			if (!category) continue;
			results[category].issues.push({
				source: 'pa11y',
				code: issue.code,
				type: issue.type,
				message: issue.message,
				selector: issue.selector,
				context: issue.context
			});
			results[category].count += 1;
		}
	}

	return results;
}

function makeFailedResult(input, errorType, message, detail = {}) {
	const results = emptyResults();
	return {
		status: 'failed',
		url: input.url,
		offre: input.offre,
		scannedAt: new Date().toISOString(),
		durationMs: 0,
		errorType,
		message,
		detail,
		results,
		score: computeScore(results),
		raw: {}
	};
}

async function detectBlocking(page, response) {
	return page.evaluate((blockingKeywords, loginKeywords) => {
		function generateSelector(el) {
			if (el.id) return `#${CSS.escape(el.id)}`;
			const tag = el.tagName.toLowerCase();
			let node = el;
			const parts = [];
			while (node && node.nodeType === Node.ELEMENT_NODE) {
				let part = node.tagName.toLowerCase();
				if (node.id) {
					part += `#${CSS.escape(node.id)}`;
					parts.unshift(part);
					break;
				}
				const parent = node.parentElement;
				if (parent) {
					const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
					if (siblings.length > 1) {
						const index = siblings.indexOf(node) + 1;
						part += `:nth-of-type(${index})`;
					}
				}
				parts.unshift(part);
				node = parent;
			}
			return parts.join(' > ');
		}

		const html = document.documentElement ? document.documentElement.innerHTML.toLowerCase() : '';
		const title = (document.title || '').toLowerCase();
		const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
		const hasPassword = !!document.querySelector('input[type="password"]');
		const loginInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[name*="user" i], input[name*="login" i], input[id*="user" i], input[id*="login" i]'));
		const blockingKeyword = blockingKeywords.find(k => html.includes(k) || title.includes(k));
		const loginKeyword = loginKeywords.find(k => bodyText.includes(k) || title.includes(k));

		const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
			level: parseInt(h.tagName[1], 10),
			text: h.innerText.trim().slice(0, 200),
			selector: generateSelector(h)
		}));

		const lang = document.documentElement ? (document.documentElement.lang || document.documentElement.getAttribute('xml:lang')) : null;

		const landmarks = Array.from(document.querySelectorAll('main, nav, aside, header, footer, section, article, [role]')).map(el => ({
			role: el.getAttribute('role') || el.tagName.toLowerCase(),
			selector: generateSelector(el)
		})).filter(l => ['main','navigation','complementary','banner','contentinfo','search','region','article','section'].includes(l.role));

		return {
			title: document.title || null,
			lang,
			blockingKeyword: blockingKeyword || null,
			loginKeyword: loginKeyword || null,
			hasPassword,
			hasLoginInput: loginInputs.length > 0,
			headings,
			landmarks
		};
	}, BLOCKING_KEYWORDS, LOGIN_KEYWORDS);
}

function trimAxeRaw(axeResults) {
	if (!axeResults) return null;
	return {
		testEngine: axeResults.testEngine,
		testRunner: axeResults.testRunner,
		testEnvironment: axeResults.testEnvironment,
		violations: axeResults.violations,
		incomplete: axeResults.incomplete,
		inapplicable: axeResults.inapplicable && axeResults.inapplicable.map(r => ({
			id: r.id,
			impact: r.impact,
			help: r.help,
			helpUrl: r.helpUrl,
			nodes: (r.nodes || []).length
		})),
		passes: axeResults.passes ? axeResults.passes.length : 0
	};
}

async function runScan(input, positionalOffer, log) {
	const start = Date.now();

	// Support des deux signatures : runScan({ url, offre }) et runScan(url, offre, log)
	let url, offre, timeoutMs, logger;
	if (input && typeof input === 'object' && !(input instanceof String)) {
		url = input.url;
		offre = input.offre;
		timeoutMs = input.timeout;
		logger = positionalOffer;
	} else {
		url = input;
		offre = positionalOffer;
		logger = log;
	}

	logger = logger || (() => {});
	offre = offre || 'oneshot';
	timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;

	if (!url || typeof url !== 'string') {
		return makeFailedResult({ url, offre }, 'runtime', 'URL manquante ou invalide');
	}

	const offerError = validateOffer(offre);
	if (offerError) {
		return makeFailedResult({ url, offre }, 'runtime', offerError);
	}

	let browser;
	try {
		logger('debug', 'lancement navigateur');
		browser = await puppeteer.launch({
			headless: true,
			executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu',
				'--disable-web-security',
				'--disable-features=IsolateOrigins,site-per-process'
			]
		});

		const page = await browser.newPage();
		page.setDefaultNavigationTimeout(timeoutMs);
		page.setDefaultTimeout(timeoutMs);
		await page.setBypassCSP(true);

		// Navigation avec retry
		let response;
		let lastNavError;
		for (let attempt = 0; attempt <= DEFAULT_RETRIES; attempt++) {
			try {
				logger('debug', `navigation tentative ${attempt + 1}/${DEFAULT_RETRIES + 1}`);
				response = await page.goto(url, {
					waitUntil: 'networkidle2',
					timeout: timeoutMs
				});
				lastNavError = null;
				break;
			} catch (err) {
				lastNavError = err;
				logger('warn', 'échec navigation', err.message);
				if (!isNetworkError(err) || attempt === DEFAULT_RETRIES) {
					throw err;
				}
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		if (!response && lastNavError) {
			throw lastNavError;
		}

		const finalUrl = page.url();
		const httpStatus = response ? response.status() : null;

		logger('debug', 'détection blocage / authentification');
		const pageInfo = await detectBlocking(page, response);

		if (httpStatus && httpStatus >= 401 && httpStatus <= 403) {
			return makeFailedResult({ url, offre }, 'blocked', `Page protégée (HTTP ${httpStatus})`, {
				status: httpStatus,
				finalUrl,
				...pageInfo
			});
		}

		if (pageInfo.blockingKeyword) {
			return makeFailedResult({ url, offre }, 'blocked', 'Page bloquée par protection anti-bot / captcha / pare-feu', {
				status: httpStatus,
				finalUrl,
				...pageInfo
			});
		}

		if (pageInfo.hasPassword && pageInfo.loginKeyword) {
			return makeFailedResult({ url, offre }, 'blocked', 'Page protégée par authentification', {
				status: httpStatus,
				finalUrl,
				...pageInfo
			});
		}

		logger('debug', 'analyse axe-core');
		const axeResults = await new AxePuppeteer(page).analyze();

		logger('debug', 'analyse pa11y');
		let pa11yResults = null;
		let pa11yError = null;
		try {
			// Essai HTML_CodeSniffer (runner par défaut de pa11y)
			pa11yResults = await pa11y(finalUrl, {
				browser: browser,
				timeout: timeoutMs,
				standard: 'WCAG2AA'
			});
		} catch (err) {
			logger('warn', 'pa11y htmlcs a échoué, tentative avec runner axe', err.message);
			try {
				pa11yResults = await pa11y(finalUrl, {
					browser: browser,
					timeout: timeoutMs,
					standard: 'WCAG2AA',
					runners: ['axe']
				});
			} catch (err2) {
				pa11yError = err2.message;
				logger('error', 'pa11y a échoué avec les deux runners', pa11yError);
			}
		}

		const results = categorizeResults(axeResults, pa11yResults);

		// Enrichissement catégories spécifiques
		results.headings.structure = pageInfo.headings || [];
		if (!results.headings.count && pageInfo.headings && pageInfo.headings.length === 0) {
			results.headings.issues.push({
				source: 'accessicheck',
				message: 'Aucun titre (h1-h6) détecté sur la page',
				selector: 'html > body'
			});
			results.headings.count += 1;
		}

		results.language.detected = pageInfo.lang || null;
		if (!pageInfo.lang) {
			results.language.issues.push({
				source: 'accessicheck',
				message: "Aucune langue déclarée sur l'élément <html>",
				selector: 'html'
			});
			results.language.count += 1;
		}

		results.landmarks.detected = pageInfo.landmarks || [];

		const durationMs = Date.now() - start;
		const score = computeScore(results);

		return {
			status: 'done',
			url: finalUrl,
			offre,
			scannedAt: new Date().toISOString(),
			durationMs,
			httpStatus,
			score,
			results,
			raw: {
				axe: trimAxeRaw(axeResults),
				pa11y: pa11yResults ? {
					pageUrl: pa11yResults.pageUrl,
					documentTitle: pa11yResults.documentTitle,
					issues: pa11yResults.issues
				} : { error: pa11yError || 'Résultat pa11y indisponible' }
			}
		};
	} catch (err) {
		const durationMs = Date.now() - start;
		const results = emptyResults();
		return {
			status: 'failed',
			url,
			offre,
			scannedAt: new Date().toISOString(),
			durationMs,
			errorType: isNetworkError(err) ? 'network' : 'runtime',
			message: err.message,
			detail: { stack: err.stack },
			results,
			score: computeScore(results),
			raw: {}
		};
	} finally {
		if (browser) {
			try { await browser.close(); } catch {}
		}
	}
}

module.exports = { runScan, validateOffer };

// Exécution CLI depuis api/engine/scan.js
if (require.main === module) {
	(async () => {
		const targetUrl = process.argv[2];
		const offre = process.argv[3] || 'oneshot';
		if (!targetUrl) {
			console.error('Usage: node engine/scan.js <url> [offre]');
			process.exit(1);
		}
		const output = await runScan({ url: targetUrl, offre });
		console.log(JSON.stringify(output, null, 2));
	})();
}
