export const RANGE_DAYS = [7, 30, 90] as const;

export type RangeDays = (typeof RANGE_DAYS)[number];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRangeBounds(
  days: RangeDays,
  now: Date = new Date(),
): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - days * MS_PER_DAY).toISOString(),
    to: now.toISOString(),
  };
}
