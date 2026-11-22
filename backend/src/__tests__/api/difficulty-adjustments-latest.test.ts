const mockQuery = jest.fn();

jest.mock('../../database', () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import DifficultyAdjustmentsRepository from '../../repositories/DifficultyAdjustmentsRepository';

describe('bounded difficulty adjustment history', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns only the six latest rows for the Mining dashboard', async () => {
    mockQuery.mockResolvedValueOnce([Array.from({ length: 6 }, (_, index) => ({
      time: String(1795287541 - index),
      height: String(1110988 - index),
      difficulty: 2734109.639826926 - index,
      adjustment: 1,
    }))]);

    const rows = await DifficultyAdjustmentsRepository.$getRawAdjustments('latest', true);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY height DESC LIMIT 6');
    expect(sql).not.toContain('DATE_SUB');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({
      time: 1795287541,
      height: 1110988,
      difficulty: 2734109.639826926,
      adjustment: 1,
    });
  });

  it('preserves the full interval query used by graph pages', async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    await DifficultyAdjustmentsRepository.$getRawAdjustments('3m', true);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('DATE_SUB(NOW(), INTERVAL 3 MONTH)');
    expect(sql).toContain('ORDER BY height DESC');
    expect(sql).not.toContain('LIMIT 6');
  });
});
