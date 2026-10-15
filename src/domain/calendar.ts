const holidays = new Set(["2026-09-07", "2026-10-12"]);
export function date(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}
export function iso(value: Date): string {
  return value.toISOString().slice(0, 10);
}
export function isBusinessDay(value: Date): boolean {
  return (
    value.getUTCDay() !== 0 &&
    value.getUTCDay() !== 6 &&
    !holidays.has(iso(value))
  );
}
export function addBusinessDays(start: string, days: number): string {
  const result = date(start);
  while (days > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) days--;
  }
  return iso(result);
}
export function businessDaysBetween(start: string, end: string): number {
  const cursor = date(start);
  const limit = date(end);
  let days = 0;
  while (cursor < limit) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor)) days++;
  }
  return days;
}
export function cancellationProbability(days: number): number {
  return days <= 0
    ? 0
    : days <= 2
      ? 0.04
      : days <= 5
        ? 0.1
        : days <= 10
          ? 0.22
          : 0.4;
}
