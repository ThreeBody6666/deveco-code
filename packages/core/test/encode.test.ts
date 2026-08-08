import { expect, test } from "bun:test"
import { base64Encode } from "../src/util/encode"

test("base64Encode remains correct when the global btoa implementation is replaced", () => {
  const original = globalThis.btoa
  globalThis.btoa = (value) => value

  try {
    expect(base64Encode("/repo/demo")).toBe("L3JlcG8vZGVtbw")
  } finally {
    globalThis.btoa = original
  }
})
