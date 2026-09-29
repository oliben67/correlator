/**
 * Legend order (cor-CORE.CORRELATE-000007), ported from cttc's
 * `orderOf`/`reorderTo`: one user-chosen order of series keys; keys the
 * order doesn't know yet follow it, sorted.
 */

/** `present` keys, in `order` first, then any others sorted. */
export function orderedKeys(order: readonly string[], present: readonly string[]): string[] {
  const set = new Set(present);
  const known = order.filter((k) => set.has(k));
  const knownSet = new Set(known);
  const rest = [...set].filter((k) => !knownSet.has(k)).sort();
  return [...known, ...rest];
}

/** Moves `dragged` to just before `target` within `keys`. */
export function reorder(keys: readonly string[], dragged: string, target: string): string[] {
  if (dragged === target || !keys.includes(dragged) || !keys.includes(target)) return [...keys];
  const without = keys.filter((k) => k !== dragged);
  const at = without.indexOf(target);
  return [...without.slice(0, at), dragged, ...without.slice(at)];
}
