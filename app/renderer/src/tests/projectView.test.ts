import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectSummary, SumpSummary } from "../correlator-api.js";
import { ProjectPanel } from "../ProjectView.js";
import { canBindProject, groupReferences, projectModeLabel, referenceLabel } from "../project.js";

// cor-CORE.PROJECT-000007 (REQ-000031): project browser helpers + view.

const sumps = [{ id: "sump-1", name: "local" } as SumpSummary];

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    path: "/p/work.correlator",
    name: "work",
    isDefault: false,
    mode: "unbound",
    context: null,
    references: [],
    folders: [],
    ...overrides,
  };
}

const defaultProject = project({
  path: "/home/.correlator/default.correlator",
  name: "Default project",
  isDefault: true,
  mode: "default",
});
const bound = project({ mode: "bound", context: { sumpId: "sump-1", dataStreamId: "sump-1" } });

describe("cor-CORE.PROJECT-000007: project helpers", () => {
  it("labels each mode, naming the bound Sump", () => {
    expect(projectModeLabel(defaultProject, sumps)).toBe("Default project");
    expect(projectModeLabel(project(), sumps)).toBe("Not bound");
    expect(projectModeLabel(bound, sumps)).toBe("Bound to local");
    expect(
      projectModeLabel(
        project({ mode: "bound", context: { sumpId: "x", dataStreamId: "ds" } }),
        sumps,
      ),
    ).toBe("Bound to x · data stream ds");
  });

  it("offers Bind only for an unbound project with an active Sump", () => {
    expect(canBindProject(project(), "sump-1")).toBe(true);
    expect(canBindProject(project(), null)).toBe(false);
    expect(canBindProject(defaultProject, "sump-1")).toBe(false);
    expect(canBindProject(bound, "sump-1")).toBe(false);
  });

  it("groups references by virtual folder, unfiled first", () => {
    const p = project({
      references: ["/r/a.recording", "/r/b.track", "/r/c.recording"],
      folders: [
        {
          name: "Incidents",
          items: ["/r/b.track"],
          folders: [{ name: "Sept", items: ["/r/c.recording"], folders: [] }],
        },
      ],
    });
    expect(groupReferences(p)).toEqual([
      { folder: [], items: ["/r/a.recording"] },
      { folder: ["Incidents"], items: ["/r/b.track"] },
      { folder: ["Incidents", "Sept"], items: ["/r/c.recording"] },
    ]);
    expect(groupReferences(project())).toEqual([]);
    expect(referenceLabel("/r/sub/a.recording")).toBe("a.recording");
  });
});

describe("cor-CORE.PROJECT-000007: ProjectPanel", () => {
  const render = (p: ProjectSummary, activeSumpId: string | null = "sump-1", recent = []) =>
    renderToStaticMarkup(
      createElement(ProjectPanel, {
        project: p,
        recent,
        sumps,
        activeSumpId,
        onAction: () => {},
        onOpenRecent: () => {},
        onForgetRecent: () => {},
      }),
    );

  it("shows the default project without Bind, with Close disabled", () => {
    const markup = render(defaultProject);
    expect(markup).toContain("Default project");
    expect(markup).toContain('data-mode="default"');
    expect(markup).not.toContain("Bind to");
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Close<\/button>/);
    expect(markup).toContain("No recordings or tracks yet.");
    expect(markup).toContain("No recent projects.");
  });

  it("offers Bind to the active Sump on an unbound project", () => {
    const markup = render(project());
    expect(markup).toContain("Not bound");
    expect(markup).toMatch(/<button[^>]*>Bind to local<\/button>/);
    expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>Close<\/button>/);
  });

  it("disables Bind when no Sump is active", () => {
    expect(render(project(), null)).toMatch(
      /<button[^>]*disabled[^>]*>Bind to active data stream<\/button>/,
    );
  });

  it("shows a bound project's binding and references, with no Bind", () => {
    const markup = render({ ...bound, references: ["/r/x.recording"] });
    expect(markup).toContain("Bound to local");
    expect(markup).toContain("References (1)");
    expect(markup).toContain("x.recording");
    expect(markup).not.toContain(">Bind to");
  });

  it("lists recent projects, the current one disabled", () => {
    const markup = render(project(), "sump-1", [
      { path: "/p/work.correlator", name: "work", lastOpenedAt: "2026-09-29T12:00:00Z" },
      { path: "/p/old.correlator", name: "old", lastOpenedAt: "2026-09-28T12:00:00Z" },
    ] as never);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>work<\/button>/);
    expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>old<\/button>/);
    expect(markup).toContain('aria-label="Forget old"');
  });
});
