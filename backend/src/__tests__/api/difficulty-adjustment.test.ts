import {
  calcBitsDifference,
  calcDifficultyAdjustment,
  DifficultyAdjustment,
} from '../../api/difficulty-adjustment';

describe('Mempool Difficulty Adjustment', () => {
  test('should calculate Nito per-block difficulty adjustments', () => {
    const vectors = [
      [
        [1000, null, 1060, 100, 5, 'mainnet', 1060],
        {
          progressPercent: 0,
          difficultyChange: 0,
          estimatedRetargetDate: 1120000,
          remainingBlocks: 1,
          remainingTime: 60000,
          previousRetarget: 5,
          previousTime: 1000,
          nextRetargetHeight: 101,
          timeAvg: 60000,
          adjustedTimeAvg: 60000,
          timeOffset: 0,
          expectedBlocks: 1,
        },
      ],
      [
        [2000, null, 2030, 101, -2, 'mainnet', 2030],
        {
          progressPercent: 0,
          difficultyChange: 100,
          estimatedRetargetDate: 2090000,
          remainingBlocks: 1,
          remainingTime: 60000,
          previousRetarget: -2,
          previousTime: 2000,
          nextRetargetHeight: 102,
          timeAvg: 60000,
          adjustedTimeAvg: 60000,
          timeOffset: 0,
          expectedBlocks: 0.5,
        },
      ],
      [
        [3000, null, 3240, 102, 1, 'mainnet', 3240],
        {
          progressPercent: 0,
          difficultyChange: -75,
          estimatedRetargetDate: 3300000,
          remainingBlocks: 1,
          remainingTime: 60000,
          previousRetarget: 1,
          previousTime: 3000,
          nextRetargetHeight: 103,
          timeAvg: 60000,
          adjustedTimeAvg: 60000,
          timeOffset: 0,
          expectedBlocks: 4,
        },
      ],
      [
        [4940, null, 5000, 103, 0, 'testnet', 3800],
        {
          progressPercent: 0,
          difficultyChange: 0,
          estimatedRetargetDate: 5060000,
          remainingBlocks: 1,
          remainingTime: 60000,
          previousRetarget: 0,
          previousTime: 4940,
          nextRetargetHeight: 104,
          timeAvg: 60000,
          adjustedTimeAvg: 60000,
          timeOffset: -1200000,
          expectedBlocks: 1,
        },
      ],
    ] as [[number, number | null, number, number, number, string, number], DifficultyAdjustment][];

    for (const vector of vectors) {
      const result = calcDifficultyAdjustment(...vector[0]);
      // previousRetarget is passed through untouched
      expect(result.previousRetarget).toStrictEqual(vector[0][4]);
      expect(result).toStrictEqual(vector[1]);
    }
  });

  test('should calculate Difficulty change from bits fields of two blocks', () => {
    // Check same exponent + check min max for output
    expect(calcBitsDifference(0x1d000200, 0x1d000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000400, 0x1d000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000800, 0x1d000100)).toEqual(300); // Actually 700
    expect(calcBitsDifference(0x1d000100, 0x1d000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000100, 0x1d000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000100, 0x1d000800)).toEqual(-75); // Actually -87.5
    // Check new higher exponent
    expect(calcBitsDifference(0x1c000200, 0x1d000001)).toEqual(100);
    expect(calcBitsDifference(0x1c000400, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000800, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000100, 0x1d000002)).toEqual(-50);
    expect(calcBitsDifference(0x1c000100, 0x1d000004)).toEqual(-75);
    expect(calcBitsDifference(0x1c000100, 0x1d000008)).toEqual(-75);
    // Check new lower exponent
    expect(calcBitsDifference(0x1d000002, 0x1c000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000004, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000008, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000001, 0x1c000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000001, 0x1c000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000001, 0x1c000800)).toEqual(-75);
    // Check error when exponents are too far apart
    expect(() => calcBitsDifference(0x1d000001, 0x1a000800)).toThrow(
      /Impossible exponent difference/
    );
    // Check invalid inputs
    expect(() => calcBitsDifference(0x7f000001, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(100.2783, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0x00800000, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0x1c000000, 0x1a000800)).toThrow(
      /Invalid bits/
    );
  });
});
