/** Floor an integer monetary average without SQL AVG's finite fractional scale. */
export function exactAverageSql(expression: string): string {
  return `CAST((SUM(${expression}) - MOD(SUM(${expression}), COUNT(*))) / COUNT(*) AS DECIMAL(65,0))`;
}
