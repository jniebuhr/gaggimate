export function avg(samples, field) {
  if (!samples.length) return 0;
  return samples.reduce((s, x) => s + (x[field] ?? 0), 0) / samples.length;
}
