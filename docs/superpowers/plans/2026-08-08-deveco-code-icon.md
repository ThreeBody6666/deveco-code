# DevEco Code Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic development icon with a premium compiler-chip and flowing-light DevEco Code icon across the desktop development channel.

**Architecture:** Create one deterministic SVG source for the icon mark, rasterize it into the existing `packages/desktop/icons/dev` asset set, and leave the existing channel copy/build pipeline unchanged. Verify required dimensions and hashes before installing the desktop output.

**Tech Stack:** SVG, ImageMagick or available raster tooling, Bun, Electron/Vite, PowerShell SHA-256 verification.

## Global Constraints

- Use no text, literal code brackets, trademarked HarmonyOS glyphs, watermark, or fine detail that disappears below 32px.
- Keep the mark centered with generous padding and a clear silhouette for Windows icon rendering.
- Keep existing Android/iOS files unchanged unless an export is required by the desktop build.
- Do not restart the running application; deploy resources and ask the user to reopen it.

---

### Task 1: Create The Icon Source

**Files:**
- Create: `packages/desktop/icons/dev/source.svg`

- [ ] Write the SVG with a rounded-square graphite/navy base, centered compiler-chip core, three cyan/blue flowing bands, and restrained violet-pink highlights.
- [ ] Keep all geometry vector-based, centered, padded, and free of text or logos.
- [ ] Inspect the SVG rendered at 16px, 32px, 64px, and 256px and simplify any detail that collapses at small sizes.

### Task 2: Export Desktop Assets

**Files:**
- Modify: `packages/desktop/icons/dev/icon.png`
- Modify: `packages/desktop/icons/dev/icon.ico`
- Modify: `packages/desktop/icons/dev/dock.png`
- Modify: `packages/desktop/icons/dev/32x32.png`
- Modify: `packages/desktop/icons/dev/64x64.png`
- Modify: `packages/desktop/icons/dev/128x128.png`
- Modify: `packages/desktop/icons/dev/128x128@2x.png`
- Modify: `packages/desktop/icons/dev/icon.icns`

- [ ] Rasterize the SVG at 256px and export the PNG sizes listed above with correct dimensions and no unintended transparent corners.
- [ ] Build the Windows ICO with 16, 24, 32, 48, 64, 128, and 256px layers.
- [ ] Regenerate the macOS ICNS and dock asset from the same source.
- [ ] Leave the Android and iOS subtrees unchanged.

### Task 3: Add Asset Regression Checks

**Files:**
- Create: `packages/desktop/scripts/verify-icons.ts`
- Modify: `packages/desktop/package.json`

- [ ] Verify each required desktop file exists and each PNG has its expected dimensions.
- [ ] Verify the SVG source contains no text elements or external image references.
- [ ] Add a `verify:icons` script that exits non-zero on missing or malformed assets.
- [ ] Run `bun run verify:icons` and record the passing result.

### Task 4: Build And Deploy

**Files:**
- Modify: `E:\DEVECO_CODE_UPDATE_LIST_20260806.md`

- [ ] Run `bun run verify:icons`, app typecheck, and the desktop build with the repository's models snapshot environment variable.
- [ ] Copy `packages/desktop/out` into `E:\finish\DevEco Code\resources\app\out`.
- [ ] Verify every installed resource file matches its build counterpart by SHA-256 and verify the shortcut target remains `E:\finish\DevEco Code\DevEco Code.exe`.
- [ ] Append the icon design, version, test results, and deployment hashes to the update list.
