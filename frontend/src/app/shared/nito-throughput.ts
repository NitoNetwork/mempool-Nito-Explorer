/** Nito Core v4 targets one block every 60 seconds. */
export const NITO_TARGET_BLOCK_INTERVAL_SECONDS = 60;

export function getNitoVBytesPerSecondLimit(blockWeightUnits: number): number {
  return blockWeightUnits / 4 / NITO_TARGET_BLOCK_INTERVAL_SECONDS;
}
