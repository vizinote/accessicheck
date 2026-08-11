/* AccessiCheck — interactions légères et mesures d'audience anonymes sur la landing page.
   Aucun cookie, aucune IP, aucun identifiant personnel n'est transmis. */
(function () {
  'use strict';

  var API_BASE = 'https://api.brozapi.com';

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

  // Formulaire de commande de diagnostic.
  var form = document.getElementById('order-form');
  var statusEl = document.getElementById('order-status');
  var submitBtn = document.getElementById('order-submit');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (statusEl) statusEl.textContent = '';

      var urlInput = document.getElementById('scan-url');
      var url = urlInput ? urlInput.value.trim() : '';
      if (!url || !/^https?:\/\/.+/i.test(url)) {
        if (statusEl) {
          statusEl.textContent = 'Merci d\'indiquer une adresse commençant par https://';
          statusEl.className = 'status-msg status-msg--err';
        }
        return;
      }

      // L'utilisateur déclenche une commande de scan.
      trackEvent('scan_triggered', '/');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Redirection vers Stripe…';
      }

      // Placeholder : les liens Stripe seront activés par Franck.
      setTimeout(function () {
        if (statusEl) {
          statusEl.innerHTML = 'Les paiements Stripe sont en cours d\'activation. <br>Merci de revenir d\'ici quelques heures, ou contactez-nous via la page Mentions légales.';
          statusEl.className = 'status-msg status-msg--err';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Commander le diagnostic — 29 €';
        }
      }, 600);
    });
  }
})();
