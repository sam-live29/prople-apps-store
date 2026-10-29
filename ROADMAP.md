# Prople Store Platform Roadmap

This document outlines the strategic product vision, current engineering priorities, near-term milestones, known limitations, and Request For Comments (RFCs) for **Prople Store**.

---

## 🎯 Strategic Mission

Prople Store aims to be the open, meritocratic multi-platform app store for indie developers and users across **Android, Windows, Linux, macOS, and Web/PWAs**. We prioritize:
- **Zero Sponsored Auctions**: Ranking purely on Bayesian rating, recency, and performance metrics.
- **Direct Independent Publishing**: Zero developer registration fees and direct binary/GitHub release ingestion.
- **Privacy & Safety First**: Explicit permission breakdowns, binary hash verification, and zero third-party telemetry.

---

## 🚀 Current Engineering Priorities (In Progress)

These items are actively being worked on by core maintainers:

- [x] **Local Zero-Config Development**: Seamless frontend and API development mode without requiring private cloud secrets.
- [x] **Automated GitHub Actions CI**: Automated typechecking (`tsc --noEmit`) and production builds across Node.js 20 and 22.
- [ ] **Automated Release Checksum Verification**: SHA-256 binary integrity validation for uploaded APK, EXE, and DEB binaries on direct download.
- [ ] **Cross-Platform Deep Linking (`prople://`)**: Custom protocol handlers and Web Share Target registration for app sharing.
- [ ] **Delta Update System**: Reducing bandwidth consumption on mobile networks by calculating byte diffs between APK versions.

---

## 📅 Roadmap by Milestone

### Phase 1: Contributor Experience & Developer Tooling (Q4 2026)
- **Standardized GitHub Templates**: Issue forms for bug reports, feature requests, and structured pull request templates.
- **Good First Issues**: Documented beginner starter tasks with acceptance criteria (`docs/GOOD_FIRST_ISSUES.md`).
- **Catalog Linting CLI**: Pre-commit validation of app metadata, screenshots, and package formats.
- **Production Server Bundle Standardization**: Single-command execution via `npm start` and `npm run start:bundle`.

### Phase 2: Binary Delivery & Security Hardening (Q1 2027)
- **VirusTotal / ClamAV Ingestion Pipeline**: Asynchronous background scanning of binaries before catalog approval.
- **Reproducible Build Metadata**: Recording commit hashes and build environments for open-source GitHub release imports.
- **Automated PWA Offline Fallbacks**: Background syncing of wishlisted apps and queued offline downloads.
- **GPG & Sigstore Signing**: Sign Prople Store metadata and release manifests with cryptographic signatures.

### Phase 3: Ecosystem Expansion (Q2 2027)
- **Flatpak & Snap Native Repositories**: Expose a standard Linux repo endpoint (`apt`, `flatpak remote-add`) pointing to Prople catalog.
- **Winget & Chocolatey Sync**: Synchronize Windows binaries with the community package manager manifests.
- **Publisher Dashboard Analytics**: Anonymized aggregated installation counts, crash reports, and geographic distribution metrics.
- **Decentralized Storage Mirroring**: IPFS and Arweave fallback mirrors for censorship-resistant software distribution.

---

## ⚠️ Known Limitations & Current Architectural Notes

To help contributors understand existing constraints before opening PRs:

1. **Direct Outbound Networking in Sandbox**:
   - The development sandbox allows HTTP/HTTPS outbound requests. Direct TCP connections to external raw databases (e.g. non-HTTP SQL) are restricted; all database operations route through Firestore REST/SDK or Unix domain sockets.
2. **Ephemeral File Storage**:
   - Local container disks are ephemeral. All user-uploaded screenshots and media must route through S3 pre-signed storage or in-memory buffers; files written directly to `./public` will not persist across container restarts.
3. **Single Dev Process Model**:
   - The dev server runs under a single process (`tsx server.ts`) which multiplexes both the Express API and Vite middleware on port 3000. Do not configure separate concurrent ports for frontend and backend.
4. **HMR in iFrame Contexts**:
   - Vite WebSocket HMR is explicitly disabled (`hmr: false`) in development configuration to prevent iframe cross-origin handshake failures.

---

## 💡 Ideas Needing Discussion (Community RFCs)

We welcome community discussion and proposals for the following concepts. If you'd like to champion one, please open a [GitHub Discussion](https://github.com/sam-live2c/prople-apps-store-/discussions):

- **RFC-1: Torrent / P2P Seeding for Large Desktop Binaries**:
  - Utilizing WebTorrent in browsers and desktop clients to reduce bandwidth costs on large 2GB+ Linux/Windows game and application distributions.
- **RFC-2: Decentralized Review Web-of-Trust**:
  - Mitigating bot reviews using cryptographic challenge proofs or decentralized identity (DID) attestations.
- **RFC-3: Community Curated Lists**:
  - Allowing trusted community maintainers to create and publish curated app collections (e.g. *"Essential Privacy Tools"*, *"Best Indie Games 2026"*).

---

## How to Propose Roadmap Changes

1. Open a discussion under [Discussions > Ideas](https://github.com/sam-live2c/prople-apps-store-/discussions).
2. Outline the rationale, target audience, architectural impact, and whether you are willing to implement it.
3. Maintainers review proposals monthly and update this roadmap accordingly.
