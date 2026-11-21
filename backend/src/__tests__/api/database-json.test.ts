import { parseDatabaseJsonArray } from '../../utils/database-json';

describe('database JSON decoding', () => {
  test('decodes a serialized JSON array', () => {
    expect(parseDatabaseJsonArray<string>('["9007199254740993"]', 'test.amounts'))
      .toEqual(['9007199254740993']);
  });

  test('accepts an array already decoded by the database driver', () => {
    const decoded = [{ fee: '128456589000000000' }];

    expect(parseDatabaseJsonArray(decoded, 'test.transactions')).toBe(decoded);
  });

  test('rejects malformed serialized JSON', () => {
    expect(() => parseDatabaseJsonArray('["unterminated"', 'test.invalid'))
      .toThrow(SyntaxError);
  });

  test.each([
    ['a decoded object', { fee: '1' }],
    ['serialized object JSON', '{"fee":"1"}'],
    ['null', null],
    ['a scalar', 1],
  ])('rejects %s where an array is required', (_description, value) => {
    expect(() => parseDatabaseJsonArray(value, 'test.invalid'))
      .toThrow('test.invalid must contain a JSON array');
  });
});
