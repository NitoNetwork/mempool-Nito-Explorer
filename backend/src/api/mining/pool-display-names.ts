import { PoolInfo } from '../../mempool.interfaces';

/** Disambiguate display labels while keeping each pool's stored name and identity. */
export function poolDisplayNames(pools: Pick<PoolInfo, 'poolId' | 'name' | 'slug'>[]): Map<number, string> {
  const nameCounts = new Map<string, number>();
  const suffixCounts = new Map<string, number>();
  const nameKey = (name: string): string => name.trim().toLowerCase();
  const suffix = (slug: string): string | undefined => slug.match(/_([a-z0-9]{8})$/i)?.[1];

  for (const pool of pools) {
    const name = nameKey(pool.name);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    const addressSuffix = suffix(pool.slug);
    if (addressSuffix) {
      const key = `${name}:${addressSuffix}`;
      suffixCounts.set(key, (suffixCounts.get(key) ?? 0) + 1);
    }
  }

  return new Map(pools.map(pool => {
    const name = nameKey(pool.name);
    if (nameCounts.get(name) === 1) { return [pool.poolId, pool.name]; }
    const addressSuffix = suffix(pool.slug);
    const identifier = addressSuffix && suffixCounts.get(`${name}:${addressSuffix}`) === 1
      ? `…${addressSuffix}` : `#${pool.poolId}`;
    return [pool.poolId, `${identifier} · ${pool.name}`];
  }));
}
