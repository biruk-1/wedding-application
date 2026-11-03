/**
 * Dev-only timing marks printed to the Metro log as `[perf] <span> <ms>`.
 * Spans are measured from `<name>:start` to `<name>:end`; `app:boot` starts at module load.
 */
const marks = new Map<string, number>();
const enabled = typeof __DEV__ !== 'undefined' && __DEV__;
const now = () => globalThis.performance?.now?.() ?? Date.now();

if (enabled) marks.set('app:boot', now());

export function markPerf(name: string): void {
  if (!enabled) return;
  const at = now();
  marks.set(name, at);
  if (name.endsWith(':end')) {
    const span = name.slice(0, -':end'.length);
    const start = marks.get(`${span}:start`);
    if (start !== undefined) {
      console.log(`[perf] ${span} ${(at - start).toFixed(0)}ms`);
    }
  }
}

/** Logs time since boot the first time a milestone is reached (e.g. first usable screen). */
export function markMilestone(name: string): void {
  if (!enabled || marks.has(name)) return;
  const at = now();
  marks.set(name, at);
  const boot = marks.get('app:boot') ?? at;
  console.log(`[perf] ${name} +${(at - boot).toFixed(0)}ms since boot`);
}
