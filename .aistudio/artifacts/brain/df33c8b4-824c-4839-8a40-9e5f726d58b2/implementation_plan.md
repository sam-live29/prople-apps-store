# Implementation Plan: In-Memory Blob Streaming & Corrupt Download Prevention

Eliminate the browser address bar loading line during app downloads and strictly prevent corrupt 10.33 KB HTML files (`content://media/external/downloads/...`) from ever being saved.

---

## User Review Required

> [!NOTE]
> Based on your selections:
> 1. **Background Blob Streaming**: We will replace direct URL anchor navigation with in-memory `fetch()` + `URL.createObjectURL(blob)`. Because the fetch is handled as background AJAX, mobile browsers (Chrome, Safari, Firefox, Edge) will never show the horizontal address bar loading line, and no new pages or tabs will be opened.
> 2. **Pre-flight Validation & Safety**: The blob streaming engine will inspect the HTTP status, `Content-Type`, minimum file size (> 50 KB for executable packages), and binary magic signatures (ZIP/APK `PK\x03\x04`, Windows PE `MZ`, Linux ELF `\x7fELF`, macOS Mach-O). If any server or proxy returns a 10.33 KB `index.html` fallback or error page, it is immediately caught and rejected in memory without triggering a file download.

---

## Proposed Changes

### Client-Side Engine (`src/context/InstallContext.tsx`)

#### 1. Replace Direct Anchor Navigation with Background Blob Streamer
- Create `downloadBinaryAsBlob(url, fileName, onProgress)`:
  - Fetches the authentic binary or backend proxy endpoint (`/api/download-apk`) using `fetch()`.
  - Reads the incoming stream chunk-by-chunk using `ReadableStreamDefaultReader` to maintain the real-time download progress bar in the store UI.
  - Validates `response.status === 200`. If status is not 200, parses error message and alerts the user without saving anything.
  - Validates `Content-Type` header: Rejects `text/html`, `text/plain`, `application/json` with a clear message.

#### 2. Binary Header & Size Validation (Anti-10.33 KB Protection)
- Inspect the first chunk's byte signatures:
  - APK / ZIP packages must start with `PK` (`0x50, 0x4B`).
  - PE executables must start with `MZ` (`0x4D, 0x5A`).
  - ELF executables must start with `\x7FELF`.
  - Mach-O / DMG must have appropriate binary headers.
- Total size validation:
  - Any payload under 50 KB claiming to be an application package is flagged and rejected, directly catching the 10.33 KB SPA `index.html` fallback.
- Convert verified stream to `new Blob([chunks], { type: 'application/vnd.android.package-archive' })`.
- Generate local in-memory URL `const objectUrl = URL.createObjectURL(blob)`.
- Trigger instantaneous save via `<a href={objectUrl} download={fileName}>` and immediately revoke with `URL.revokeObjectURL(objectUrl)`.
- Result: **0ms instant save from local memory — ZERO address bar loading line, ZERO new tabs, and ZERO corrupted files.**

#### 3. Seamless Integration in Install Flow
- Update `triggerDirectDownloadLink`, `triggerDirectDownloadImmediate`, and `downloadApp` to use the new blob streamer.
- Provide graceful fallback: If an external CORS-restricted CDN is used and direct client fetch fails, route seamlessly through the server-side proxy `/api/download-apk?url=...` which supports streaming and full CORS headers.

---

### Backend Streaming Endpoint (`server.ts` & `api/download-apk.ts`)

#### 1. Robust Server-Side Pre-flight & Header Handling
- In `/api/download-apk`:
  - Ensure `Content-Disposition: attachment; filename="..."` is always emitted with explicit filename.
  - Ensure `Content-Type: application/vnd.android.package-archive` for `.apk` files.
  - Enforce minimum content-length check: If upstream returns < 50 KB or HTML content, return HTTP 422 JSON error with `Content-Disposition: inline` so the browser never attempts to save it as a download.
  - Return CORS headers `Access-Control-Allow-Origin: *` and expose `Content-Disposition`, `Content-Length`.

---

### Documentation & Blueprints (`OPTIMIZATION_AND_SCALING.me`)

#### 1. Architecture Blueprint Logging
- In compliance with project rules, record the **Zero-Navigation Blob Streaming Architecture** in `OPTIMIZATION_AND_SCALING.me`:
  - Technical rationale for avoiding direct anchor navigation on mobile browsers.
  - Magic-byte verification and payload size thresholds for mobile app store downloads.
  - Bandwidth, memory footprint management, and stream chunking strategies for low-spec mobile devices.

---

## Verification Plan

### Automated Checks
1. Run `compile_applet` to ensure full TypeScript compilation without build errors.
2. Run `lint_applet` (`tsc --noEmit`) to verify zero type regressions.

### Functional Verification
1. **Zero Address Bar Loading Line**:
   - Initiate APK download on an app listing.
   - Confirm download runs entirely inside the in-memory progress pipeline.
   - Confirm browser address bar remains completely static without displaying any loading line or document navigation.
2. **Corrupted / 10.33 KB Protection**:
   - Test downloading with an invalid or HTML fallback URL.
   - Confirm the client detects non-binary / HTML payload, halts download, shows an error toast, and saves 0 bytes to the user's filesystem.
3. **Genuine APK Verification**:
   - Confirm authentic APKs stream smoothly, show accurate progress percentages, and trigger instant local blob saving with correct `.apk` file extension and authentic size.
