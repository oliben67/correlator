/**
 * cor-CORE.CORRELATE-000007: keeps the hidden containers and legend order the
 * same in every window (main + detached chart/log panels), over the same
 * sync-broadcast relay as useSyncedView (RM-000029).
 *
 * Two differences from useSyncedView:
 *  - A window never broadcasts its *initial* state on mount -- a freshly
 *    opened detached window's empty defaults must not wipe everyone else's
 *    choices. It sends a `series-request` instead; every other window
 *    answers with its current state.
 *  - Echo suppression compares against the last state received, keyed by
 *    `seriesStateKey` (arrays, so compared by content).
 */

import { useAtom } from "jotai/react";
import { useEffect, useRef } from "react";
import { hiddenSeriesAtom, seriesOrderAtom } from "./atoms.js";

export function seriesStateKey(hidden: readonly string[], order: readonly string[]): string {
  return JSON.stringify([[...hidden].sort(), order]);
}

export function useSyncedSeries(): void {
  const [hidden, setHidden] = useAtom(hiddenSeriesAtom);
  const [order, setOrder] = useAtom(seriesOrderAtom);
  const lastRemote = useRef<string | null>(null);
  const mounted = useRef(false);
  const current = useRef({ hidden, order });
  current.current = { hidden, order };

  useEffect(() => {
    const unsubscribe = window.correlator.onSync((message) => {
      if (message.type === "series") {
        lastRemote.current = seriesStateKey(message.hidden, message.order);
        setHidden(message.hidden);
        setOrder(message.order);
      } else if (message.type === "series-request") {
        const { hidden: h, order: o } = current.current;
        window.correlator.broadcastSync({ type: "series", hidden: h, order: o });
      }
    });
    window.correlator.broadcastSync({ type: "series-request" });
    return unsubscribe;
  }, [setHidden, setOrder]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (lastRemote.current === seriesStateKey(hidden, order)) return;
    window.correlator.broadcastSync({ type: "series", hidden, order });
  }, [hidden, order]);
}
