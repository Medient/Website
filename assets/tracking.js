/*
 * Medient tracking: loaded in the <head> of every landing and thank-you page.
 *
 * Fill in the IDs below; nothing else needs changing. Leave an ID empty and
 * that tool simply isn't loaded.
 *
 *   GTM_ID      Google Tag Manager container, e.g. 'GTM-ABC1234'.
 *               GA4, Google Ads (conversion + remarketing) and Meta are set
 *               up inside GTM by the marketing team, using the events below.
 *   CLARITY_ID  Microsoft Clarity project id (only loads after consent).
 *   META_PIXEL  Meta (Facebook/Instagram) Pixel id. Loads only after the visitor
 *               accepts cookies. Sends PageView, and SubmitApplication (same
 *               event the WordPress site uses) when the form is sent. It lives
 *               here, not in GTM, because the WordPress site loads its own pixel
 *               through a plugin and GTM runs on both sites.
 *
 * Consent (UK GDPR / PECR): Google Consent Mode v2 starts with everything
 * denied except security. The banner lets visitors accept or reject, and the
 * choice is remembered. Google tags in GTM respect it automatically.
 *
 * dataLayer events pushed by the pages (for GTM triggers):
 *   form_start        first answer in the qualifier          {course}
 *   form_step         each question reached                  {course, step}
 *   form_disqualified budget too low / needs a loan          {course, reason}
 *   generate_lead     form sent successfully                 {course, country, lead_tier, lead_score, value, currency, lead_id, user_data}
 *   lead_thank_you    thank-you page view after a lead       same fields as generate_lead
 *   cta_click / whatsapp_click                               {label}
 *   cookie_consent_update                                    {analytics, ads}
 * user_data carries email, phone_number (E.164) and first/last name for Google
 * Ads enhanced conversions. Turn on "Include user-provided data" in the Ads tag.
 */
(function () {
  var GTM_ID = 'GTM-TRWMG8D';
  var CLARITY_ID = 'z921tuu5ej';
  var META_PIXEL = '307614630031962';

  var KEY = 'medient_consent_v1';
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}

  function apply(c, fromBanner) {
    gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.ads ? 'granted' : 'denied',
      ad_user_data: c.ads ? 'granted' : 'denied',
      ad_personalization: c.ads ? 'granted' : 'denied'
    });
    if (c.ads) gtag('set', 'ads_data_redaction', false);
    dataLayer.push({ event: 'cookie_consent_update', analytics: !!c.analytics, ads: !!c.ads, consent_source: fromBanner ? 'banner' : 'saved' });
    if (c.analytics) loadClarity(); else if (window.clarity) clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
    if (c.ads) loadPixel(); else if (window.fbq) fbq('consent', 'revoke');
  }
  if (saved) apply(saved, false);

  // Google Tag Manager
  if (GTM_ID) {
    dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    document.head.appendChild(s);
  }

  var clarityLoaded = false;
  function loadClarity() {
    if (!CLARITY_ID) return; if (clarityLoaded) { clarity('consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' }); return; } clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
    // UK/EEA visitors: tell Clarity consent was given, so it can use cookies and
    // join up a visitor's sessions. Form fields are masked by Clarity by default.
    clarity('consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' });
  }

  var pixelLoaded = false;
  function loadPixel() {
    if (!META_PIXEL) return;
    if (pixelLoaded) { fbq('consent', 'grant'); return; }
    pixelLoaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL);
    fbq('track', 'PageView');
  }

  // Called by the form once a lead is saved. Sends SubmitApplication to Meta
  // (only if the visitor accepted cookies), with the lead id for de-duplication.
  // Meta hashes the email/phone/name in the browser before sending them.
  window.medientPixelLead = function (lead) {
    if (!pixelLoaded || !window.fbq || !lead) return;
    var u = lead.user_data || {}, a = u.address || {};
    fbq('init', META_PIXEL, {
      em: u.email || undefined, ph: (u.phone_number || '').replace(/\D/g, '') || undefined,
      fn: (a.first_name || '').toLowerCase() || undefined, ln: (a.last_name || '').toLowerCase() || undefined, country: 'gb'
    });
    fbq('track', 'SubmitApplication', {
      value: lead.value, currency: lead.currency || 'GBP', content_name: lead.course,
      content_category: lead.lead_tier, destination_country: lead.country
    }, { eventID: lead.lead_id });
  };

  // Small helper the pages use for their events.
  window.medientTrack = function (event, params) {
    var o = { event: event }; for (var k in (params || {})) o[k] = params[k];
    dataLayer.push(o);
  };

  // ---- Consent banner (brand-styled, equal-weight choices as the ICO expects)
  function banner() {
    if (document.getElementById('mdc')) return;
    var css = '#mdc{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:460px;margin-left:auto;background:#fff;color:#333;border-radius:18px;box-shadow:0 2px 6px rgba(10,63,90,.08),0 24px 60px -18px rgba(10,63,90,.45);padding:20px 20px 18px;font:15px/1.55 Rubik,system-ui,sans-serif;border-top:4px solid #54BDB4;animation:mdcIn .45s cubic-bezier(.2,.7,.2,1)}' +
      '@keyframes mdcIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
      '#mdc b{display:block;color:#11587B;font-weight:600;font-size:16px;margin-bottom:4px}#mdc p{margin:0 0 14px}#mdc a{color:#157A73}' +
      '#mdc .r{display:flex;gap:10px}#mdc button{flex:1;font:500 15px Rubik,system-ui,sans-serif;padding:12px 14px;border-radius:10px;cursor:pointer;border:1.5px solid #11587B}' +
      '#mdc .a{background:#11587B;color:#fff}#mdc .n{background:#fff;color:#11587B}#mdc button:focus-visible{outline:3px solid rgba(17,88,123,.35);outline-offset:2px}' +
      '@media(max-width:640px){#mdc{left:10px;right:10px;bottom:82px;padding:12px 14px;font-size:13.5px;line-height:1.45;border-radius:14px}#mdc b{display:none}#mdc p{margin:0 0 10px}#mdc button{padding:10px;font-size:14px}}' +
      '@media(prefers-reduced-motion:reduce){#mdc{animation:none}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'mdc'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookie choices');
    d.innerHTML = '<b>Cookies on this page</b><p>We use cookies to measure our ads and improve this page. Essential cookies are always on. <a href="https://medient.co.uk/privacy-policy/" target="_blank" rel="noopener">Privacy policy</a></p>' +
      '<div class="r"><button type="button" class="n">Reject all</button><button type="button" class="a">Accept all</button></div>';
    document.body.appendChild(d);
    function choose(yes) {
      var c = { analytics: yes, ads: yes, t: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
      apply(c, true); d.remove();
    }
    d.querySelector('.a').onclick = function () { choose(true); };
    d.querySelector('.n').onclick = function () { choose(false); };
  }
  window.medientCookieSettings = function () { try { localStorage.removeItem(KEY); } catch (e) {} banner(); };
  if (!saved) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
  }
})();
