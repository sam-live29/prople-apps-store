/**
 * SEO & Structured Data Helper for Dynamic App Detail Pages
 * Updates document title, meta tags (OpenGraph, Twitter Cards, Description),
 * canonical URL, and Schema.org JSON-LD Structured Data for search bots and browsers.
 */

import { AppDetails } from '../types';
import { getAppShareUrl } from './shareUtils';

const DEFAULT_TITLE = 'Prople Store – Multi-Platform App Store & Web Store (Android, Apple, Mac, Linux, Windows)';
const DEFAULT_DESCRIPTION = 'Prople Store is an independent multi-platform application store and web store operated by Cloaktail Industries. Discover, download, and install verified software across Android (APK), Apple (iOS), Mac (macOS), Linux (DEB, AppImage, RPM), Windows (EXE, MSI), and Web/PWA applications safely with real community reviews and developer publishing.';

function setMetaTag(nameOrProperty: string, content: string, isProperty = false) {
  const attribute = isProperty ? 'property' : 'name';
  let element = document.querySelector(`meta[${attribute}="${nameOrProperty}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, nameOrProperty);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonicalUrl(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function updateAppPageSeo(app: Partial<AppDetails>) {
  if (typeof document === 'undefined' || !app || !app.name) return;

  const appName = app.name.trim();
  const platform = (app.platform || 'Android').toUpperCase();
  const category = app.category || 'Tools';
  const tagline = (app.tagline || (app as any).shortDescription || `${appName} on Prople Store`).trim();
  const description = ((app as any).description || app.aboutText || tagline || `${appName} - Download safe and verified app package for ${platform}`).trim().slice(0, 280);
  const platformLogoUrl = `${window.location.origin}/logo.png`;
  const fullUrl = getAppShareUrl(app as any);

  // 1. Title
  document.title = `${appName} - Download for ${platform} | Prople Store`;

  // 2. Standard Meta Tags
  setMetaTag('description', description);
  setMetaTag('keywords', `${appName}, ${category}, ${platform} app, download ${appName}, free download, app market, ${appName} apk`);
  setMetaTag('author', app.developer || 'Prople Store');

  // 3. OpenGraph Social Metadata
  setMetaTag('og:type', 'website', true);
  setMetaTag('og:site_name', 'Prople Store', true);
  setMetaTag('og:title', `${appName} - Download on Prople Store`, true);
  setMetaTag('og:description', description, true);
  setMetaTag('og:image', platformLogoUrl, true);
  setMetaTag('og:url', fullUrl, true);

  // 4. Twitter / X Card Metadata
  setMetaTag('twitter:card', 'summary');
  setMetaTag('twitter:title', `${appName} - Download on Prople Store`);
  setMetaTag('twitter:description', description);
  setMetaTag('twitter:image', platformLogoUrl);

  // 5. Canonical link
  setCanonicalUrl(fullUrl);

  // 6. Schema.org SoftwareApplication JSON-LD
  let script = document.getElementById('schema-software-application') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'schema-software-application';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': appName,
    'headline': tagline,
    'description': description,
    'applicationCategory': category,
    'operatingSystem': platform,
    'softwareVersion': app.versionName || '1.0.0',
    'offers': {
      '@type': 'Offer',
      'price': '0.00',
      'priceCurrency': 'USD',
    },
    ...(app.rating && app.rating > 0 && app.ratingsCount && app.ratingsCount > 0 ? {
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': Number(app.rating).toFixed(1),
        'reviewCount': app.ratingsCount,
        'bestRating': '5',
        'worstRating': '1',
      },
    } : {}),
    'publisher': {
      '@type': 'Organization',
      'name': app.developer || 'Prople Store Developer',
    },
    'image': platformLogoUrl,
  };

  script.textContent = JSON.stringify(structuredData);
}

export function restoreDefaultSeo() {
  if (typeof document === 'undefined') return;

  document.title = DEFAULT_TITLE;
  setMetaTag('description', DEFAULT_DESCRIPTION);
  setMetaTag('og:title', DEFAULT_TITLE, true);
  setMetaTag('og:description', DEFAULT_DESCRIPTION, true);
  setMetaTag('og:image', '/logo.png', true);
  setMetaTag('og:url', window.location.origin, true);
  setMetaTag('twitter:title', DEFAULT_TITLE);
  setMetaTag('twitter:description', DEFAULT_DESCRIPTION);
  setMetaTag('twitter:image', '/logo.png');
  setCanonicalUrl(window.location.origin);

  const script = document.getElementById('schema-software-application');
  if (script) {
    script.remove();
  }
}
