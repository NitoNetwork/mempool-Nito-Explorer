import { Amount } from '../nito-values';
export namespace IElectrumApi {
  export interface ScriptHashBalance {
    confirmed: Amount;
    unconfirmed: Amount;
  }

  export interface ScriptHashHistory {
    height: number;
    tx_hash: string;
    fee?: Amount;
    cursor?: number;
  }

  export interface ScriptHashHistoryPage {
    confirmed: ScriptHashHistory[];
    unconfirmed: ScriptHashHistory[];
    cursor: number | null;
    has_more: boolean;
    total: number;
  }

  export interface ScriptHashUtxos {
    tx_pos: number;
    value: Amount;
    tx_hash: string;
    height: number;
  }
}
