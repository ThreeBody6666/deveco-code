import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { isAllowedOpenApp, isExecutablePath, toBrowserSafeLink } from "./apps"

describe("toBrowserSafeLink", () => {
  test("keeps browser-safe schemes", () => {
    expect(toBrowserSafeLink("https://opencode.ai/docs")).toBe("https://opencode.ai/docs")
    expect(toBrowserSafeLink("http://127.0.0.1:4096/session")).toBe("http://127.0.0.1:4096/session")
    expect(toBrowserSafeLink("mailto:someone@example.com")).toBe("mailto:someone@example.com")
  })

  test("normalizes the scheme casing", () => {
    expect(toBrowserSafeLink("HTTPS://Example.COM/A")).toBe("https://example.com/A")
  })

  test("rejects schemes the OS would resolve outside a browser", () => {
    for (const url of [
      "file:///C:/Windows/System32/calc.exe",
      "smb://nas/share/x.exe",
      "javascript:alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,hi",
      "ftp://example.com/pub",
      "search-ms:query=hi",
      "wscript://example.com/a.js",
    ]) {
      expect(toBrowserSafeLink(url)).toBeNull()
    }
  })

  test("rejects input that is not a URL", () => {
    for (const url of ["", "   ", "not a url", "./relative/path", "example.com"]) {
      expect(toBrowserSafeLink(url)).toBeNull()
    }
  })
})

describe("isAllowedOpenApp", () => {
  test("accepts the names the session header offers", () => {
    for (const app of ["code", "cursor", "zed", "powershell", "Visual Studio Code", "Android Studio", "iTerm"]) {
      expect(isAllowedOpenApp(app)).toBe(true)
    }
  })

  test("accepts a resolved executable whose name is an allowed app", () => {
    expect(isAllowedOpenApp(join("Program Files", "Microsoft VS Code", "Code.exe"))).toBe(true)
  })

  test("rejects shell and interpreter binaries the UI never offers", () => {
    for (const app of [
      "cmd",
      join("Windows", "System32", "cmd.exe"),
      join("tmp", "evil.exe"),
      "sh",
      "bash",
      "mshta",
      "rundll32",
      "regsvr32",
      "",
      "   ",
    ]) {
      expect(isAllowedOpenApp(app)).toBe(false)
    }
  })

  test("rejects a name that only looks allowed once normalized", () => {
    expect(isAllowedOpenApp("codex")).toBe(false)
    expect(isAllowedOpenApp("code.exe.txt")).toBe(false)
  })
})

describe("isExecutablePath", () => {
  test("flags the extensions the OS shell would launch on open", () => {
    for (const path of [
      "C:\\Users\\me\\Downloads\\tool.exe",
      join("tmp", "setup.BAT"),
      join("tmp", "install.cmd"),
      join("tmp", "shortcut.lnk"),
      join("tmp", "payload.ps1"),
      join("tmp", "module.psm1"),
      join("tmp", "panel.cpl"),
      join("tmp", "app.hta"),
    ]) {
      expect(isExecutablePath(path)).toBe(true)
    }
  })

  test("leaves source and document paths openable", () => {
    for (const path of [
      join("tmp", "README.md"),
      join("tmp", "index.ts"),
      join("tmp", "build.log"),
      join("tmp", "exe"),
      join("tmp", "notes.txt.exe.txt"),
    ]) {
      expect(isExecutablePath(path)).toBe(false)
    }
  })

  test("treats a directory without an extension as openable", () => {
    expect(isExecutablePath(join("tmp", "my.project"))).toBe(false)
  })
})
