const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function previousOneDayWindow(now = new Date()) {
  const untilAt = now.toISOString();
  const sinceAt = new Date(now.getTime() - ONE_DAY_MS).toISOString();

  return {
    sinceAt,
    untilAt,
  };
}

function startOfBangkokDayUtc(now: Date, dayOffset: number) {
  const bangkokTime = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const year = bangkokTime.getUTCFullYear();
  const month = bangkokTime.getUTCMonth();
  const date = bangkokTime.getUTCDate() + dayOffset;

  return new Date(Date.UTC(year, month, date) - BANGKOK_OFFSET_MS);
}

export function todayAndYesterdayWindow(now = new Date()) {
  return {
    sinceAt: startOfBangkokDayUtc(now, -1).toISOString(),
    untilAt: now.toISOString(),
  };
}
