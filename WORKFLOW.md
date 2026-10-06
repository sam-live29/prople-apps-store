# Prople Store: Client-Side Workflows

This document outlines the client-side workflows and tasks for the Prople Store application marketplace.

## Phase 1: App Installation Simulation
**Goal:** Make the "Install" button interactive and simulate the app lifecycle.
- [x] **State Management:** Create a global store (e.g., React Context) or local state to track the installation status of apps by their ID (`installed`, `downloading`, `pending`, `uninstalled`).
- [x] **Download Animation:** When clicking "Install" on the App Details page, transition the button through states:
  - `Pending...` (brief spinner)
  - `Downloading XX%` (progress bar overlay on the button)
  - `Installing...` (spinner)
  - `Play` or `Open` (final state)
- [x] **Cancel Workflow:** Allow users to cancel a download in progress (clicking the 'X' next to the progress bar).
- [x] **Uninstall Workflow:** Allow users to uninstall an app that is already marked as 'installed'.

## Phase 2: Advanced Search Experience
**Goal:** Replicate the active search input and results mechanics.
- [x] **Search Input Overlay:** Ensure the search input behaves as a full-screen overlay with immediate autofocus when triggered.
- [x] **Search History & trending:** Maintain a history of past user searches in `localStorage`, displaying them when the search input is focused.
- [x] **Live Suggestions:** Filter dummy data in real-time as the user types in the search bar.
- [x] **Search Results View:** Transition from the suggestion list to a dedicated "Search Results" page displaying app cards matching the query.

## Phase 3: The "You" (Profile) & Library Workflows
**Goal:** Make the user profile section functional and reflective of interactions.
- [x] **Manage Apps & Device:** Show a list of currently "installed" apps (from Phase 1 state) in the "You" tab.
- [x] **Updates Simulation:** Randomly mark some installed apps as "Update Available" so users can click "Update All".
- [x] **Notifications:** Make the notification bell functional. Add a mock notification when an app finishes "installing".

## Phase 4: Dynamic Content & Categorization
**Goal:** Connect the UI tabs to dynamic data filtering.
- [ ] **Top Charts Rendering:** Ensure the "Top charts" tab filters the global mock data to sort by download counts/ratings.
- [ ] **Categories:** Implement the Category grid so that clicking "Action" or "Productivity" filters the app feed to show only matching items.
- [ ] **App Details Carousels:** Make sure clicking an app from *anywhere* in the UI (Search, Top Charts, You tab) correctly routes to the `AppDetailPage` with that specific app's data.

## Architecture Notes
- We will leverage our existing `App.tsx` state (`activeTab`, `activeAppDetailsId`, `overlay`) effectively to manage screen transitions.
- A central `MockDatabase` (`src/data.ts`) will be expanded to include categories and more realistic metadata.
- If we need persistent states across reloads, we'll wrap our Installation State in a custom hook synced with `localStorage`.
