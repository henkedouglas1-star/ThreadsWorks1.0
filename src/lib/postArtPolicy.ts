/** Server-side policy for optional post artwork. UTC calendar periods. */
export const POST_ART_IMAGES_PER_REQUEST = 1;
export function postArtAllowance(isPro: boolean, now: Date = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (!isPro) start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (isPro ? 1 : 7));
  return { limit: 1, period: isPro ? "day" : "week", start: start.toISOString(), end: end.toISOString() };
}
