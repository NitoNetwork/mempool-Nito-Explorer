/** Preserve monetary JSON tokens before JavaScript can round them. */
export function parseCoreJson(source: string): any {
  const moneyKeys = new Set(['value', 'value_balance', 'fee', 'base', 'modified', 'ancestor', 'descendant', 'chainValue', 'chainValueNitoshi', 'confirmed', 'unconfirmed', 'total_fee', 'avgfee', 'minfee', 'maxfee', 'medianfee', 'subsidy', 'total_out', 'totalfee', 'coinbasevalue', 'total_amount', 'prevout_spent', 'coinbase', 'new_outputs_ex_coinbase', 'unspendable']);
  const token = /("(?:\\.|[^"\\])*")(\s*:\s*)(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  return JSON.parse(source.replace(token, (match, key, colon, amount) => {
    if (key) {
      return moneyKeys.has(JSON.parse(key)) || (!/[.eE]/.test(amount) && !Number.isSafeInteger(Number(amount)))
        ? `${key}${colon}${JSON.stringify(amount)}` : match;
    }
    return match[0] !== '"' && !/[.eE]/.test(match) && !Number.isSafeInteger(Number(match))
      ? JSON.stringify(match) : match;
  }));
}

export function nitoshi(value: string | number): bigint {
  const text = typeof value === 'number' ? value.toFixed(8) : String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) { throw new Error('Invalid Nito amount'); }
  const scale = 8 + Number(match[4] || 0) - (match[3] || '').length;
  if (text.length > 128 || Math.abs(scale) > 100) { throw new Error('Invalid Nito amount'); }
  const digits = BigInt(match[2] + (match[3] || ''));
  if (scale < 0 && digits % (10n ** BigInt(-scale))) { throw new Error('Invalid Nito amount precision'); }
  return (match[1] ? -1n : 1n) * (scale >= 0 ? digits * 10n ** BigInt(scale) : digits / 10n ** BigInt(-scale));
}

/** Transitional input type: wire responses always canonicalize monetary values to strings. */
export type Amount = string | number;
export const MAX_MONEY = 128456589000000000n;

/** Exact integer nitoshis. Unsafe JS numbers are a broken ingestion boundary. */
export function amount(value: Amount | bigint): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Monetary number was rounded before exact parsing');
  }
  const text = String(value);
  if (!/^-?\d+$/.test(text) || text.length > 128) { throw new Error('Invalid integer nitoshi amount'); }
  return BigInt(text).toString();
}

export function coinToNitoshi(value: Amount): string { return nitoshi(value).toString(); }
/** Individual outputs and fees obey MoneyRange; cumulative sums do not. */
export function transactionNitoshi(value: Amount): string {
  const exact = nitoshi(value);
  if (exact < 0n || exact > MAX_MONEY) { throw new Error('Transaction amount outside Nito MoneyRange'); }
  return exact.toString();
}
export function isTransactionAmount(value: unknown): value is Amount {
  try {
    if (typeof value !== 'string' && typeof value !== 'number') { return false; }
    const exact = BigInt(amount(value));
    return exact >= 0n && exact <= MAX_MONEY;
  } catch { return false; }
}
/** Retained import name for callers converting Core coin decimals, now lossless. */
export const safeNitoshi = coinToNitoshi;
export function addAmounts(...values: (Amount | bigint)[]): string {
  return sumAmounts(values);
}
export function sumAmounts(values: Iterable<Amount | bigint>): string {
  let total = 0n;
  for (const value of values) { total += BigInt(amount(value)); }
  return total.toString();
}
export function subtractAmounts(a: Amount, b: Amount): string { return (BigInt(amount(a)) - BigInt(amount(b))).toString(); }
export function compareAmounts(a: Amount, b: Amount): number {
  const left = BigInt(amount(a)), right = BigInt(amount(b));
  return left < right ? -1 : left > right ? 1 : 0;
}
export function divideAmount(value: Amount, divisor: number): string {
  if (!Number.isSafeInteger(divisor) || divisor <= 0) { throw new Error('Invalid amount divisor'); }
  return (BigInt(amount(value)) / BigInt(divisor)).toString();
}
/** Approximation only for rates, percentages and drawing; never return as money. */
export function amountToNumber(value: Amount): number { return Number(amount(value)); }

export function privateMetadataState(tx: { has_private_bundle?: boolean; private_bundle?: any; hex?: string }): 'transparent' | 'complete' | 'incomplete' {
  // Core serializes the private effects under optional-data flag 0x02. This
  // checks only the envelope, never reimplements Orchard parsing or hashing.
  const wirePrivate = !!tx.hex && /^[0-9a-f]{8}00[0-9a-f]{2}/i.test(tx.hex) && (parseInt(tx.hex.slice(10, 12), 16) & 2) !== 0;
  if (!tx.has_private_bundle && !tx.private_bundle && !wirePrivate) { return 'transparent'; }
  const b = tx.private_bundle;
  if (!b || !Number.isInteger(b.actions) || b.actions < 1 || !Number.isInteger(b.flags) || typeof b.has_auth !== 'boolean' || b.value_balance == null) {
    return 'incomplete';
  }
  try { nitoshi(b.value_balance); } catch { return 'incomplete'; }
  return 'complete';
}
