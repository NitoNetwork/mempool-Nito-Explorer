import { NitoActivationSnapshot } from './nito-activation';

interface PublicPoolValue {
  monitored: true;
  chainValueNitoshi: string;
  chainValue: string;
}

function poolValue(value: any): PublicPoolValue | null {
  if (value?.monitored !== true || !/^\d+$/.test(String(value.chainValueNitoshi)) ||
      typeof value.chainValue !== 'string') {
    return null;
  }
  return { monitored: true, chainValueNitoshi: String(value.chainValueNitoshi), chainValue: value.chainValue };
}

/** Publish only fields qualified by the current Core activation snapshot. */
export function publicNitoPools(value: any, activation: NitoActivationSnapshot): any | null {
  const active = activation?.source === 'core' && activation.status === 'active' && activation.activated === true;
  const inactive = activation?.source === 'core' && activation.status === 'inactive' && activation.activated === false;
  if ((!active && !inactive) || !value || value.status !== 'confirmed' || value.source !== 'core' ||
      value.includes_mempool !== false || value.activated !== activation.activated ||
      value.privateTxActivationHeight !== activation.privateTxActivationHeight || value.chain !== activation.chain ||
      value.blocks !== activation.blocks || value.bestblockhash !== activation.bestblockhash) {
    return null;
  }

  const transparent = poolValue(value.transparent);
  const total = poolValue(value.total);
  const orchard = active ? poolValue(value.orchard) : null;
  if (!transparent || !total || (active && !orchard)) {
    return null;
  }

  const result: any = {
    status: 'confirmed', source: 'core', includes_mempool: false,
    activated: activation.activated, privateTxActivationHeight: activation.privateTxActivationHeight,
    chain: activation.chain, blocks: activation.blocks, bestblockhash: activation.bestblockhash,
    transparent, total,
  };
  if (active) { result.orchard = orchard; }
  return result;
}
