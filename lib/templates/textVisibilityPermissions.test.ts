import { describe, expect, it } from "vitest";
import { preserveTextVisibility, templateTextVisibilityChanged } from "./textVisibilityPermissions";

describe("admin-only text visibility", () => {
  it("ignores non-admin attempts to change visibility while allowing styling", () => {
    expect(preserveTextVisibility({
      headline_zone_override: { enabled: true, color: "#ffffff" },
      body_zone_override: { enabled: false },
    }, { headline_zone_override: { enabled: false } })).toEqual({
      headline_zone_override: { enabled: false, color: "#ffffff" },
    });
  });

  it("preserves admin choices even when a normal save omits them", () => {
    expect(preserveTextVisibility({ show_counter: true }, {
      headline_zone_override: { enabled: false },
      body_zone_override: { enabled: true },
    })).toEqual({
      show_counter: true,
      headline_zone_override: { enabled: false },
      body_zone_override: { enabled: true },
    });
  });

  it("detects direct and legacy template visibility changes", () => {
    const both = { textZones: [{ id: "headline" }, { id: "body" }] };
    const hidden = { textZones: [{ id: "headline", enabled: false }, { id: "body" }] };
    expect(templateTextVisibilityChanged(both, hidden)).toBe(true);
    expect(templateTextVisibilityChanged(hidden, both)).toBe(true);
    expect(templateTextVisibilityChanged(hidden, hidden)).toBe(false);
    expect(templateTextVisibilityChanged(both, {
      ...both, defaults: { meta: { body_zone_override: { enabled: false } } },
    })).toBe(true);
    expect(templateTextVisibilityChanged(both, { textZones: [{ id: "body" }] })).toBe(true);
  });
});
