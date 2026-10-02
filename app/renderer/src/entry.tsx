import { getDefaultStore } from "jotai";
import { createRoot } from "react-dom/client";
import { parseDetachSearch } from "../../lib/detach.js";
import { App } from "./App.js";
import { DetachedRoot, seedDetachedState } from "./DetachedRoot.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("renderer/index.html is missing #root");
}

// RM-000029: a detached panel window loads this exact bundle with a
// `detach=<kind>` query param instead of a separate HTML entry point.
const { kind, state } = parseDetachSearch(window.location.search);
// BUG-000011: start from the opener's view, cursor and live flag, so the
// first sync broadcast doesn't push a default view back to the opener.
if (kind) seedDetachedState(getDefaultStore(), state);
createRoot(container).render(kind ? <DetachedRoot kind={kind} state={state} /> : <App />);
