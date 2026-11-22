import { describe, expect, it } from "vitest";
import { fmtClock } from "./format.ts";

describe("fmtClock", () => {
  it("formats the exam countdown", () => {
    expect(fmtClock(120 * 60_000)).toBe("2:00:00");
    expect(fmtClock(61_500)).toBe("0:01:02");
    expect(fmtClock(-5000)).toBe("0:00:00");
  });
});
