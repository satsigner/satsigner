export interface Timestamped {
  timestamp?: Date;
}

export function compareTimestampedAsc(ts1: Timestamped, ts2: Timestamped) {
  const t1 = new Date(ts1.timestamp as Date);
  const t2 = new Date(ts2.timestamp as Date);
  return (t1?.getTime() || 0) - (t2?.getTime() || 0);
}

export function compareTimestampedDesc(ts1: Timestamped, ts2: Timestamped) {
  return compareTimestampedAsc(ts2, ts1);
}
