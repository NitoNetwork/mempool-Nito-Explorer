/** Exact monetary storage; totals may exceed both MAX_MONEY and uint64. */
export const exactMoneyColumnMigrations = [
  `ALTER TABLE blocks
    ADD COLUMN IF NOT EXISTS amounts_version TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD INDEX IF NOT EXISTS blocks_amounts_version (amounts_version, height),
    MODIFY fees DECIMAL(65,0) UNSIGNED NOT NULL DEFAULT 0,
    MODIFY reward DECIMAL(65,0) UNSIGNED NOT NULL DEFAULT 0,
    MODIFY avg_fee DECIMAL(65,0) UNSIGNED NOT NULL DEFAULT 0,
    MODIFY median_fee_amt DECIMAL(65,0) UNSIGNED NULL,
    MODIFY total_output_amt DECIMAL(65,0) UNSIGNED NOT NULL,
    MODIFY total_input_amt DECIMAL(65,0) UNSIGNED NULL`,
  `ALTER TABLE blocks_audits MODIFY expected_fees DECIMAL(65,0) UNSIGNED NULL`,
  `ALTER TABLE accelerations
    MODIFY effective_fee DECIMAL(65,0) UNSIGNED NOT NULL,
    MODIFY boost_cost DECIMAL(65,0) UNSIGNED NOT NULL`,
];

/** A rounded historical DOUBLE cannot be repaired by converting it to DECIMAL. */
export const legacyStatisticsMoneyMigrations = [
  `ALTER TABLE statistics ADD COLUMN IF NOT EXISTS total_fee_exact DECIMAL(65,0) UNSIGNED NULL`,
  `UPDATE statistics SET total_fee_exact = CASE
    WHEN total_fee BETWEEN 0 AND 9007199254740991 AND total_fee = FLOOR(total_fee)
    THEN CAST(total_fee AS DECIMAL(65,0)) ELSE NULL END`,
  `ALTER TABLE statistics DROP COLUMN total_fee,
    CHANGE COLUMN total_fee_exact total_fee DECIMAL(65,0) UNSIGNED NULL`,
];
