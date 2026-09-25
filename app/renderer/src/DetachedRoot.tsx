import type { DetachPanelKind, DetachViewState } from "../../lib/detach.js";
import { DetachedPanel } from "./DetachedPanel.js";
import { DetachedSidebar } from "./DetachedSidebar.js";

// RM-000029: mounted instead of <App/> when entry.tsx finds a
// `detach=<kind>` query param on boot -- the same index.html bundle,
// routed to a standalone single-panel layout instead of the full shell.

export interface DetachedRootProps {
  kind: DetachPanelKind;
  state: DetachViewState;
}

export function DetachedRoot({ kind, state }: DetachedRootProps) {
  if (kind === "sidebar") {
    return <DetachedSidebar />;
  }
  if (!state.sumpId) {
    return <p role="alert">Detached {kind} panel is missing a sumpId.</p>;
  }
  return <DetachedPanel kind={kind} sumpId={state.sumpId} />;
}
