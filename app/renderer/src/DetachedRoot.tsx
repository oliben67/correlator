import type { DetachPanelKind, DetachViewState } from "../../lib/detach.js";
import { usePreferences } from "./appPreferences.js";
import { cursorTAtom, liveAtom, viewAtom } from "./correlate/atoms.js";
import type { Store } from "./correlate/correlate.js";
import { DetachedPanel } from "./DetachedPanel.js";
import { DetachedSidebar } from "./DetachedSidebar.js";

// RM-000029: mounted instead of <App/> when entry.tsx finds a
// `detach=<kind>` query param on boot -- the same index.html bundle,
// routed to a standalone single-panel layout instead of the full shell.

/** BUG-000011: seed the shared state from the opener's open-time state,
 * before the first render (and so before useSyncedView's first broadcast). */
export function seedDetachedState(store: Store, state: DetachViewState): void {
  if (state.t0 !== undefined && state.t1 !== undefined && state.t1 > state.t0) {
    store.set(viewAtom, { t0: state.t0, t1: state.t1 });
  }
  if (state.cursorT !== undefined) store.set(cursorTAtom, state.cursorT);
  if (state.live !== undefined) store.set(liveAtom, state.live);
}

export interface DetachedRootProps {
  kind: DetachPanelKind;
  state: DetachViewState;
}

export function DetachedRoot({ kind, state }: DetachedRootProps) {
  // cor-CORE.SHELL-000008: detached windows apply preferences on open too.
  usePreferences();
  if (kind === "sidebar") {
    return <DetachedSidebar />;
  }
  if (!state.sumpId) {
    return <p role="alert">Detached {kind} panel is missing a sumpId.</p>;
  }
  return <DetachedPanel kind={kind} sumpId={state.sumpId} />;
}
