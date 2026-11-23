import { describe, expect, it } from "vitest";
import { isNetworkError, saveErrorText } from "./errors.ts";

describe("isNetworkError", () => {
  it("recognises browser fetch failures", () => {
    expect(isNetworkError("TypeError: Failed to fetch")).toBe(true); // Chrome
    expect(isNetworkError("NetworkError when attempting to fetch resource.")).toBe(true); // Firefox
    expect(isNetworkError("Load failed")).toBe(true); // Safari
    expect(isNetworkError("You can have up to 50 to-dos.")).toBe(false);
  });
});

describe("saveErrorText", () => {
  it("gives a plain message for network failures", () => {
    expect(saveErrorText(new Error("TypeError: Failed to fetch"))).toBe("Couldn't save. Check your connection and try again.");
    expect(saveErrorText(new Error("Load failed"), "end the exam")).toBe(
      "Couldn't end the exam. Check your connection and try again.",
    );
  });

  it("keeps a server message, without a doubled full stop", () => {
    expect(saveErrorText(new Error("That question was already answered."), "save your answer")).toBe(
      "Couldn't save your answer: That question was already answered. Try again.",
    );
    expect(saveErrorText("bad_view")).toBe("Couldn't save: bad_view. Try again.");
  });
});
