/**
 * mysql2 can expose MariaDB JSON columns either as their serialized text or as
 * an already-decoded value, depending on the server version and field metadata.
 */
export function parseDatabaseJsonArray<T>(value: unknown, field: string): T[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;

  if (!Array.isArray(parsed)) {
    throw new TypeError(`${field} must contain a JSON array`);
  }

  return parsed as T[];
}
