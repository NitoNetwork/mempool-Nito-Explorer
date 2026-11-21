import type { Routes } from '@angular/router';

/** Optional services must be configured before their direct or preview routes exist. */
export function configuredFeatureRoutes(routes: Routes, env: Record<string, unknown>): Routes {
  return routes.filter(route => {
    const path = route.path || '';
    if (/^lightning(?:\/|$)/.test(path)) { return env.LIGHTNING === true; }
    if (/^acceleration(?:\/|$)/.test(path)) { return env.ACCELERATOR === true; }
    if (/^(?:wallet|treasuries)(?:\/|$)/.test(path)) { return env.WALLETS_ENABLED === true; }
    if (/^stratum(?:\/|$)/.test(path)) { return env.STRATUM_ENABLED === true; }
    if (path === 'price') { return env.HISTORICAL_PRICE === true; }
    if (path === 'mining/block-health') { return env.MINING_DASHBOARD === true && env.AUDIT === true; }
    if (/^mining(?:\/|$)/.test(path) && path !== 'mining/blocks') { return env.MINING_DASHBOARD === true; }
    return true;
  }).map(route => route.children ? { ...route, children: configuredFeatureRoutes(route.children, env) } : route);
}

/** Documentation uses the same optional-service gates as the application routes. */
export function configuredApiDocs<T extends { fragment?: string }>(
  items: T[],
  env: { HISTORICAL_PRICE?: boolean; AUDIT?: boolean },
): T[] {
  const priceDocs = ['get-price', 'get-historical-price'];
  const auditDocs = [
    'get-block-audit-score',
    'get-blocks-audit-scores',
    'get-block-audit-summary',
    'how-do-block-audits-work',
  ];
  return items.filter(item => {
    const fragment = item.fragment || '';
    if (priceDocs.includes(fragment)) { return env.HISTORICAL_PRICE === true; }
    if (auditDocs.includes(fragment)) { return env.AUDIT === true; }
    return true;
  });
}
