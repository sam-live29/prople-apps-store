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

## How to Claim an Issue

1. Comment on the corresponding GitHub issue or discussion stating you'd like to work on it:
   > *"I would like to work on GFI-01 (Keyboard Navigation for Screenshot Lightbox)."*
2. Fork the repository and follow the [Contributing Guide](../CONTRIBUTING.md).
3. Test your changes locally (`npm run dev`, `npm run lint`, `npm run build`).
4. Submit a Pull Request referencing the issue ID!
