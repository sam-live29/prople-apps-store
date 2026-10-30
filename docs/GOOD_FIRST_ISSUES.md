# Beginner-Friendly Issues (Good First Issues)

Welcome! If you are looking to make your first contribution to **Prople Store**, this curated list of starter tasks is designed for you. Each task is small, self-contained, clearly scoped, and does not require private cloud credentials (they can all be developed and tested in local mock mode).

---

## Index of Starter Issues

| ID | Title | Difficulty | Primary Focus | Relevant Files |
| :--- | :--- | :--- | :--- | :--- |
| **GFI-01** | [Keyboard Navigation for Screenshot Lightbox](#gfi-01-keyboard-navigation-for-screenshot-lightbox) | 🟢 Easy | UI / Accessibility | `src/components/MediaUpload/MediaGalleryLightbox.tsx` |
| **GFI-02** | [Offline & Empty State Action Card in Search Results](#gfi-02-offline--empty-state-action-card-in-search-results) | 🟢 Easy | UX / Resilience | `src/components/SearchResultsPage.tsx` |
| **GFI-03** | [Interactive Share Link Toast & Audio Feedback](#gfi-03-interactive-share-link-toast--audio-feedback) | 🟢 Easy | Micro-interactions | `src/components/AppDetailPage.tsx`, `src/utils/shareUtils.ts` |
| **GFI-04** | [Platform Filter Quick-Chips on Explore View](#gfi-04-platform-filter-quick-chips-on-explore-view) | 🟡 Medium-Easy | UI / State | `src/components/ExplorePage.tsx` |
| **GFI-05** | [Static Mock Catalog Sanity Validator Script](#gfi-05-static-mock-catalog-sanity-validator-script) | 🟡 Medium-Easy | Tooling / Testing | `scripts/validate_catalog.js`, `src/data.ts` |
| **GFI-06** | [Direct Package Binary File Upload in Console](#gfi-06-direct-package-binary-file-upload-in-console) | 🟡 Medium | Feature / Storage | `src/components/AppConsole.tsx`, `server/s3Storage.ts` |
| **GFI-07** | [Private GitHub Release Access Token Importer](#gfi-07-private-github-release-access-token-importer) | 🟡 Medium | Backend / API | `api/resolve-apk.ts`, `api/github-release-meta.ts` |
| **GFI-08** | [Private Repo Helper Accordion & Cloud Links in Console](#gfi-08-private-repo-helper-accordion--cloud-links-in-console) | 🟢 Easy | UI / Guidance | `src/components/AppConsole.tsx` |
| **GFI-09** | [One-Time Binary Release Mirroring & CDN Cache Endpoint](#gfi-09-one-time-binary-release-mirroring--cdn-cache-endpoint) | 🔴 Advanced | Architecture / Proxy | `server.ts`, `api/download-apk.ts` |

---

### GFI-01: Keyboard Navigation for Screenshot Lightbox

- **Goal**: Allow users to navigate full-screen screenshots using keyboard keys (`Escape`, `ArrowLeft`, `ArrowRight`).
- **Files to Inspect**:
  - `src/components/MediaUpload/MediaGalleryLightbox.tsx`
- **Problem Statement**:
  When a user expands an app's screenshot or video preview on desktop, pressing the `Escape` key does not dismiss the modal, and keyboard left/right arrow keys do not cycle through adjacent screenshots.
- **Acceptance Criteria**:
  1. Pressing `Escape` while the lightbox is active closes the preview modal.
  2. Pressing `ArrowRight` advances to the next screenshot in the gallery (looping or stopping at the end).
  3. Pressing `ArrowLeft` returns to the previous screenshot.
  4. Active keyboard listeners are properly cleaned up on unmount.
- **Verification**:
  Open an app detail page (e.g. VLC or Blender), click any screenshot thumbnail to open the lightbox, and verify keyboard navigation.

---

### GFI-02: Offline & Empty State Action Card in Search Results

- **Goal**: Display a helpful, styled card with a "Clear Search" or "Retry" button when no results match a query.
- **Files to Inspect**:
  - `src/components/SearchResultsPage.tsx`
  - `src/components/ActiveSearchPage.tsx`
- **Problem Statement**:
  When searching for an unusual term that returns 0 matches, the view can feel blank. A modern Material Design empty state with clear next actions improves user retention.
- **Acceptance Criteria**:
  1. Shows a friendly search illustration/icon when results are empty.
  2. Displays an actionable "Clear query" button that resets the query and focuses the search input.
  3. Displays suggested popular search chips (e.g., "Browsers", "Media Players", "Developer Tools").
- **Verification**:
  Search for `zzxy123` in the store and confirm the empty state renders properly with responsive buttons.

---

### GFI-03: Interactive Share Link Toast & Audio Feedback

- **Goal**: Provide visual toast and optional sound effect feedback when copying app links.
- **Files to Inspect**:
  - `src/components/AppDetailPage.tsx`
  - `src/utils/shareUtils.ts`
  - `src/utils/soundEffects.ts`
- **Problem Statement**:
  When users click the "Share" button on desktop devices where the native Web Share API is unavailable, the URL is silently copied to the clipboard without immediate visual confirmation.
- **Acceptance Criteria**:
  1. When clipboard copy succeeds, show a toast notification: `"App link copied to clipboard!"`.
  2. Trigger the lightweight click audio cue from `soundEffects.ts`.
  3. Gracefully handle clipboard write permission rejections.
- **Verification**:
  Open any app details modal on desktop, click the share icon, and observe toast banner and clipboard contents.

---

### GFI-04: Platform Filter Quick-Chips on Explore View

- **Goal**: Add filter chips (Android, Windows, Linux, Mac, Web) to the top of the Explore categories view.
- **Files to Inspect**:
  - `src/components/ExplorePage.tsx`
  - `src/types.ts`
- **Problem Statement**:
  Users browsing the Explore tab see all application categories simultaneously. Adding quick-select operating system chips allows users to filter categories by target device.
- **Acceptance Criteria**:
  1. Horizontal pill row at the top of ExplorePage with options: `All`, `Android`, `Windows`, `Linux`, `Mac`, `Web`.
  2. Selecting an OS chip filters displayed apps and highlights active filter state.
  3. Selection is preserved across category drilling.
- **Verification**:
  Click the "Explore" tab, tap "Linux", and verify that displayed apps are restricted to Linux deb/AppImage packages.

---

### GFI-05: Static Mock Catalog Sanity Validator Script

- **Goal**: Add a quick validation script to ensure mock catalog integrity.
- **Files to Inspect**:
  - `src/data.ts`
  - `package.json`
- **Problem Statement**:
  Contributors adding new starter apps to `src/data.ts` can inadvertently miss required fields (like `id`, `name`, `category`, `packageFormat`, or `platform`), causing runtime rendering glitches.
- **Acceptance Criteria**:
  1. Add a Node script `scripts/validate_catalog.js` that inspects catalog items.
  2. Checks:
     - `id` is non-empty and unique.
     - `name` is at least 2 characters.
     - `packageFormat` matches recognized formats (`apk`, `exe`, `deb`, `dmg`, etc.).
     - `rating` is between 0 and 5.
  3. Add `"test:catalog": "node scripts/validate_catalog.js"` to `package.json`.
- **Verification**:
  Run `npm run test:catalog` and ensure it exits with code 0 on valid data.

---

### GFI-06: Direct Package Binary File Upload in Console

- **Goal**: Enable developers to directly upload installation binaries (`.apk`, `.exe`, `.deb`, `.dmg`, etc.) from their local disk when their source repository is private or not hosted on public GitHub releases.
- **Files to Inspect**:
  - `src/components/AppConsole.tsx`
  - `src/components/MediaUpload/AppMediaUploader.tsx`
  - `server/s3Storage.ts`
- **Problem Statement**:
  Currently, publishing is optimized around public GitHub release URLs or direct web URLs. For apps with proprietary code or builds stored in private repositories, developers need a native drag-and-drop file upload zone to host binaries securely on Prople Store's storage.
- **Acceptance Criteria**:
  1. Add a "Upload Binary Package" drag-and-drop tab in Step 1 alongside the URL input.
  2. Validate file extensions against recognized package formats (`.apk`, `.aar`, `.exe`, `.msi`, `.deb`, `.appimage`, `.dmg`, `.ipa`, `.zip`).
  3. Client-side checksum generation: automatically compute SHA-256 hash using Web Crypto API (`crypto.subtle.digest`) on upload.
  4. Display upload progress bar, uploaded filename, and detected file size.
  5. Save the uploaded URL directly to `downloadUrl` and populate package metadata automatically.
- **Verification**:
  Open Developer Console, go to Publish New App, drag and drop a test `.apk` file into the upload zone, verify checksum calculation and package info autofill.

---

### GFI-07: Private GitHub Release Access Token Importer

- **Goal**: Allow publishers to input a scoped GitHub Personal Access Token (PAT) to import releases from private GitHub repositories.
- **Files to Inspect**:
  - `api/resolve-apk.ts`
  - `api/github-release-meta.ts`
  - `src/components/AppConsole.tsx`
  - `src/utils/appMetricsAlgorithm.ts`
- **Problem Statement**:
  When a developer enters a release link for a private GitHub repository (`https://github.com/owner/private-repo/releases`), the server gets HTTP 404 or 401 because GitHub restricts release assets to authenticated users with repo read access.
- **Acceptance Criteria**:
  1. Add an optional "Private Repository Access Token" password field with a helper tooltip ("Requires fine-grained token with 'Releases: Read' permission only").
  2. In `api/github-release-meta.ts` and `api/resolve-apk.ts`, send `Authorization: Bearer <token>` when querying GitHub API endpoints if a token is provided.
  3. Never persist or expose the developer's personal token in public client payloads or firestore app documents.
  4. Correctly parse release tags, release notes, and extract binary assets from the authenticated private release.
- **Verification**:
  Provide a test private repo release URL with a test token, verify that release tags and assets load successfully instead of 404.

---

### GFI-08: Private Repo Helper Accordion & Cloud Links in Console

- **Goal**: Add a guided help accordion in Step 1 explaining how developers can publish apps whose source code is in private repositories.
- **Files to Inspect**:
  - `src/components/AppConsole.tsx`
- **Problem Statement**:
  Developers whose code is in private repositories often assume they cannot use Prople Store because the default prompt mentions GitHub releases. Providing clear guidance on alternative hosting solutions (Cloudflare R2, AWS S3, Firebase Storage, Google Drive direct download, self-hosted web servers) reduces onboarding friction.
- **Acceptance Criteria**:
  1. Add an expandable "Hosting from a private repository or self-hosted server?" accordion beneath the release URL field.
  2. Include step-by-step instructions for:
     - Method A: Direct file upload (via GFI-06).
     - Method B: Hosting on Cloudflare R2 / AWS S3 / Firebase Storage with public read URL.
     - Method C: Using private GitHub release tokens (via GFI-07).
  3. Styled cleanly with subtle Google Material borders matching the dark/light theme.
- **Verification**:
  Click the accordion on Step 1 of Publish New App, verify smooth expand/collapse and readable, formatted instructions.

---

### GFI-09: One-Time Binary Release Mirroring & CDN Cache Endpoint

- **Goal**: Implement server-side one-time mirroring of private/external binary packages so that user downloads are delivered fast and reliably from store CDN storage.
- **Files to Inspect**:
  - `server.ts`
  - `api/download-apk.ts`
  - `server/s3Storage.ts`
- **Problem Statement**:
  Streaming binaries repeatedly through GitHub API using a publisher token hits GitHub API rate limits (5,000/hr) and fails if the publisher changes or revokes their token. Mirroring the binary once during release publishing decouples user downloads from GitHub credentials.
- **Acceptance Criteria**:
  1. Add a backend pipeline `/api/mirror-release-package` that takes an authorized release URL and streams the binary to the store's S3/CDN bucket.
  2. Verify SHA-256 integrity after mirroring to guarantee the cached file matches the original release binary.
  3. Point the live app's `downloadUrl` to the mirrored CDN asset.
  4. Ensure downloads bypass GitHub rate limits and work even if the original private repository is later archived or token revoked.
- **Verification**:
  Trigger a mirror action on a test binary URL, verify the binary is saved in cloud storage and download delivers with HTTP 200 via store proxy.

---

## How to Claim an Issue

1. Comment on the corresponding GitHub issue or discussion stating you'd like to work on it:
   > *"I would like to work on GFI-01 (Keyboard Navigation for Screenshot Lightbox)."*
2. Fork the repository and follow the [Contributing Guide](../CONTRIBUTING.md).
3. Test your changes locally (`npm run dev`, `npm run lint`, `npm run build`).
4. Submit a Pull Request referencing the issue ID!
