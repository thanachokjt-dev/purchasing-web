const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function previousOneDayWindow(now = new Date()) {
  const untilAt = now.toISOString();
  const sinceAt = new Date(now.getTime() - ONE_DAY_MS).toISOString();

  return {
    sinceAt,
    untilAt,
  };
}
