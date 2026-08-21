/* AccessiCheck — interactions légères, commande AccessiCheck et mesures d'audience anonymes.
   Aucun cookie, aucune IP, aucun identifiant personnel n'est transmis hors du formulaire de commande. */
(function () {
  'use strict';

  var API_BASE = 'https://api.brozapi.com';

  // Liens de paiement Stripe AccessiCheck (créés par Franck, compte Stripe Brozapi).
  var PAYMENT_LINKS = {
    oneshot: 'https://buy.stripe.com/00w5kx2cxccR7tN1ZbcZa06',
    pro: 'https://buy.stripe.com/9B6cMZ2cx7WB9BV1ZbcZa07',
    monitoring: 'https://buy.stripe.com/cNi5kxcRbekZ01l8nzcZa08'
  };

  var OFFER_LABELS = {
    oneshot: '29 €',
    pro: '49 €',
    monitoring: '9 €/mois'
  };

  /**
   * Envoie un événement de mesure d'audience anonyme à api.brozapi.com/track.
   * product est toujours 'accessicheck' pour ce site.
   */
  function trackEvent(event, path) {
    try {
      var payload = JSON.stringify({
        product: 'accessicheck',
        event: event,
        path: path || '/'
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          API_BASE + '/track',
          new Blob([payload], { type: 'application/json' })
        );
      } else if (typeof fetch === 'function') {
        fetch(API_BASE + '/track', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: payload
        }).catch(function () {});
      }
    } catch (e) {
      // silencieux : la mesure ne doit jamais bloquer le site
    }
  }

  // Page vue dès que le script est exécuté (defer → DOM prêt).
  trackEvent('pageview', location.pathname || '/');

  // Paiement confirmé si l'utilisateur revient d'une session Stripe en succès.
  if (/[?&](payment=success|checkout=success)(?:&|$)/.test(location.search)) {
    if (!sessionStorage.getItem('ac_payment_tracked')) {
      sessionStorage.setItem('ac_payment_tracked', '1');
      trackEvent('payment_confirmed', location.pathname || '/');
    }
  }

  // Clics sur les CTA d'achat (data-track dans index.html).
  document.querySelectorAll('[data-track]').forEach(function (el) {
    el.addEventListener('click', function () {
      trackEvent(el.getAttribute('data-track'), location.pathname || '/');
    });
  });

  // Formulaire scanner : scan gratuit (URL + email). Pas d'ordre ici :
    // la commande se fait uniquement via les cartes #offres.
    var scanForm = document.getElementById('scan-form');
    var scanStatus = document.getElementById('scan-status');
    var scanSubmit = document.getElementById('scan-submit');

    function readScanInputs() {
      var urlInput = document.getElementById('scan-url');
      var emailInput = document.getElementById('scan-email');
      return {
        url: urlInput ? urlInput.value.trim() : '',
        email: emailInput ? emailInput.value.trim() : ''
      };
    }

    function validUrl(url) {
      return /^https?:\/\/.+/i.test(url);
    }

    function validEmail(email) {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    }

    function setScanStatus(text, isError) {
      if (!scanStatus) return;
      scanStatus.textContent = text;
      scanStatus.className = 'status-msg' + (isError ? ' status-msg--err' : ' status-msg--ok');
    }

    var scanResults = document.getElementById('scan-results');
    var lastScanId = '';

    function scoreColor(score) {
      if (score >= 90) return '#15803d';
      if (score >= 70) return '#ca8a04';
      return '#b91c1c';
    }

    function scoreLabel(score) {
      if (score >= 90) return 'Bon';
      if (score >= 70) return 'À améliorer';
      return 'À corriger en priorité';
    }

    function renderScanResult(data) {
      if (!scanResults) return;
      var result = data && data.result ? data.result : {};
      var score = typeof result.score === 'number' ? result.score : 0;
      var issues = (result.issues || []).slice(0, 5);
      var color = scoreColor(score);
      var label = scoreLabel(score);
      var html = '<div class="scan-result">';
      html += '<div class="scan-result__score" style="--score-color:' + color + ';">';
      html += '<span class="scan-result__value" style="color:' + color + ';">' + score + '<small>/100</small></span>';
      html += '<span class="scan-result__label">' + label + '</span>';
      html += '</div>';
      html += '<p class="scan-result__url">' + (result.url || '').replace(/</g, '&lt;') + '</p>';
      if (issues.length > 0) {
        html += '<h3>Problèmes prioritaires détectés</h3><ul class="scan-result__issues">';
        issues.forEach(function (issue) {
          var impact = (issue.impact || issue.type || 'notice').toLowerCase();
          var impactClass = 'impact-' + impact;
          var impactLabel = impact === 'serious' || impact === 'critical' || impact === 'error' ? 'Important' :
                            impact === 'moderate' || impact === 'warning' ? 'Moyen' : 'À vérifier';
          html += '<li><span class="impact-pill ' + impactClass + '">' + impactLabel + '</span> ' +
                  (issue.message || '').replace(/</g, '&lt;') + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p class="scan-result__good">Aucun problème automatiquement détecté. Pensez tout de même à un audit humain pour valider la conformité RGAA complète.</p>';
      }
      html += '<a class="btn btn--primary" href="#offres" data-track="click_scan_cta_offres">Recevoir le rapport complet avec corrections détaillées — 29 €</a>';
      html += '<p class="scan-result__note">Ce scan gratuit couvre les critères automatiquement testables. Le rapport payant ajoute le code de correction et un résumé pour le dirigeant.</p>';
      html += '</div>';
      scanResults.innerHTML = html;
      scanResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function pollScan(id) {
      var attempts = 0;
      var maxAttempts = 60;
      var timer = setInterval(function () {
        attempts += 1;
        fetch(API_BASE + '/accessicheck/scan/' + encodeURIComponent(id), {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok) {
              clearInterval(timer);
              setScanStatus(data && data.error ? data.error : 'Le scan a échoué.', true);
              if (scanSubmit) scanSubmit.disabled = false;
              return;
            }
            if (data.status === 'done') {
              clearInterval(timer);
              setScanStatus('Scan terminé.', false);
              if (scanSubmit) scanSubmit.disabled = false;
              renderScanResult(data);
              trackEvent('scan_done_free', '/');
              return;
            }
            if (data.status === 'failed') {
              clearInterval(timer);
              setScanStatus(data.error || 'Le scan a échoué.', true);
              if (scanSubmit) scanSubmit.disabled = false;
              return;
            }
            if (attempts >= maxAttempts) {
              clearInterval(timer);
              setScanStatus('Le scan prend plus de temps que prévu. Rechargez la page ou choisissez une offre ci-dessous.', true);
              if (scanSubmit) scanSubmit.disabled = false;
            }
          })
          .catch(function () {
            clearInterval(timer);
            setScanStatus('Erreur de connexion au serveur de scan.', true);
            if (scanSubmit) scanSubmit.disabled = false;
          });
      }, 2000);
    }

    if (scanForm) {
      scanForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = readScanInputs();
        if (!validUrl(input.url)) {
          setScanStatus('Merci d\’indiquer une adresse commençant par https://', true);
          return;
        }
        if (!validEmail(input.email)) {
          setScanStatus('Merci d\’indiquer un email valide pour recevoir le rapport.', true);
          return;
        }
        if (scanSubmit) scanSubmit.disabled = true;
        setScanStatus('Lancement du scan gratuit…', false);
        if (scanResults) scanResults.innerHTML = '';
        trackEvent('scan_entered', '/');

        fetch(API_BASE + '/accessicheck/free-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: input.url })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok || !data.id) {
              throw new Error((data && data.error) || 'Erreur de lancement du scan.');
            }
            lastScanId = data.id;
            setScanStatus('Scan en cours, cela peut prendre jusqu\’à 60 secondes…', false);
            pollScan(data.id);
          })
          .catch(function (err) {
            setScanStatus(err.message || 'Impossible de lancer le scan.', true);
            if (scanSubmit) scanSubmit.disabled = false;
          });
      });
    }

    // Cartes #offres = SEULS points de paiement. Un clic enregistre la commande
    // (URL + email + offre) puis ouvre Stripe.
    document.querySelectorAll('[data-offer]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var offer = el.getAttribute('data-offer');
        var input = readScanInputs();
        if (!validUrl(input.url)) {
          setScanStatus('Commencez par saisir votre adresse de site (https://…).', true);
          var scanner = document.getElementById('scanner');
          if (scanner) scanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (!validEmail(input.email)) {
          setScanStatus('Commencez par saisir votre email pour recevoir le rapport.', true);
          var scanner2 = document.getElementById('scanner');
          if (scanner2) scanner2.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (!PAYMENT_LINKS[offer]) {
          setScanStatus('Offre inconnue.', true);
          return;
        }
        setScanStatus('Préparation du paiement…', false);
        el.setAttribute('aria-disabled', 'true');
        trackEvent('scan_triggered_' + offer, '/');
        fetch(API_BASE + '/accessicheck/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: input.url, email: input.email, offer: offer })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok) {
              throw new Error((data && data.error) || 'Erreur de commande.');
            }
            var paymentUrl = PAYMENT_LINKS[offer] + '?prefilled_email=' + encodeURIComponent(input.email);
            window.location.href = paymentUrl;
          })
          .catch(function (err) {
            el.removeAttribute('aria-disabled');
            setScanStatus('Impossible de préparer le paiement : ' + err.message + ' Contactez-nous via la page Mentions légales.', true);
          });
      });
    });

  // Formulaire lead magnet : guide gratuit EAA/RGAA.
  var guideForm = document.getElementById('guide-form');
  if (guideForm) {
    guideForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailInput = document.getElementById('guide-email');
      var consentInput = document.getElementById('guide-consent');
      var guideStatus = document.getElementById('guide-status');
      var guideSubmit = guideForm.querySelector('button[type="submit"]');
      var originalText = guideSubmit ? guideSubmit.textContent : 'Recevoir le guide';

      var email = emailInput ? emailInput.value.trim() : '';
      var consent = consentInput ? consentInput.checked : false;

      function setGuideStatus(text, isError) {
        if (!guideStatus) return;
        guideStatus.textContent = text;
        guideStatus.className = 'status-msg' + (isError ? ' status-msg--error' : ' status-msg--success');
      }

      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setGuideStatus('Veuillez saisir une adresse email valide.', true);
        if (emailInput) emailInput.focus();
        return;
      }
      if (!consent) {
        setGuideStatus('Vous devez accepter la politique de confidentialité.', true);
        if (consentInput) consentInput.focus();
        return;
      }

      if (guideSubmit) {
        guideSubmit.disabled = true;
        guideSubmit.textContent = 'Envoi en cours…';
      }

      fetch(API_BASE + '/accessicheck/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email, consent: true })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.ok) {
            throw new Error((data && data.error) || 'Réessayez dans quelques instants.');
          }
          setGuideStatus('Merci ! Le guide vous a été envoyé par email.', false);
          trackEvent('download_guide', location.pathname || '/');
          if (emailInput) emailInput.value = '';
          if (consentInput) consentInput.checked = false;
        })
        .catch(function (err) {
          setGuideStatus(err.message || 'Réessayez dans quelques instants.', true);
        })
        .finally(function () {
          if (guideSubmit) {
            guideSubmit.disabled = false;
            guideSubmit.textContent = originalText;
          }
        });
    });
  }
})();