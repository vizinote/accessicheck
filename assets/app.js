/* AccessiCheck — interactions légères sur la landing page */
(function () {
  'use strict';

  var form = document.getElementById('order-form');
  var statusEl = document.getElementById('order-status');
  var submitBtn = document.getElementById('order-submit');

  if (!form) return;

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

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Redirection vers Stripe…';
    }

    // Placeholder : les liens Stripe seront activés par Franck.
    // On envoie une pageview anonyme si le endpoint /track existe.
    if (typeof fetch === 'function') {
      fetch('https://api.brozapi.com/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'begin_checkout', product: 'accessicheck', url: url }),
        keepalive: true
      }).catch(function () {});
    }

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
})();
