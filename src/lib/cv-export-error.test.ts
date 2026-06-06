import { describe, expect, it } from "vitest";

import { classifyExportError } from "@/lib/cv-export-error";

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

  it("defaults unknown non-error values to export_failed", () => {
    expect(classifyExportError(undefined)).toBe("export_failed");
    expect(classifyExportError({ weird: true })).toBe("export_failed");
  });
});
