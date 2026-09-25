/**
 * Pop-out/detach support (RM-000029) -- correlator had no multi-window
 * concept at all before this. Ported from cttc's real `popout` design
 * (`main.js`'s `ipcMain.handle("popout", ...)` + its generic
 * `sync-broadcast` relay): a detached panel is the *same* `index.html`
 * bundle loaded into a second `BrowserWindow` with a `detach=<kind>`
 * query param, not a separate HTML entry point or duplicated UI code.
 *
 * Scoped down from cttc's finer per-series/per-log-source granularity
 * (its `popoutWindows` Map is keyed `"kind:id"`) to correlator's three
 * whole-region panels named in the roadmap item -- chart, log panel,
 * sidebar -- one open window per kind, matching `DetachRegistry` below.
 *
 * `alwaysOnTop` is true only for "sidebar": cttc's real behavior is
 * that only its action-bar/toolbar detach is always-on-top, while its
 * chart and log popouts are regular windows -- not the roadmap item's
 * original blanket assumption that every detached panel wants it,
 * corrected here against cttc's actual source rather than guessed.
 */

export type DetachPanelKind = "chart" | "log" | "sidebar";

export interface DetachWindowSpec {
  width: number;
  height: number;
  alwaysOnTop: boolean;
}

const SPECS: Record<DetachPanelKind, DetachWindowSpec> = {
  chart: { width: 1000, height: 620, alwaysOnTop: false },
  log: { width: 640, height: 520, alwaysOnTop: false },
  sidebar: { width: 220, height: 520, alwaysOnTop: true },
};

export function detachWindowSpec(kind: DetachPanelKind): DetachWindowSpec {
  return SPECS[kind];
}

function isDetachPanelKind(value: string | null): value is DetachPanelKind {
  return value === "chart" || value === "log" || value === "sidebar";
}

/** The slice of shared view state (cor-CORE.CORRELATE-001's viewAtom /
 * cursorTAtom) a detached window needs at open time -- live updates
 * after that travel over the sync-broadcast relay, not the URL. */
export interface DetachViewState {
  sumpId?: string;
  t0?: number;
  t1?: number;
  cursorT?: number | null;
}

export function buildDetachSearch(kind: DetachPanelKind, state: DetachViewState): string {
  const params = new URLSearchParams({ detach: kind });
  if (state.sumpId !== undefined) params.set("sumpId", state.sumpId);
  if (state.t0 !== undefined) params.set("t0", String(state.t0));
  if (state.t1 !== undefined) params.set("t1", String(state.t1));
  if (state.cursorT !== undefined && state.cursorT !== null) {
    params.set("cursorT", String(state.cursorT));
  }
  return params.toString();
}

export interface ParsedDetachSearch {
  kind: DetachPanelKind | null;
  state: DetachViewState;
}

/** The renderer-side counterpart of `buildDetachSearch` -- reads
 * `window.location.search` on boot to decide whether it's running as a
 * detached panel and, if so, which one and with what initial state. */
export function parseDetachSearch(search: string): ParsedDetachSearch {
  const params = new URLSearchParams(search);
  const kind = isDetachPanelKind(params.get("detach"))
    ? (params.get("detach") as DetachPanelKind)
    : null;
  const t0raw = params.get("t0");
  const t1raw = params.get("t1");
  const cursorTraw = params.get("cursorT");
  return {
    kind,
    state: {
      sumpId: params.get("sumpId") ?? undefined,
      t0: t0raw === null ? undefined : Number(t0raw),
      t1: t1raw === null ? undefined : Number(t1raw),
      cursorT: cursorTraw === null ? undefined : Number(cursorTraw),
    },
  };
}

/**
 * At most one open window per detachable panel kind. Generic over the
 * window type so it's testable without a real Electron `BrowserWindow`
 * (shell.ts instantiates it with its own `FakeableBrowserWindow`).
 */
export class DetachRegistry<TWindow> {
  private readonly windows = new Map<DetachPanelKind, TWindow>();

  get(kind: DetachPanelKind): TWindow | undefined {
    return this.windows.get(kind);
  }

  set(kind: DetachPanelKind, win: TWindow): void {
    this.windows.set(kind, win);
  }

  delete(kind: DetachPanelKind): void {
    this.windows.delete(kind);
  }

  isOpen(kind: DetachPanelKind): boolean {
    return this.windows.has(kind);
  }
}
