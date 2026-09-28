/**
 * Locale SEO config — Stage 1: es + pt-BR; Stage 2: tr + ru; Stage 3: vi + id.
 */
export const SEO_LOCALES = [
  { code: 'en', htmlLang: 'en', hreflang: 'en', prefix: '', label: 'English', aboutPrefix: 'About', explore: 'Explore GROM' },
  { code: 'es', htmlLang: 'es', hreflang: 'es', prefix: '/es', label: 'Español', aboutPrefix: 'Acerca de', explore: 'Explorar GROM' },
  {
    code: 'pt-BR',
    htmlLang: 'pt-BR',
    hreflang: 'pt-BR',
    prefix: '/pt-BR',
    label: 'Português (Brasil)',
    aboutPrefix: 'Sobre',
    explore: 'Explorar GROM',
  },
  { code: 'tr', htmlLang: 'tr', hreflang: 'tr', prefix: '/tr', label: 'Türkçe', aboutPrefix: 'Hakkında', explore: 'GROM’u keşfet' },
  { code: 'ru', htmlLang: 'ru', hreflang: 'ru', prefix: '/ru', label: 'Русский', aboutPrefix: 'О продукте', explore: 'Обзор GROM' },
  { code: 'vi', htmlLang: 'vi', hreflang: 'vi', prefix: '/vi', label: 'Tiếng Việt', aboutPrefix: 'Giới thiệu', explore: 'Khám phá GROM' },
  { code: 'id', htmlLang: 'id', hreflang: 'id', prefix: '/id', label: 'Bahasa Indonesia', aboutPrefix: 'Tentang', explore: 'Jelajahi GROM' },
];

export const SEO_PRODUCT_PATHS = [
  { path: '/', route: 'landing', dir: '' },
  { path: '/swap', route: 'dashboard', dir: 'swap' },
  { path: '/futures', route: 'futures', dir: 'futures' },
  { path: '/predict', route: 'predict', dir: 'predict' },
  { path: '/stocks', route: 'xstocks', dir: 'stocks' },
  { path: '/markets', route: 'markets', dir: 'markets' },
];

export function localePath(locale, productPath) {
  const prefix = locale.prefix || '';
  if (productPath === '/') return prefix ? `${prefix}/` : '/';
  return `${prefix}${productPath}`;
}

export function absoluteUrl(locale, productPath) {
  const p = localePath(locale, productPath);
  return 'https://grom.exchange' + (p === '/' ? '/' : p);
}

/** Full mutual hreflang set for one product path (incl. x-default → English). */
export function hreflangBlock(productPath) {
  const lines = SEO_LOCALES.map((loc) =>
    `<link rel="alternate" hreflang="${loc.hreflang}" href="${absoluteUrl(loc, productPath)}" />`
  );
  const en = SEO_LOCALES.find((l) => l.code === 'en');
  lines.push(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(en, productPath)}" />`);
  return lines.join('\n');
}

export function languageSwitcherHtml(localeCode, productPath) {
  const items = SEO_LOCALES.map((loc) => {
    const href = localePath(loc, productPath);
    const cur = loc.code === localeCode ? ' aria-current="page"' : '';
    return `<a href="${href}"${cur} hreflang="${loc.hreflang}">${loc.label}</a>`;
  }).join('\n  ');
  return `<nav class="grom-seo-langs" aria-label="Languages">\n  ${items}\n</nav>`;
}

export function allLocalizedPages() {
  const out = [];
  for (const loc of SEO_LOCALES) {
    for (const prod of SEO_PRODUCT_PATHS) {
      out.push({
        locale: loc,
        route: prod.route,
        path: localePath(loc, prod.path),
        productPath: prod.path,
        dir: loc.prefix
          ? (prod.dir ? `${loc.prefix.slice(1)}/${prod.dir}` : loc.prefix.slice(1))
          : prod.dir,
        isDefaultEn: loc.code === 'en',
      });
    }
  }
  return out;
}
