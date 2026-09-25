/**
 * RM-000029: keeps this window's viewAtom/cursorTAtom in step with every
 * other open window (main + every detached panel) over the generic
 * sync-broadcast relay (ported from cttc's `main.js:966-970` fan-out +
 * its `setView`/`setCursor` broadcast calls). Every window mounts this
 * hook exactly once.
 *
 * Echo suppression: cttc passes an explicit `{broadcast:false}` flag
 * alongside each remote-applied `setView`/`setCursor` call, since both
 * happen in the same synchronous handler. React's state updates aren't
 * synchronous the same way -- by the time the broadcast-on-change effect
 * below actually runs, a same-tick flag would already have been reset.
 * Comparing the new value against the last value *received* remotely is
 * the React-effect-safe equivalent: it only skips broadcasting a value
 * that is itself an echo of what this window was just told.
 */

import { useAtom } from "jotai/react";
import { useEffect, useRef } from "react";
import { cursorTAtom, type Viewport, viewAtom } from "./atoms.js";

export function useSyncedView(): void {
  const [view, setView] = useAtom(viewAtom);
  const [cursorT, setCursorT] = useAtom(cursorTAtom);
  const lastRemoteView = useRef<Viewport | null>(null);
  const lastRemoteCursorT = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    return window.correlator.onSync((message) => {
      if (message.type === "view") {
        const next = { t0: message.t0, t1: message.t1 };
        lastRemoteView.current = next;
        setView(next);
      } else if (message.type === "cursor") {
        lastRemoteCursorT.current = message.cursorT;
        setCursorT(message.cursorT);
      }
    });
  }, [setView, setCursorT]);

  useEffect(() => {
    const last = lastRemoteView.current;
    if (last && last.t0 === view.t0 && last.t1 === view.t1) return;
    window.correlator.broadcastSync({ type: "view", t0: view.t0, t1: view.t1 });
  }, [view]);

  useEffect(() => {
    if (lastRemoteCursorT.current === cursorT) return;
    window.correlator.broadcastSync({ type: "cursor", cursorT });
  }, [cursorT]);
}
