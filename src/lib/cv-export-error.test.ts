import { describe, expect, it } from "vitest";

import { classifyExportError, exportErrorLocation } from "@/lib/cv-export-error";

describe("classifyExportError", () => {
  it("maps font/asset fetch failures to service_unavailable", () => {
    expect(classifyExportError(new TypeError("Failed to fetch"))).toBe("service_unavailable");
    expect(classifyExportError(new Error("NetworkError when attempting to fetch resource"))).toBe(
      "service_unavailable",
    );
    expect(classifyExportError(new Error("Could not load font /fonts/NotoSans-Regular.ttf"))).toBe(
      "service_unavailable",
    );
  });

  it("maps render/layout errors to export_failed", () => {
    expect(classifyExportError(new Error("Cannot read properties of undefined"))).toBe("export_failed");
    expect(classifyExportError(new RangeError("Invalid array length"))).toBe("export_failed");
  });

  it("classifies thrown strings by their content, not just Error instances", () => {
    // Some callers throw a raw string instead of an Error; the fetch/render
    // distinction must still hold so the user gets the right retry message.
    expect(classifyExportError("Failed to fetch font")).toBe("service_unavailable");
    expect(classifyExportError("Layout overflow while rendering page")).toBe("export_failed");
  });

  it("defaults unknown non-error values to export_failed", () => {
    expect(classifyExportError(undefined)).toBe("export_failed");
    expect(classifyExportError({ weird: true })).toBe("export_failed");
  });
});

/**
 * S-07: PDF export is the terminal funnel step and runs entirely in the browser — no server ever
 * sees a failure here, so this mapping is the only thing that makes a silent loss at the last inch
 * of the funnel visible. Derived from the same verdict as the user-facing copy so the two can
 * never disagree about what went wrong.
 */
describe("exportErrorLocation", () => {
  it("maps a font/asset fetch failure to the assetFetch location", () => {
    expect(exportErrorLocation("service_unavailable")).toBe("hooks/useCvExport:assetFetch");
  });

  it("maps a render failure to the render location", () => {
    expect(exportErrorLocation("export_failed")).toBe("hooks/useCvExport:render");
  });

  it("agrees with the classification the user-facing copy is chosen from", () => {
    expect(exportErrorLocation(classifyExportError(new Error("Failed to fetch font")))).toBe(
      "hooks/useCvExport:assetFetch",
    );
    expect(exportErrorLocation(classifyExportError(new RangeError("Invalid array length")))).toBe(
      "hooks/useCvExport:render",
    );
  });
});
