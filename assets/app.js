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

    if (scanForm) {
      scanForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = readScanInputs();
        if (!validUrl(input.url)) {
          setScanStatus('Merci d\'indiquer une adresse commençant par https://', true);
          return;
        }
        if (!validEmail(input.email)) {
          setScanStatus('Merci d\'indiquer un email valide pour recevoir le rapport.', true);
          return;
        }
        // Sépare explicitement la vérification gratuite de la commande payante.
        trackEvent('scan_entered', '/');
        var offers = document.getElementById('offres');
        if (offers) offers.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setScanStatus('Vérification enregistrée. Choisissez votre offre ci-dessous.', false);
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