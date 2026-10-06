/**
 * Server-Side SEO & AI Bot Crawler Pre-Renderer
 * Generates dynamic OpenGraph, Twitter Cards, Meta Description,
 * Schema.org SoftwareApplication JSON-LD, BreadcrumbList JSON-LD,
 * and high-fidelity crawlable semantic HTML for initial document delivery.
 */

export interface SeoAppMetadata {
  id: string;
  name: string;
  developer?: string;
  category?: string;
  tagline?: string;
  shortDescription?: string;
  description?: string;
  platform?: string;
  packageFormat?: string;
  iconUrl?: string;
  featureGraphicUrl?: string;
  screenshots?: string[];
  tabletScreenshots?: string[];
  rating?: number | string;
  reviewsCount?: string | number;
  downloads?: string;
  downloadsCount?: number;
  versionName?: string;
  sizeString?: string;
  downloadUrl?: string;
  assetName?: string;
  sha256?: string;
  updatedAt?: string;
  createdAt?: string;
  tags?: string[];
  type?: string;
  slug?: string;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function slugifyAppName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolves an absolute image URL for metadata and social share cards
 */
export function resolveAbsoluteImageUrl(url: string | undefined, baseUrl: string, fallback = '/logo.png'): string {
  let img = (url || '').trim();
  if (!img) return `${baseUrl}${fallback}`;
  if (img.startsWith('data:') || img.startsWith('blob:')) return img;
  if (img.startsWith('//')) return `https:${img}`;
  if (img.startsWith('/')) return `${baseUrl}${img}`;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${baseUrl}/${img}`;
}

/**
 * Resolves absolute image URL safe for external OpenGraph / Twitter crawler bots.
 * Social crawlers reject inline data URIs, so fall back cleanly to a public logo.
 */
export function resolveSocialShareImageUrl(url: string | undefined, baseUrl: string, fallback = '/logo.png'): string {
  let img = (url || '').trim();
  if (!img || img.startsWith('data:') || img.startsWith('blob:')) return `${baseUrl}${fallback}`;
  if (img.startsWith('//')) return `https:${img}`;
  if (img.startsWith('/')) return `${baseUrl}${img}`;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${baseUrl}/${img}`;
}

/**
 * Injects app-specific SEO tags, Schema.org SoftwareApplication & BreadcrumbList,
 * and semantic pre-rendered HTML into the HTML template for /app/[slug]
 */
export function injectAppSeoIntoHtml(html: string, app: SeoAppMetadata, baseUrl: string): string {
  const name = escapeHtml(app.name || 'Application');
  const canonicalSlug = app.slug || slugifyAppName(app.name) || app.id;
  const platform = escapeHtml((app.platform || 'Android').toUpperCase());
  const category = escapeHtml(app.category || 'Tools');
  const categorySlug = slugifyAppName(app.category || 'tools');
  const developer = escapeHtml(app.developer || 'Verified Publisher');
  const developerSlug = slugifyAppName(app.developer || 'developer');
  
  const rawDesc = (app.description || app.tagline || app.shortDescription || `${app.name} on Prople Store`).trim();
  const description = escapeHtml(rawDesc.slice(0, 200).replace(/[\r\n]+/g, ' '));
  const fullDescription = escapeHtml(rawDesc);

  const iconUrl = resolveAbsoluteImageUrl(app.iconUrl, baseUrl, '/logo.png');
  const socialShareIconUrl = resolveSocialShareImageUrl(app.iconUrl, baseUrl, '/logo.png');
  const featureGraphicUrl = app.featureGraphicUrl 
    ? (app.featureGraphicUrl.startsWith('data:') ? app.featureGraphicUrl : resolveAbsoluteImageUrl(app.featureGraphicUrl, baseUrl))
    : iconUrl;
  const socialFeatureGraphicUrl = app.featureGraphicUrl 
    ? resolveSocialShareImageUrl(app.featureGraphicUrl, baseUrl, '/logo.png')
    : socialShareIconUrl;
  const canonicalUrl = `${baseUrl}/apps/${encodeURIComponent(canonicalSlug)}`;
  
  const exactAsset = app.assetName || `${slugifyAppName(app.name)}.${(app.packageFormat || 'apk').toLowerCase()}`;
  const safeDownloadHref = app.downloadUrl 
    ? `/api/download-apk?url=${encodeURIComponent(app.downloadUrl)}&name=${encodeURIComponent(exactAsset)}&platform=${encodeURIComponent(app.platform || 'android')}`
    : canonicalUrl;
  const downloadHref = safeDownloadHref;

  const ratingVal = app.rating ? Number(app.rating) : null;
  const reviewsCountVal = app.reviewsCount ? (typeof app.reviewsCount === 'number' ? app.reviewsCount : parseInt(String(app.reviewsCount), 10) || null) : null;
  const downloads = escapeHtml(app.downloads || (app.downloadsCount ? `${app.downloadsCount}+` : 'Verified'));
  const version = escapeHtml(app.versionName || '1.0.0');
  const pkgFormat = escapeHtml(app.packageFormat || 'APK').toUpperCase();

  // Page title format: "VLC Media Player — Download & Software Details | Prople Store"
  const pageTitle = `${name} — Download & Software Details | Prople Store`;

  // 1. SoftwareApplication Schema.org JSON-LD
  const softwareAppJsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: rawDesc,
    applicationCategory: app.category || 'Tools',
    operatingSystem: app.platform || 'Android, iOS, iPadOS, macOS, Linux, Windows, Web Browser',
    url: canonicalUrl,
    downloadUrl: downloadHref,
    image: socialShareIconUrl,
    screenshot: socialFeatureGraphicUrl,
    softwareVersion: version,
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cloaktail Industries',
      url: baseUrl,
    },
    author: {
      '@type': 'Organization',
      name: app.developer || 'Verified Publisher',
      url: `${baseUrl}/developers/${encodeURIComponent(developerSlug)}`,
    },
  };

  if (ratingVal && ratingVal > 0 && reviewsCountVal && reviewsCountVal > 0) {
    softwareAppJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingVal.toFixed(1),
      ratingCount: reviewsCountVal,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // 2. BreadcrumbList Schema.org JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Prople Store',
        item: `${baseUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Apps',
        item: `${baseUrl}/apps`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: app.category || 'Tools',
        item: `${baseUrl}/categories/${encodeURIComponent(categorySlug)}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: app.name,
        item: canonicalUrl,
      },
    ],
  };

  // 3. Head Injection block
  const headInject = `
    <!-- Dynamic Pre-Rendered SEO Tags for ${name} -->
    <title>${pageTitle}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${name}, ${name} download, ${category} app, ${platform} application, free download, verified installer, prople store" />
    <meta name="author" content="${developer}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <!-- OpenGraph Metadata -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prople Store" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${socialShareIconUrl}" />
    <meta property="og:image:secure_url" content="${socialShareIconUrl}" />
    <meta property="og:image:alt" content="${name} Icon" />
    <meta property="og:url" content="${canonicalUrl}" />

    <!-- Twitter / X Card Tags -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@PropleStore" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${socialShareIconUrl}" />

    <!-- Schema.org SoftwareApplication & BreadcrumbList -->
    <script type="application/ld+json">
    ${safeJsonLd(softwareAppJsonLd)}
    </script>
    <script type="application/ld+json">
    ${safeJsonLd(breadcrumbJsonLd)}
    </script>
  `;

  // 4. Pre-rendered Semantic HTML Document inside <div id="root">
  // Allows search engine bots, curl, and JavaScript-disabled clients to read the full app document
  // React createRoot will hydrate seamlessly over this without a flicker or layout shift.
  const screenshotsList = Array.isArray(app.screenshots) ? app.screenshots : [];
  const screenshotsHtml = screenshotsList.length > 0 ? `
    <section style="margin: 24px 0;">
      <h3 style="font-size: 18px; font-weight: 600; color: #f3f4f6; margin-bottom: 12px;">Screenshots & Previews</h3>
      <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;">
        ${screenshotsList.slice(0, 6).map((s, idx) => `
          <img src="${escapeHtml(s)}" alt="${name} Screenshot ${idx + 1}" loading="lazy" style="max-height: 280px; border-radius: 12px; object-fit: contain; background: #1e1f22;" onerror="this.style.display='none';" />
        `).join('')}
      </div>
    </section>
  ` : '';

  const preRenderedAppShell = `
    <div style="min-height: 100vh; background: #131314; color: #e3e3e3; font-family: 'Google Sans', 'Google Sans Text', Roboto, sans-serif;">
      <!-- Top Store App Bar -->
      <header style="width: 100%; border-bottom: 1px solid #27272a; background: #18181b; position: sticky; top: 0; z-index: 50;">
        <div style="max-width: 960px; margin: 0 auto; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <a href="${baseUrl}/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: #ffffff;">
            <img src="/logo.png" alt="Prople Store" width="30" height="30" style="border-radius: 8px; object-fit: contain;" />
            <span style="font-weight: 700; font-size: 17px; letter-spacing: -0.01em;">Prople Store</span>
          </a>
          <div style="display: flex; align-items: center; gap: 8px;">
            <a href="${baseUrl}/apps" style="color: #cbd5e1; text-decoration: none; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 9999px; background: #27272a;">Browse Apps</a>
            <a href="${baseUrl}/" style="color: #cbd5e1; text-decoration: none; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 9999px; background: #27272a;">Home</a>
          </div>
        </div>
      </header>

      <main id="prople-ssr-app" class="prople-app-document" style="max-width: 960px; margin: 0 auto; padding: 20px 16px 80px;">
        <!-- Breadcrumb Navigation -->
        <nav aria-label="Breadcrumb" style="font-size: 13px; color: #9aa0a6; margin-bottom: 20px;">
          <ol style="display: flex; align-items: center; gap: 8px; list-style: none; margin: 0; padding: 0; flex-wrap: wrap;">
            <li><a href="${baseUrl}/" style="color: #9aa0a6; text-decoration: none;">Prople Store</a></li>
            <li aria-hidden="true">&rsaquo;</li>
            <li><a href="${baseUrl}/apps" style="color: #9aa0a6; text-decoration: none;">Apps</a></li>
            <li aria-hidden="true">&rsaquo;</li>
            <li><a href="${baseUrl}/categories/${encodeURIComponent(categorySlug)}" style="color: #9aa0a6; text-decoration: none;">${category}</a></li>
            <li aria-hidden="true">&rsaquo;</li>
            <li style="color: #f3f4f6; font-weight: 500;" aria-current="page">${name}</li>
          </ol>
        </nav>

        <!-- App Header Area -->
        <header style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 24px;">
          <img src="${iconUrl}" alt="${name} App Icon" width="108" height="108" style="border-radius: 24px; object-fit: cover; background: #1e1f22; box-shadow: 0 4px 14px rgba(0,0,0,0.5); flex-shrink: 0;" onerror="this.onerror=null;this.src='/logo.png';" />
          <div style="flex: 1; min-width: 0;">
            <h1 style="font-size: 26px; font-weight: 700; color: #f3f4f6; margin: 0 0 6px; letter-spacing: -0.01em;">${name}</h1>
            <p style="margin: 0 0 10px; font-size: 14px; color: #9aa0a6;">
              <a href="${baseUrl}/developers/${encodeURIComponent(developerSlug)}" style="color: #a8c7fa; text-decoration: none; font-weight: 500;">${developer}</a>
              &bull;
              <a href="${baseUrl}/categories/${encodeURIComponent(categorySlug)}" style="color: #9aa0a6; text-decoration: none;">${category}</a>
            </p>
            
            <div style="display: flex; align-items: center; gap: 16px; font-size: 13px; color: #cbd5e1; flex-wrap: wrap;">
              ${ratingVal ? `<span style="font-weight: 600; color: #f3f4f6;">${ratingVal.toFixed(1)} &#9733; <span style="font-weight: 400; color: #9aa0a6;">(${reviewsCountVal || '10+'} reviews)</span></span>` : '<span style="color: #9aa0a6;">Verified Listing</span>'}
              <span>&bull;</span>
              <span>${downloads} Downloads</span>
              <span>&bull;</span>
              <span style="display: inline-block; padding: 2px 8px; background: #2d2e30; border-radius: 6px; font-size: 11px; font-weight: 600;">${pkgFormat}</span>
            </div>
          </div>
        </header>

        <!-- Action & Download Button -->
        <section style="margin-bottom: 28px;">
          <a href="${escapeHtml(safeDownloadHref)}" id="ssr-install-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 32px; background: #0b57d0; color: #ffffff; font-weight: 600; font-size: 15px; border-radius: 9999px; text-decoration: none; box-shadow: 0 2px 8px rgba(11,87,208,0.4);" download="${escapeHtml(exactAsset)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Install ${name} (${pkgFormat})
          </a>
        </section>

        <!-- Screenshot Carousel -->
        ${screenshotsHtml}

        <!-- Detailed Description -->
        <article style="margin: 28px 0; padding: 20px; background: #1e1f22; border-radius: 16px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #f3f4f6; margin-top: 0; margin-bottom: 12px;">About this application</h2>
          <div style="font-size: 14px; line-height: 1.65; color: #cbd5e1; white-space: pre-wrap;">${fullDescription}</div>
        </article>

        <!-- Technical Specifications & Transparency -->
        <section style="margin-top: 24px; padding: 20px; background: #1e1f22; border-radius: 16px; font-size: 13px; color: #9aa0a6;">
          <h3 style="font-size: 15px; font-weight: 600; color: #f3f4f6; margin-top: 0; margin-bottom: 12px;">App Specifications</h3>
          <dl style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 0;">
            <div><dt style="color: #71717a;">Version</dt><dd style="margin: 2px 0 0; color: #e3e3e3; font-weight: 500;">${version}</dd></div>
            <div><dt style="color: #71717a;">Package Type</dt><dd style="margin: 2px 0 0; color: #e3e3e3; font-weight: 500;">${pkgFormat}</dd></div>
            <div><dt style="color: #71717a;">Operating System</dt><dd style="margin: 2px 0 0; color: #e3e3e3; font-weight: 500;">${platform}</dd></div>
            <div><dt style="color: #71717a;">Published By</dt><dd style="margin: 2px 0 0; color: #e3e3e3; font-weight: 500;">${developer}</dd></div>
          </dl>
        </section>
      </main>
    </div>
  `;

  return cleanAndInjectHtml(html, headInject, preRenderedAppShell);
}

/**
 * Injects category-specific SEO metadata and pre-rendered app catalog for /category/[slug]
 */
export function injectCategorySeoIntoHtml(
  html: string, 
  categoryName: string, 
  baseUrl: string, 
  categoryApps: SeoAppMetadata[] = []
): string {
  const cat = escapeHtml(categoryName);
  const catSlug = slugifyAppName(categoryName);
  const title = `${cat} Apps & Games — Download & Browse | Prople Store`;
  const desc = escapeHtml(`Discover, download, and browse top-rated ${cat} applications, tools, and games for Android, Apple, Mac, Linux, Windows, and Web on Prople Store.`);
  const canonicalUrl = `${baseUrl}/categories/${encodeURIComponent(catSlug)}`;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat} Applications`,
    description: desc,
    url: canonicalUrl,
    numberOfItems: categoryApps.length,
    itemListElement: categoryApps.slice(0, 30).map((app, index) => {
      const slug = app.slug || slugifyAppName(app.name) || app.id;
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: `${baseUrl}/apps/${encodeURIComponent(slug)}`,
        name: app.name,
      };
    }),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Prople Store', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Apps', item: `${baseUrl}/apps` },
      { '@type': 'ListItem', position: 3, name: cat, item: canonicalUrl },
    ],
  };

  const headInject = `
    <!-- Category SEO -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="${cat} apps, best ${cat} software, download ${cat} applications, prople store" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <script type="application/ld+json">
    ${safeJsonLd(itemListJsonLd)}
    </script>
    <script type="application/ld+json">
    ${safeJsonLd(breadcrumbJsonLd)}
    </script>
  `;

  const appsListHtml = categoryApps.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 20px;">
      ${categoryApps.map(a => {
        const slug = a.slug || slugifyAppName(a.name) || a.id;
        const icon = resolveAbsoluteImageUrl(a.iconUrl, baseUrl, '/logo.png');
        return `
          <a href="${baseUrl}/apps/${encodeURIComponent(slug)}" style="display: flex; gap: 12px; padding: 12px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3;">
            <img src="${icon}" alt="${escapeHtml(a.name)}" width="56" height="56" style="border-radius: 12px; object-fit: cover;" />
            <div style="overflow: hidden;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(a.name)}</h3>
              <p style="margin: 4px 0 0; font-size: 12px; color: #9aa0a6;">${escapeHtml(a.developer || 'Verified Publisher')}</p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1;">${a.rating ? `${Number(a.rating).toFixed(1)} &#9733;` : 'Verified'}</p>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  ` : '<p style="color: #9aa0a6; margin-top: 20px;">No applications listed in this category yet.</p>';

  const preRenderedContent = `
    <main id="prople-ssr-category" style="max-width: 960px; margin: 0 auto; padding: 24px 16px; font-family: 'Google Sans', Roboto, sans-serif; color: #e3e3e3;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #9aa0a6; margin-bottom: 16px;">
        <a href="${baseUrl}/" style="color: #9aa0a6; text-decoration: none;">Prople Store</a> &rsaquo;
        <a href="${baseUrl}/apps" style="color: #9aa0a6; text-decoration: none;">Apps</a> &rsaquo;
        <span style="color: #f3f4f6;">${cat}</span>
      </nav>
      <h1 style="font-size: 26px; font-weight: 700; color: #f3f4f6; margin: 0;">Top ${cat} Applications</h1>
      <p style="color: #9aa0a6; font-size: 14px; margin-top: 6px;">${desc}</p>
      ${appsListHtml}
    </main>
  `;

  return cleanAndInjectHtml(html, headInject, preRenderedContent);
}

/**
 * Injects developer profile SEO and apps list for /developer/[slug]
 */
export function injectDeveloperSeoIntoHtml(
  html: string,
  developerName: string,
  baseUrl: string,
  developerApps: SeoAppMetadata[] = []
): string {
  const dev = escapeHtml(developerName);
  const devSlug = slugifyAppName(developerName);
  const title = `${dev} — Verified Developer Profile & Apps | Prople Store`;
  const desc = escapeHtml(`Explore apps, games, tools, and releases developed and published by ${developerName} on Prople Store.`);
  const canonicalUrl = `${baseUrl}/developers/${encodeURIComponent(devSlug)}`;

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: developerName,
    url: canonicalUrl,
  };

  const headInject = `
    <!-- Developer SEO -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="author" content="${dev}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <script type="application/ld+json">
    ${safeJsonLd(orgJsonLd)}
    </script>
  `;

  const appsListHtml = developerApps.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 20px;">
      ${developerApps.map(a => {
        const slug = a.slug || slugifyAppName(a.name) || a.id;
        const icon = resolveAbsoluteImageUrl(a.iconUrl, baseUrl, '/logo.png');
        return `
          <a href="${baseUrl}/apps/${encodeURIComponent(slug)}" style="display: flex; gap: 12px; padding: 12px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3;">
            <img src="${icon}" alt="${escapeHtml(a.name)}" width="56" height="56" style="border-radius: 12px; object-fit: cover;" />
            <div style="overflow: hidden;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(a.name)}</h3>
              <p style="margin: 4px 0 0; font-size: 12px; color: #9aa0a6;">${escapeHtml(a.category || 'Tools')}</p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1;">${a.rating ? `${Number(a.rating).toFixed(1)} &#9733;` : 'Verified'}</p>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  ` : '<p style="color: #9aa0a6; margin-top: 20px;">No public applications published under this profile yet.</p>';

  const preRenderedContent = `
    <main id="prople-ssr-developer" style="max-width: 960px; margin: 0 auto; padding: 24px 16px; font-family: 'Google Sans', Roboto, sans-serif; color: #e3e3e3;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #9aa0a6; margin-bottom: 16px;">
        <a href="${baseUrl}/" style="color: #9aa0a6; text-decoration: none;">Prople Store</a> &rsaquo;
        <span style="color: #f3f4f6;">Developer: ${dev}</span>
      </nav>
      <h1 style="font-size: 26px; font-weight: 700; color: #f3f4f6; margin: 0;">${dev}</h1>
      <p style="color: #9aa0a6; font-size: 14px; margin-top: 6px;">Verified Publisher &bull; ${developerApps.length} published applications</p>
      ${appsListHtml}
    </main>
  `;

  return cleanAndInjectHtml(html, headInject, preRenderedContent);
}

/**
 * Injects platform-specific SEO metadata and pre-rendered app catalog for /platforms/android, /platforms/windows, etc.
 */
export function injectPlatformSeoIntoHtml(
  html: string,
  platform: 'android' | 'windows' | 'linux' | 'mac' | 'apple' | 'ios' | 'web' | 'all',
  baseUrl: string,
  platformApps: SeoAppMetadata[] = []
): string {
  const platformName = platform === 'all' 
    ? 'All Platforms' 
    : platform === 'android' 
    ? 'Android' 
    : platform === 'windows' 
    ? 'Windows' 
    : platform === 'mac' 
    ? 'macOS' 
    : platform === 'apple' || platform === 'ios'
    ? 'Apple (iOS/iPadOS)'
    : platform === 'web'
    ? 'Web Store (PWA)'
    : 'Linux';

  const canonicalUrl = platform === 'all' ? `${baseUrl}/apps` : `${baseUrl}/platforms/${platform}`;
  const title = `${platformName} Applications & Software — Free Verified Downloads | Prople Store`;
  const desc = escapeHtml(`Discover, search, and download top-rated ${platformName} applications, packages, and tools on Prople Store. Verified malware-free digital distribution.`);

  const headInject = `
    <!-- Platform SEO -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="${platformName} apps, download ${platformName} software, verified ${platformName} installer, prople store" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
  `;

  const appsListHtml = platformApps.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 20px;">
      ${platformApps.map(a => {
        const slug = a.slug || slugifyAppName(a.name) || a.id;
        const icon = resolveAbsoluteImageUrl(a.iconUrl, baseUrl, '/logo.png');
        return `
          <a href="${baseUrl}/apps/${encodeURIComponent(slug)}" style="display: flex; gap: 12px; padding: 12px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3;">
            <img src="${icon}" alt="${escapeHtml(a.name)}" width="56" height="56" style="border-radius: 12px; object-fit: cover;" />
            <div style="overflow: hidden;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(a.name)}</h3>
              <p style="margin: 4px 0 0; font-size: 12px; color: #9aa0a6;">${escapeHtml(a.developer || 'Verified Publisher')}</p>
              <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1;">${a.rating ? `${Number(a.rating).toFixed(1)} &#9733;` : 'Verified'}</p>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  ` : '<p style="color: #9aa0a6; margin-top: 20px;">No applications listed for this platform yet.</p>';

  const preRenderedContent = `
    <main id="prople-ssr-platform" style="max-width: 960px; margin: 0 auto; padding: 24px 16px; font-family: 'Google Sans', Roboto, sans-serif; color: #e3e3e3;">
      <nav aria-label="Breadcrumb" style="font-size: 13px; color: #9aa0a6; margin-bottom: 16px;">
        <a href="${baseUrl}/" style="color: #9aa0a6; text-decoration: none;">Prople Store</a> &rsaquo;
        <span style="color: #f3f4f6;">${platformName} Applications</span>
      </nav>
      <h1 style="font-size: 26px; font-weight: 700; color: #f3f4f6; margin: 0;">${platformName} Applications & Software</h1>
      <p style="color: #9aa0a6; font-size: 14px; margin-top: 6px;">${desc}</p>
      ${appsListHtml}
    </main>
  `;

  return cleanAndInjectHtml(html, headInject, preRenderedContent);
}

/**
 * Injects homepage & global catalog SEO metadata and rich crawlable application graph for /
 */
export function injectHomeSeoIntoHtml(
  html: string,
  baseUrl: string,
  allApps: SeoAppMetadata[] = [],
  allCategories: { id: string; name: string }[] = []
): string {
  const title = "Prople Store – Multi-Platform App Store & Web Store (Android, Apple, Mac, Linux, Windows)";
  const desc = "Discover apps and games on Prople Store, a multi-platform app store and web store supporting Android, Apple (iOS/iPadOS), Mac, Linux, and Windows operated by Cloaktail Industries. Verified downloads, web apps, ratings, and developer publishing.";
  const canonicalUrl = `${baseUrl}/`;

  const topApps = allApps.slice(0, 36);

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Top Verified Applications on Prople Store',
    description: desc,
    url: canonicalUrl,
    numberOfItems: topApps.length,
    itemListElement: topApps.map((app, index) => {
      const slug = app.slug || slugifyAppName(app.name) || app.id;
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: `${baseUrl}/apps/${encodeURIComponent(slug)}`,
        name: app.name,
      };
    }),
  };

  const headInject = `
    <!-- Homepage Dynamic SEO -->
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="Prople Store, Cloaktail Industries, multiplatform app store, android apk download, apple ios app, mac app store, dmg, linux app store, deb package, windows app store, exe, verified app store, developer console" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Prople Store" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${baseUrl}/logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${baseUrl}/logo.png" />
    <script type="application/ld+json">
    ${safeJsonLd(itemListJsonLd)}
    </script>
  `;

  const categoriesToRender = allCategories.length > 0 ? allCategories : [
    { id: 'cat-tools', name: 'Tools' },
    { id: 'cat-productivity', name: 'Productivity' },
    { id: 'cat-communication', name: 'Communication' },
    { id: 'cat-social', name: 'Social' },
    { id: 'cat-music-audio', name: 'Music & Audio' },
    { id: 'cat-video-players', name: 'Video Players & Editors' },
    { id: 'cat-education', name: 'Education' },
    { id: 'cat-games', name: 'Games' },
    { id: 'cat-business', name: 'Business' },
    { id: 'cat-finance', name: 'Finance' },
    { id: 'cat-health-fitness', name: 'Health & Fitness' },
    { id: 'cat-photography', name: 'Photography' }
  ];

  const uniqueDevs = Array.from(new Set(allApps.map(a => (a.developer || '').trim()).filter(Boolean))).slice(0, 16);

  const preRenderedContent = `
    <div style="min-height: 100vh; background: #131314; color: #e3e3e3; font-family: 'Google Sans', 'Google Sans Text', Roboto, sans-serif;">
      <!-- Store Header -->
      <header style="width: 100%; border-bottom: 1px solid #27272a; background: #18181b; position: sticky; top: 0; z-index: 50;">
        <div style="max-width: 1120px; margin: 0 auto; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <a href="${baseUrl}/" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: #ffffff;">
            <img src="/logo.png" alt="Prople Store" width="32" height="32" style="border-radius: 8px; object-fit: contain;" />
            <span style="font-weight: 700; font-size: 18px; letter-spacing: -0.01em;">Prople Store</span>
          </a>
          <nav aria-label="Main Navigation" style="display: flex; align-items: center; gap: 10px;">
            <a href="${baseUrl}/apps" style="color: #cbd5e1; text-decoration: none; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 9999px; background: #27272a;">Browse Apps</a>
            <a href="#categories" style="color: #cbd5e1; text-decoration: none; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 9999px; background: #27272a;">Categories</a>
            <a href="#platforms" style="color: #cbd5e1; text-decoration: none; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 9999px; background: #27272a;">Platforms</a>
          </nav>
        </div>
      </header>

      <main id="prople-ssr-home" style="max-width: 1120px; margin: 0 auto; padding: 24px 16px 80px;">
        <!-- Hero Section -->
        <section style="text-align: center; padding: 24px 0 32px; border-bottom: 1px solid #27272a;">
          <h1 style="font-size: 32px; font-weight: 700; color: #f3f4f6; margin: 0 0 10px; letter-spacing: -0.02em;">
            Prople Store – Multi-Platform App Store &amp; Web Store
          </h1>
          <p style="max-width: 680px; margin: 0 auto 20px; font-size: 15px; color: #9aa0a6; line-height: 1.6;">
            Discover, download, and publish verified applications for Android, Windows, Linux, Mac, Apple iOS, and Web.
          </p>
          <!-- Platform Quick Filter Links -->
          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
            <a href="${baseUrl}/platforms/android" style="padding: 6px 14px; background: #1e1f22; color: #a8c7fa; font-size: 13px; font-weight: 500; border-radius: 9999px; text-decoration: none; border: 1px solid #333538;">Android (APK/AAB)</a>
            <a href="${baseUrl}/platforms/windows" style="padding: 6px 14px; background: #1e1f22; color: #a8c7fa; font-size: 13px; font-weight: 500; border-radius: 9999px; text-decoration: none; border: 1px solid #333538;">Windows (EXE/MSI)</a>
            <a href="${baseUrl}/platforms/linux" style="padding: 6px 14px; background: #1e1f22; color: #a8c7fa; font-size: 13px; font-weight: 500; border-radius: 9999px; text-decoration: none; border: 1px solid #333538;">Linux (Deb/AppImage)</a>
            <a href="${baseUrl}/platforms/mac" style="padding: 6px 14px; background: #1e1f22; color: #a8c7fa; font-size: 13px; font-weight: 500; border-radius: 9999px; text-decoration: none; border: 1px solid #333538;">macOS (DMG/PKG)</a>
            <a href="${baseUrl}/platforms/apple" style="padding: 6px 14px; background: #1e1f22; color: #a8c7fa; font-size: 13px; font-weight: 500; border-radius: 9999px; text-decoration: none; border: 1px solid #333538;">Apple iOS</a>
            <a href="${baseUrl}/platforms/web" style="padding: 6px 14px; background: #1e1f22; color: #a8c7fa; font-size: 13px; font-weight: 500; border-radius: 9999px; text-decoration: none; border: 1px solid #333538;">Web Store (PWA)</a>
          </div>
        </section>

        <!-- Top Verified Applications Section -->
        <section style="margin-top: 36px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #f3f4f6; margin: 0;">Verified Applications</h2>
            <a href="${baseUrl}/apps" style="color: #a8c7fa; text-decoration: none; font-size: 13px; font-weight: 500;">See all &rarr;</a>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px;">
            ${topApps.map(a => {
              const slug = a.slug || slugifyAppName(a.name) || a.id;
              const icon = resolveAbsoluteImageUrl(a.iconUrl, baseUrl, '/logo.png');
              const devSlug = slugifyAppName(a.developer || 'developer');
              const catSlug = slugifyAppName(a.category || 'tools');
              return `
                <a href="${baseUrl}/apps/${encodeURIComponent(slug)}" style="display: flex; gap: 12px; padding: 12px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; transition: background 0.15s ease;">
                  <img src="${icon}" alt="${escapeHtml(a.name)}" width="56" height="56" style="border-radius: 14px; object-fit: cover; background: #2d2e30;" onerror="this.onerror=null;this.src='/logo.png';" />
                  <div style="overflow: hidden; flex: 1;">
                    <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(a.name)}</h3>
                    <p style="margin: 3px 0 0; font-size: 12px; color: #9aa0a6;">${escapeHtml(a.category || 'Tools')}</p>
                    <div style="margin: 4px 0 0; display: flex; align-items: center; gap: 8px; font-size: 11px; color: #cbd5e1;">
                      <span>${a.rating ? `${Number(a.rating).toFixed(1)} &#9733;` : 'Verified'}</span>
                      <span>&bull;</span>
                      <span>${escapeHtml(a.downloads || (a.downloadsCount ? `${a.downloadsCount}+` : '100+'))}</span>
                    </div>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
        </section>

        <!-- Browse by Category Section -->
        <section id="categories" style="margin-top: 48px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #f3f4f6; margin: 0 0 16px;">Browse by Category</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${categoriesToRender.map(cat => {
              const catSlug = slugifyAppName(cat.name);
              return `
                <a href="${baseUrl}/categories/${encodeURIComponent(catSlug)}" style="padding: 8px 16px; background: #1e1f22; border-radius: 10px; color: #e3e3e3; font-size: 13px; font-weight: 500; text-decoration: none; border: 1px solid #27272a;">
                  ${escapeHtml(cat.name)}
                </a>
              `;
            }).join('')}
          </div>
        </section>

        <!-- Multi-Platform Ecosystem Section -->
        <section id="platforms" style="margin-top: 48px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #f3f4f6; margin: 0 0 16px;">Multi-Platform Ecosystem</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <a href="${baseUrl}/platforms/android" style="padding: 16px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #a8c7fa;">Android Apps</h3>
              <p style="margin: 0; font-size: 12px; color: #9aa0a6;">Verified APK &amp; AAB packages</p>
            </a>
            <a href="${baseUrl}/platforms/windows" style="padding: 16px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #a8c7fa;">Windows Software</h3>
              <p style="margin: 0; font-size: 12px; color: #9aa0a6;">EXE &amp; MSI desktop installers</p>
            </a>
            <a href="${baseUrl}/platforms/linux" style="padding: 16px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #a8c7fa;">Linux Packages</h3>
              <p style="margin: 0; font-size: 12px; color: #9aa0a6;">Debian, AppImage &amp; RPM builds</p>
            </a>
            <a href="${baseUrl}/platforms/mac" style="padding: 16px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #a8c7fa;">macOS Bundles</h3>
              <p style="margin: 0; font-size: 12px; color: #9aa0a6;">DMG &amp; PKG universal packages</p>
            </a>
            <a href="${baseUrl}/platforms/apple" style="padding: 16px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #a8c7fa;">Apple iOS</h3>
              <p style="margin: 0; font-size: 12px; color: #9aa0a6;">iPhone &amp; iPad verified apps</p>
            </a>
            <a href="${baseUrl}/platforms/web" style="padding: 16px; background: #1e1f22; border-radius: 14px; text-decoration: none; color: #e3e3e3; border: 1px solid #27272a;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #a8c7fa;">Web Store (PWA)</h3>
              <p style="margin: 0; font-size: 12px; color: #9aa0a6;">Installable progressive web apps</p>
            </a>
          </div>
        </section>

        <!-- Verified Developers Section -->
        ${uniqueDevs.length > 0 ? `
          <section style="margin-top: 48px;">
            <h2 style="font-size: 20px; font-weight: 600; color: #f3f4f6; margin: 0 0 16px;">Verified Publishers &amp; Creators</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${uniqueDevs.map(devName => {
                const devSlug = slugifyAppName(devName);
                return `
                  <a href="${baseUrl}/developers/${encodeURIComponent(devSlug)}" style="padding: 6px 14px; background: #1e1f22; border-radius: 9999px; color: #cbd5e1; font-size: 12px; font-weight: 500; text-decoration: none; border: 1px solid #27272a;">
                    ${escapeHtml(devName)}
                  </a>
                `;
              }).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Store Footer -->
        <footer style="margin-top: 56px; padding-top: 24px; border-top: 1px solid #27272a; font-size: 13px; color: #9aa0a6;">
          <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
            <a href="${baseUrl}/about" style="color: #9aa0a6; text-decoration: none;">About</a>
            <a href="${baseUrl}/terms" style="color: #9aa0a6; text-decoration: none;">Terms of Service</a>
            <a href="${baseUrl}/privacy" style="color: #9aa0a6; text-decoration: none;">Privacy Policy</a>
            <a href="${baseUrl}/security" style="color: #9aa0a6; text-decoration: none;">Apps Security</a>
            <a href="${baseUrl}/anti-piracy" style="color: #9aa0a6; text-decoration: none;">Anti-Piracy Policy</a>
            <a href="${baseUrl}/user-consent" style="color: #9aa0a6; text-decoration: none;">User Consent</a>
            <a href="${baseUrl}/how-it-works" style="color: #9aa0a6; text-decoration: none;">How It Works</a>
            <a href="${baseUrl}/sitemap.xml" style="color: #9aa0a6; text-decoration: none;">Sitemap</a>
          </div>
          <p style="margin: 0; font-size: 12px; color: #71717a;">
            Prople Store &bull; Multi-Platform Digital Marketplace &bull; Operated by Cloaktail Industries.
          </p>
        </footer>
      </main>
    </div>
  `;

  return cleanAndInjectHtml(html, headInject, preRenderedContent);
}

/**
 * Returns a styled 404 HTML document matching Prople Store design language
 */
export function renderNotFoundHtml(html: string, attemptedResource: string, baseUrl: string): string {
  const cleanResource = escapeHtml(attemptedResource);
  const title = `Application Not Found (404) — Prople Store`;
  const desc = `The requested application '${cleanResource}' is not published or no longer available on Prople Store.`;

  const headInject = `
    <title>${title}</title>
    <meta name="robots" content="noindex, follow" />
    <meta name="description" content="${desc}" />
  `;

  const notFoundContent = `
    <main id="prople-404-container" style="min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; font-family: 'Google Sans', Roboto, sans-serif; color: #e3e3e3; text-align: center; background: #131314;">
      <div style="width: 72px; height: 72px; border-radius: 20px; background: #1e1f22; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
        <img src="${baseUrl}/logo.png" alt="Prople Store" width="44" height="44" />
      </div>
      <h1 style="font-size: 28px; font-weight: 700; color: #f3f4f6; margin: 0 0 12px;">Application Not Found</h1>
      <p style="max-width: 480px; font-size: 15px; color: #9aa0a6; line-height: 1.6; margin: 0 0 28px;">
        We couldn't find an application matching <strong style="color: #f3f4f6;">"${cleanResource}"</strong>. It may have been unpublished, moved, or the link may be mistyped.
      </p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
        <a href="${baseUrl}/apps" style="padding: 10px 24px; background: #0b57d0; color: #ffffff; font-weight: 600; font-size: 14px; border-radius: 9999px; text-decoration: none;">
          Browse All Apps
        </a>
        <a href="${baseUrl}/" style="padding: 10px 24px; background: #2d2e30; color: #e3e3e3; font-weight: 500; font-size: 14px; border-radius: 9999px; text-decoration: none;">
          Store Home
        </a>
      </div>
    </main>
  `;

  return cleanAndInjectHtml(html, headInject, notFoundContent);
}

/**
 * Helper to strip placeholder meta and inject dynamic head & body tags
 */
function cleanAndInjectHtml(html: string, headInject: string, bodyContent: string): string {
  let result = html;

  // Clean existing title and meta tags that would duplicate
  result = result.replace(/<title>[\s\S]*?<\/title>/gi, '');
  result = result.replace(/<meta\s+name=["']description["'][\s\S]*?>/gi, '');
  result = result.replace(/<meta\s+name=["']keywords["'][\s\S]*?>/gi, '');
  result = result.replace(/<meta\s+property=["']og:[^"']+["'][\s\S]*?>/gi, '');
  result = result.replace(/<meta\s+name=["']twitter:[^"']+["'][\s\S]*?>/gi, '');
  result = result.replace(/<link\s+rel=["']canonical["'][\s\S]*?>/gi, '');

  // Inject into <head>
  if (result.includes('</head>')) {
    result = result.replace('</head>', `${headInject}\n</head>`);
  } else {
    result = `${headInject}\n${result}`;
  }

  // Inject pre-rendered content inside <div id="root">, replacing any static loading skeleton
  const rootStart = result.indexOf('<div id="root"');
  if (rootStart !== -1) {
    const bodyEnd = result.indexOf('</body>', rootStart);
    const searchLimit = bodyEnd !== -1 ? bodyEnd : result.length;

    // In Vite dev, there may be a <script> tag after <div id="root"> (e.g. /src/main.tsx)
    const scriptStart = result.indexOf('<script', rootStart);
    let lastDivClose = -1;
    if (scriptStart !== -1 && scriptStart < searchLimit) {
      lastDivClose = result.slice(0, scriptStart).lastIndexOf('</div>');
    } else if (bodyEnd !== -1) {
      // In Vite production, bundled scripts are inside <head>, so root skeleton extends until </body>
      lastDivClose = result.slice(0, bodyEnd).lastIndexOf('</div>');
    }

    if (lastDivClose > rootStart) {
      result = result.slice(0, rootStart) + `<div id="root" style="background-color: inherit; min-height: 100%; width: 100%;">${bodyContent}</div>` + result.slice(lastDivClose + 6);
    } else if (result.includes('<div id="root"></div>')) {
      result = result.replace('<div id="root"></div>', `<div id="root" style="background-color: inherit; min-height: 100%; width: 100%;">${bodyContent}</div>`);
    }
  }

  return result;
}
