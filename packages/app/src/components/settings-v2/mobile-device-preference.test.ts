import { describe, expect, test } from "bun:test"
import { normalizeMobileDevicePreference } from "@/context/mobile-device-preference"

describe("normalizeMobileDevicePreference", () => {
  test("keeps a saved device identity and trims its endpoint", () => {
    expect(
      normalizeMobileDevicePreference({
        preferredDeviceID: "  device-001  ",
        endpoint: "  https://192.168.1.8:8443  ",
        autoReconnect: true,
      }),
    ).toEqual({
      preferredDeviceID: "device-001",
      endpoint: "https://192.168.1.8:8443",
      autoReconnect: true,
    })
  })

  test("uses a safe disconnected default when no saved device exists", () => {
    expect(normalizeMobileDevicePreference({ preferredDeviceID: "  " })).toEqual({
      preferredDeviceID: "",
      endpoint: "",
      autoReconnect: false,
    })
  })
})
