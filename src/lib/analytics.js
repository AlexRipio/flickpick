/**
 * Google Analytics 4 loader — only injects the gtag script after the user
 * grants analytics consent. IP anonymization is on by default in GA4.
 *
 * Set VITE_GA_MEASUREMENT_ID in .env to enable. Without it the loader
 * is a no-op (useful for QA / local).
 */
import { analyticsAllowed, onConsentChange } from './consent';

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
let installed = false;

function install() {
  if (installed || !GA_ID) return;
  installed = true;

  // gtag stub
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    anonymize_ip: true,
    send_page_view: true,
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function initAnalytics() {
  if (analyticsAllowed()) install();
  // React to consent changes within the same tab.
  onConsentChange((c) => { if (c?.analytics) install(); });
}

export function trackEvent(name, params = {}) {
  if (!installed || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}
