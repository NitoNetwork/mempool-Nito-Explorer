import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';

export interface NitoActivation {
  status: 'active' | 'inactive' | 'unknown';
  activated: boolean | null;
  privateTxActivationHeight: number | null;
  chain: string | null;
  blocks: number | null;
  bestblockhash: string | null;
  source: 'core';
  reason?: string;
}

/** This is a display capability, never a local transaction-admission rule. */
export function isCoreOrchardActive(state: NitoActivation | null, network: string, tip?: { id: string; height: number }): boolean {
  const chain = { '': 'main', mainnet: 'main', testnet: 'test', testnet4: 'test', signet: 'signet', regtest: 'regtest' }[network];
  return !!state && state.source === 'core' && state.status === 'active' && state.activated === true
    && !!chain && state.chain === chain && !!tip && state.bestblockhash === tip.id && state.blocks === tip.height;
}

export function orchardActivation$(state$: Observable<NitoActivation | null>, network$: Observable<string>, blocks$: Observable<{ id: string; height: number }[]>): Observable<boolean> {
  return combineLatest([state$, network$, blocks$]).pipe(
    map(([state, network, blocks]) => isCoreOrchardActive(state, network, blocks[0])),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}

/** RPC diagnostics must not announce an unactivated feature either. */
export function activationAwareText(text: string | null | undefined, activated: boolean): string {
  return activated ? (text || '') : (text || '').replace(/\bOrchard\b/gi, 'private transaction').replace(/\bBech32x\b/gi, 'private address');
}
