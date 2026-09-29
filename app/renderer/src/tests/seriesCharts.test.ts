import { createStore } from "jotai";
import { Provider } from "jotai/react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hiddenSeriesAtom, seriesOrderAtom } from "../correlate/atoms.js";
import { Legend } from "../correlate/Legend.js";
import { LogPanel } from "../correlate/LogPanel.js";
import { SeriesCharts } from "../correlate/SeriesCharts.js";
import { seriesStateKey } from "../correlate/useSyncedSeries.js";
import type { SumpRecord } from "../correlator-api.js";

// cor-CORE.CORRELATE-000007 (REQ-000034): legend, strips, log linkage, sync.

const metric = (id: string, name: string, cpu: number, mem: number, ts: string) =>
  ({
    kind: "metric",
    docker_host: "h1",
    container_id: id,
    container_name: name,
    ts,
    seq: 1,
    cpu_pct: cpu,
    mem_pct: mem,
  }) as unknown as SumpRecord;

const records = [
  metric("c-web", "web", 10, 20, "2026-09-29T00:00:00Z"),
  metric("c-db", "db", 150, 30, "2026-09-29T00:00:00Z"),
  metric("c-web", "web", 12, 21, "2026-09-29T00:00:05Z"),
];

function withStore(element: ReactElement, setup?: (store: ReturnType<typeof createStore>) => void) {
  const store = createStore();
  setup?.(store);
  return renderToStaticMarkup(createElement(Provider, { store }, element));
}

describe("cor-CORE.CORRELATE-000007: Legend", () => {
  it("shows a swatch + label per container; a hidden one is muted and not pressed", () => {
    const markup = renderToStaticMarkup(
      createElement(Legend, {
        entries: [
          { key: "a", label: "web", color: "var(--series-1)", hidden: false },
          { key: "b", label: "db", color: "var(--series-2)", hidden: true },
        ],
        onToggle: () => {},
        onReorder: () => {},
      }),
    );
    expect(markup).toContain('aria-label="Containers"');
    expect(markup).toMatch(/aria-pressed="true"[^>]*data-series="a"/);
    expect(markup).toMatch(/aria-pressed="false"[^>]*data-series="b"[^>]*line-through/);
    expect(markup).toContain("var(--series-1)");
    expect(markup).toContain('draggable="true"');
  });

  it("renders nothing without containers", () => {
    expect(
      renderToStaticMarkup(
        createElement(Legend, { entries: [], onToggle: () => {}, onReorder: () => {} }),
      ),
    ).toBe("");
  });
});

describe("cor-CORE.CORRELATE-000007: SeriesCharts", () => {
  it("lists every container (sorted colors) and draws each on the CPU and memory strips", () => {
    const markup = withStore(createElement(SeriesCharts, { records }));
    expect(markup).toContain(">web</button>");
    expect(markup).toContain(">db</button>");
    // slots seeded in sorted key order: c-db -> series-1, c-web -> series-2
    expect(markup).toMatch(/data-series="c-db"[\s\S]*?var\(--series-1\)/);
    expect(markup).toMatch(/data-series="c-web"[\s\S]*?var\(--series-2\)/);
    expect(markup).toContain('data-strip="cpu_pct" data-series-count="2"');
    expect(markup).toContain('data-strip="mem_pct" data-series-count="2"');
    expect(markup).toContain('aria-label="CPU %"');
  });

  it("drops a hidden container from the strips but keeps it in the legend", () => {
    const markup = withStore(createElement(SeriesCharts, { records }), (store) =>
      store.set(hiddenSeriesAtom, ["c-db"]),
    );
    expect(markup).toContain('data-strip="cpu_pct" data-series-count="1"');
    expect(markup).toMatch(/aria-pressed="false"[^>]*data-series="c-db"/);
  });

  it("orders the legend by the saved order", () => {
    const markup = withStore(createElement(SeriesCharts, { records }), (store) =>
      store.set(seriesOrderAtom, ["c-web", "c-db"]),
    );
    expect(markup.indexOf('data-series="c-web"')).toBeLessThan(
      markup.indexOf('data-series="c-db"'),
    );
  });
});

describe("cor-CORE.CORRELATE-000007: LogPanel color chips", () => {
  it("chips a row with its container color, and leaves uncolored rows plain", () => {
    const markup = withStore(
      createElement(LogPanel, {
        rows: [
          { ts: 1, message: "hello", seriesKey: "c-web" },
          { ts: 2, message: "host line", seriesKey: "h1" },
        ],
        colorOf: (key: string) => (key === "c-web" ? "var(--series-2)" : undefined),
      }),
    );
    expect(markup).toContain('data-series-chip="c-web"');
    expect(markup).not.toContain('data-series-chip="h1"');
  });
});

describe("cor-CORE.CORRELATE-000007: series sync", () => {
  it("compares hidden sets by content and order by position", () => {
    expect(seriesStateKey(["b", "a"], ["x", "y"])).toBe(seriesStateKey(["a", "b"], ["x", "y"]));
    expect(seriesStateKey([], ["x", "y"])).not.toBe(seriesStateKey([], ["y", "x"]));
  });
});
