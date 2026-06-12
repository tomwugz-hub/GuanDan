export function messageTimestamp(msg, fallbackIndex = 0) {
  const candidates = [
    msg.ts,
    msg.timestamp,
    msg.time,
    msg.data?.ts,
    msg.data?.timestamp,
    msg._mergedAt,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return fallbackIndex;
}
