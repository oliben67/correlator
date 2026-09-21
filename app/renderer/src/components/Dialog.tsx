import { type ReactNode, useEffect, useRef } from "react";

// cor-CORE.UI-000004 (RM-000023): correlator has had no overlay/modal
// pattern at all -- AboutDialog/Preferences are inline panels swapped
// into the main content area, not real dialogs. This wraps the native
// <dialog> element (no new dependency, matching cttc's own choice and
// env-DEPS-002's precedent) -- the platform already gives it backdrop
// rendering, focus trapping, and Escape-to-close for free via
// showModal()/close(), which a hand-rolled overlay div would have to
// reimplement.

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      // The native "cancel" event fires on Escape and is the dialog's
      // own close signal -- forwarding it to onClose keeps caller state
      // in sync with what the platform already did.
      onCancel={onClose}
      onClose={onClose}
      style={{
        background: "var(--surface-1)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        minWidth: 460,
        maxWidth: 620,
        padding: 0,
      }}
    >
      <div style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
