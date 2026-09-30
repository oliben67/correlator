/**
 * cor-CORE.CORRELATE-000011 §1: a live view's 1 s tick. Advances `nowAtom`
 * (the now line and live-track marker move with it) and fires a due resume
 * (§6). Never queries. Unmounting clears `nowAtom`, so views without a
 * tick (the Project view) draw neither mark.
 */

import { useStore } from "jotai/react";
import { useEffect } from "react";
import { nowAtom } from "./atoms.js";
import { checkResume } from "./correlate.js";

export const TICK_MS = 1000;

export function useNowTick(): void {
  const store = useStore();
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      store.set(nowAtom, now);
      checkResume(store, now);
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      store.set(nowAtom, null);
    };
  }, [store]);
}
