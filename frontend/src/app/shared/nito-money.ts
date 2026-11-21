/** Exact integer nitoshis on the wire. Numbers are accepted for legacy safe values. */
export type Nitoshi = string | number;

export function atoms(value: Nitoshi | bigint | null | undefined): bigint {
  if (value == null) { return 0n; }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Monetary amounts must arrive as exact integer strings');
  }
  if (!/^-?\d+$/.test(String(value))) { throw new Error('Invalid integer amount'); }
  return BigInt(value);
}

export function sumAmounts(...values: (Nitoshi | bigint)[]): string {
  return values.reduce<bigint>((total, value) => total + atoms(value), 0n).toString();
}

export function subtractAmounts(left: Nitoshi, right: Nitoshi): string {
  return (atoms(left) - atoms(right)).toString();
}

/** Statistics use floor-to-nitoshi averages, matching the SQL API contract. */
export function averageAmount(total: Nitoshi, count: number): string {
  if (!Number.isSafeInteger(count) || count <= 0) { return '0'; }
  return (atoms(total) / BigInt(count)).toString();
}

export function compareAmounts(left: Nitoshi, right: Nitoshi): number {
  const a = atoms(left), b = atoms(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function absoluteAmount(value: Nitoshi): string {
  const amount = atoms(value);
  return (amount < 0n ? -amount : amount).toString();
}

/** Coin decimals to integer nitoshis without a floating-point intermediate. */
export function coinsToAtoms(value: string | number): string {
  const match = /^(-?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value));
  if (!match) { throw new Error('Invalid coin amount'); }
  const scale = 8 + Number(match[4] || 0) - (match[3] || '').length;
  if (Math.abs(scale) > 100) { throw new Error('Invalid coin amount scale'); }
  let amount = BigInt(match[2] + (match[3] || ''));
  if (scale < 0 && amount % (10n ** BigInt(-scale))) { throw new Error('Sub-nitoshi amount'); }
  amount = scale < 0 ? amount / (10n ** BigInt(-scale)) : amount * (10n ** BigInt(scale));
  return ((match[1] ? -1n : 1n) * amount).toString();
}

/** Use only for charts, estimated fiat conversions and fee rates, never amount text or sums. */
export function approximateAmount(value: Nitoshi | bigint | null | undefined): number {
  // Already-derived rates and fiat estimates may be fractional numbers.
  if (typeof value === 'number') { return value; }
  return Number(atoms(value));
}

export function amountRate(value: Nitoshi, denominator: number): number {
  return denominator > 0 ? approximateAmount(value) / denominator : 0;
}

interface FeeTransaction {
  fee?: Nitoshi;
  policy_vsize?: number;
  vsize?: number;
  weight?: number;
  has_private_bundle?: boolean;
  private_bundle?: unknown;
}

/** Orchard fee policy is distinct from serialized size; missing policy is unknown. */
export function policyVsize(tx: FeeTransaction): number {
  const size = tx.policy_vsize ?? ((tx.has_private_bundle || tx.private_bundle) ? 0 : (tx.vsize ?? tx.weight / 4));
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function transactionFeeRate(tx: FeeTransaction): number {
  const size = policyVsize(tx);
  return tx.fee != null && compareAmounts(tx.fee, 0) >= 0 && size > 0 ? approximateAmount(tx.fee) / size : -1;
}

export function packageFeeRate(transactions: FeeTransaction[], requirePolicy = false): number {
  // CPFP relatives historically omit policy metadata, so their serialized weight is insufficient.
  if (requirePolicy && transactions.some(tx => !tx.policy_vsize)) { return -1; }
  if (transactions.some(tx => policyVsize(tx) <= 0 || tx.fee == null || compareAmounts(tx.fee, 0) < 0)) { return -1; }
  return amountRate(sumAmounts(...transactions.map(tx => tx.fee)), transactions.reduce((total, tx) => total + policyVsize(tx), 0));
}

export function coinDecimal(value: Nitoshi | bigint): string {
  const amount = atoms(value), magnitude = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${magnitude / 100000000n}.${(magnitude % 100000000n).toString().padStart(8, '0')}`;
}

const localeFormats = new Map<string, { integer: Intl.NumberFormat; separator: string; minus: string; digits: string[] }>();
function getLocaleFormat(locale: string, minInteger: number) {
  const key = `${locale}:${minInteger}`;
  if (!localeFormats.has(key)) {
    if (localeFormats.size >= 64) { localeFormats.delete(localeFormats.keys().next().value); }
    const parts = new Intl.NumberFormat(locale).formatToParts(-1.1);
    const digits = new Intl.NumberFormat(locale, { useGrouping: false });
    localeFormats.set(key, {
      integer: new Intl.NumberFormat(locale, { minimumIntegerDigits: minInteger, maximumFractionDigits: 0 }),
      separator: parts.find(part => part.type === 'decimal')?.value || '.',
      minus: parts.find(part => part.type === 'minusSign')?.value || '-',
      digits: Array.from({ length: 10 }, (_, digit) => digits.format(digit)),
    });
  }
  return localeFormats.get(key);
}

/** Locale-aware display with decimal rounding performed on integers. */
export function formatAmount(value: Nitoshi | bigint, locale = 'en-US', digitsInfo = '1.8-8', scale = 8): string {
  const amount = atoms(value), negative = amount < 0n;
  let magnitude = negative ? -amount : amount;
  const digits = /^(\d+)\.(\d+)-(\d+)$/.exec(digitsInfo);
  const minInteger = Number(digits?.[1] || 1);
  const minFraction = Math.min(scale, Number(digits?.[2] || 0));
  const maxFraction = Math.min(scale, Number(digits?.[3] ?? scale));
  const rounding = 10n ** BigInt(scale - maxFraction);
  magnitude = (magnitude + rounding / 2n) / rounding;
  const unit = 10n ** BigInt(maxFraction);
  const formats = getLocaleFormat(locale, minInteger);
  const integer = formats.integer.format(magnitude / unit);
  let fraction = (magnitude % unit).toString().padStart(maxFraction, '0');
  if (!maxFraction) { fraction = ''; }
  while (fraction.length > minFraction && fraction.endsWith('0')) { fraction = fraction.slice(0, -1); }
  fraction = fraction.replace(/\d/g, digit => formats.digits[Number(digit)]);
  return `${negative && magnitude ? formats.minus : ''}${integer}${fraction ? formats.separator + fraction : ''}`;
}

export const money = { atoms, sum: sumAmounts, subtract: subtractAmounts, compare: compareAmounts,
  average: averageAmount, absolute: absoluteAmount, approximate: approximateAmount, rate: amountRate, coins: coinDecimal,
  fromCoins: coinsToAtoms, format: formatAmount, policyVsize, feeRate: transactionFeeRate, packageFeeRate };
