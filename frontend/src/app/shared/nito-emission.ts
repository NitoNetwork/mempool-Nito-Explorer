/** Nito Core v4 GetBlockSubsidy (src/validation.cpp), including its final inclusive reward height. */
export const NITO_SUBSIDY_BOUNDARIES = [530000, 1042400, 1576800, 5256000, 10512000, 26280000, 105120001];
const SUBSIDY_COINS = [512, 256, 128, 64, 32, 16, 2, 0];

export function getNitoSubsidy(height: number): number {
  const era = NITO_SUBSIDY_BOUNDARIES.findIndex(boundary => height < boundary);
  return SUBSIDY_COINS[era < 0 ? 7 : era] * 100_000_000;
}

export function getNextHalvingHeight(height: number): number {
  return NITO_SUBSIDY_BOUNDARIES.find(boundary => boundary > height) ?? -1;
}

export function getPreviousHalvingHeight(height: number): number {
  return NITO_SUBSIDY_BOUNDARIES.filter(boundary => boundary <= height).pop() ?? 0;
}

export function getSubsidyAfterHalving(height: number): number {
  const next = getNextHalvingHeight(height);
  return next < 0 ? 0 : getNitoSubsidy(next);
}
