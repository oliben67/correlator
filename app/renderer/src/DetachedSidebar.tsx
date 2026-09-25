import { useEffect, useState } from "react";
import { type NavView, Sidebar } from "./Sidebar.js";

// RM-000029: the detached-window counterpart of the docked Sidebar.
// Neither window can call the other's setState directly across the
// process boundary, so nav changes go over the same generic
// sync-broadcast relay useSyncedView.ts uses for view/cursor --
// whichever window (docked or detached) the user clicks in, both stay
// in step, symmetrically.

export function DetachedSidebar() {
  const [activeView, setActiveView] = useState<NavView>("correlate");

  useEffect(() => {
    return window.correlator.onSync((message) => {
      if (message.type === "nav") setActiveView(message.view);
    });
  }, []);

  const handleChange = (view: NavView) => {
    setActiveView(view);
    window.correlator.broadcastSync({ type: "nav", view });
  };

  return <Sidebar activeView={activeView} onViewChange={handleChange} />;
}
