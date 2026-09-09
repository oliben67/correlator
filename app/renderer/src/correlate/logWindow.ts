/**
 * Pure virtualization windowing math (cor-CORE.CORRELATE-004).
 * Reimplements the behavior of cttc's `Panel.render()` (`app.js` lines
 * ~2570-2622): the visible row range is derived from `scrollTop` alone,
 * with a fixed overscan margin, clamped to `[0, totalRows - 1]`.
 */

export interface VisibleRange {
  i0: number;
  i1: number;
}

const DEFAULT_OVERSCAN = 10;

export function visibleRange(
  scrollTop: number,
  containerHeight: number,
  rowHeight: number,
  totalRows: number,
  overscan: number = DEFAULT_OVERSCAN,
): VisibleRange {
  if (totalRows <= 0) {
    return { i0: 0, i1: -1 };
  }
  const rawI0 = Math.floor(scrollTop / rowHeight) - overscan;
  const rawI1 = Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan;
  const i0 = Math.max(0, rawI0);
  const i1 = Math.min(totalRows - 1, rawI1);
  return { i0, i1 };
}
