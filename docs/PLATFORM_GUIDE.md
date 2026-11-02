# Prople Store — Publishing, Browsing & Available Data Guide

> **Platform**: Prople Store (`www.prople.co.in`)  
> **Operated By**: Cloaktail Industries (Founder & CEO: Sahanur Molla)  
> **Last Updated**: November 2026  

This document serves as the authoritative specification for **Publishing**, **Browsing & Discovery**, and **Available Data & Transparency** on Prople Store.

---

## 1. Publishing Architecture & Governance

Prople Store enables independent developers, open-source maintainers, and software organizations to distribute untouched, cryptographically verifiable binaries across **Android, Apple (iOS/iPadOS), Mac (macOS), Linux, Windows, and Web/PWA** without commission fees or proprietary SDK wrappers.

### A. Multi-Source Binary Hosting (Private & Public Codebases)
Developers are **not** restricted to public GitHub repositories. Release packages can be distributed from any verified public HTTPS binary endpoint:
- **Cloud Object Storage & CDNs**: Cloudflare R2, AWS S3, Google Cloud Storage, DigitalOcean Spaces, Backblaze B2, or custom enterprise CDNs. This allows teams with **private source repositories** to distribute compiled binaries directly via public object links without exposing source code or personal access tokens.
- **Self-Hosted VPS & Dedicated Servers**: Direct HTTPS binary links hosted on developer-managed infrastructure.
- **GitHub Releases**: Automated tag, changelog, and multi-asset ingestion via `/api/github-release-meta` and `/api/resolve-apk` for open-source or split-release repositories.

### B. Supported Platforms & Executable Formats
| Platform | Supported Extensions & Formats |
| :--- | :--- |
| **Android** | `.apk`, `.aab` |
| **Apple (iOS / iPadOS)** | `.ipa` |
| **Mac (macOS)** | `.dmg`, `.pkg`, `.zip` |
| **Linux** | `.deb`, `.AppImage`, `.rpm`, `.flatpak`, `.snap`, `.tar.gz` |
| **Windows** | `.exe`, `.msi`, `.msix`, `.appx`, `.zip`, `.7z` |
| **Web (PWA / Web Apps)** | Installable Progressive Web Apps (`.pwa` / HTTPS web manifests) |

### C. The 6-Step Release Wizard
Every new submission and version update passes through a structured 6-step validation pipeline in the Developer Console:
1. **Release**: Input a direct cloud storage URL (R2, S3, VPS, CDN) or GitHub Release URL for automatic binary format, size, and version resolution.
2. **App Info**: Define application title, category, summary tagline, full release description, changelog (`What's New`), and search tags.
3. **Package**: Verify target operating system, minimum OS version, supported CPU architectures (`arm64-v8a`, `x86_64`, `Apple Silicon`, `universal`, etc.), minimum RAM, resolved binary size, and **64-character SHA-256 checksum**.
4. **Media**: Upload or link high-resolution app icons, phone/desktop screenshots, landscape feature graphics, and optional promo videos (validated against MIME/magic-byte spoofing).
5. **Safety & Legal**: Complete mandatory **Data Safety** disclosures (data collected, data shared, deletion policy), declare categorized OS permissions, and provide valid HTTPS links for **Privacy Policy** and **Terms & Conditions** (developers of zero-telemetry apps may adopt Prople Store's official Privacy Policy & Terms).
6. **Review**: Audit all metadata, immutable publisher credentials, and package integrity before instant distributed publication.

### D. Global Publisher Identity & Form Immutability
To prevent per-release impersonation, brand spoofing, or inconsistent attribution:
- **Locked Release Fields**: Inside the publishing and update forms, **Publisher Name**, **Support Email**, and **Distribution Source** are strictly **immutable (read-only)**. Developers cannot alter their publisher name on an individual release.
- **Global Publisher Registry**: Every developer claims a globally unique **Publisher Name** enforced in `publisher_registry`.
- **Universal Profile Propagation**: Publisher Name changes are managed exclusively in **Settings → Edit Profile**. When a developer updates their name in Edit Profile, the new Publisher Name **universally propagates** across their user profile, the global publisher registry, the search index, and every published application and release owned by that account.
- **Cooldown & Grace Window**: After changing a Publisher Name, developers have a **30-minute quick-adjustment grace window** to fix typos, followed by a mandatory **15-day cooldown period** before another name change is permitted.

### E. Ownership Isolation, Quotas & Draft Persistence
- **Strict Ownership Isolation**: Updates and edits are restricted at both API and database levels to the original owner (`uid` and verified account email). Cross-account tampering is rejected with `403 Forbidden`.
- **Submission Rate Limits**:
  - **New Applications**: Maximum **3 new app publications per 15-minute rolling window**.
  - **Version Updates**: Maximum **5 release updates per application per 1-hour rolling window**.
- **Isolated Draft Persistence**: Drafts are persisted locally per user and isolated between new app submissions and per-app release updates, with explicit save/discard confirmation dialogs.

---

## 2. Browsing, Discovery & Download Experience

### A. Zero-Barrier Anonymous Access vs. Authenticated Sync
- **Guest Browsing & Downloading**: Anyone can browse the store, search applications, inspect Data Safety and SHA-256 checksums, save local wishlists, and download binaries **without creating an account or signing in**.
- **Authenticated Features**: Signing in via Google OAuth or Two-Step Verification (PBKDF2-SHA512 Password + 6-digit Email OTP) unlocks cloud-synced Wishlists, submitting and managing Ratings & Reviews, personalized Store Notifications, Profile customization, and Developer Console access.

### B. Discovery Surfaces & Meritocratic Ranking
- **Zero Paid Placements**: Prople Store contains zero sponsored slots, keyword auctions, or ad-network trackers.
- **Home Feed**: Powered by a 4-stage multi-facet layout engine alternating visual archetypes (Hero Spotlights, 3-Row Column Stacks, Landscape Feature Cards, Squircle Rows, Video Previews, and Editorial Features) with strict shelf-to-shelf deduplication.
- **Explore & Categories**: Browse curated software domains across Tools, Productivity, Communication, Media, Developer Tools, Games, Security, and more.
- **Top Charts**: Real-time rankings across *Top Downloads*, *Top Rated*, and *New Releases* computed via **Bayesian weighted scoring** ($\mu = 3.5, m = 5$) and exponential freshness decay.
- **Instant Hybrid Search**: Combines server-side **Meilisearch** indexing with a sub-5ms client-side fuzzy/BM25 fallback engine for instant typo-tolerant suggestions.
- **Hardware & OS Awareness**: Client-side environment detection (`osDetectionService`) identifies Android, iOS/iPadOS, macOS (Apple Silicon / Intel), Linux, Windows, and Web browsers in memory—highlighting compatible binary formats without transmitting device fingerprints to any server.

### C. Contained In-App Direct Downloads & Zero-Byte Pointer Architecture
- **No New-Tab Hijacking**: Download triggers execute synchronously within the current application context without opening blank tabs (`target="_blank"` is prohibited on download triggers), keeping the user's browsing state intact.
- **Zero-Byte Directory Pointer Architecture**: To insulate the platform from regulatory distribution liability and bandwidth degradation, Prople Store never hosts, caches, or proxy-streams compiled executable binaries (`.apk`, `.ipa`, `.exe`, `.dmg`, etc.) through its servers. When a user triggers an app download, `/api/download-apk` issues an immediate HTTP `302 Found` pointer redirect directly to the creator's verified upstream global host (Cloudflare R2, AWS S3, GitHub Releases, or developer VPS) with `Cache-Control: no-store, no-cache` and `Referrer-Policy: no-referrer`. Zero bytes of binary payloads pass through or reside on Prople Store infrastructure.
- **Cloud-Authoritative SHA-256 Verification**: Cryptographic package hashes are verified under the hood via cloud storage checksum headers (`x-amz-checksum-sha256`, `Digest`), sidecar files (`.sha256`), or ephemeral streaming hash checks without storing bytes to disk. The 64-character SHA-256 field remains immutable and automatically copies to the clipboard when clicked.
- **Statutory Intermediary Safe Harbor**: Full protection under Section 79 of the Indian IT Act 2000, EU Digital Services Act (DSA Art. 12), and US 47 U.S.C. § 230 as a technical search and discovery intermediary directory. See root `NOTICE` file.
- **Canonical Routing & Deep Links**: First-class routes (`/apps/:slug`, `/categories/:slug`, `/developers/:slug`, `/platforms/:platform`) support clean browser refreshes, server-side SEO/OpenGraph pre-rendering, and instant SPA hydration.

---

## 3. Available Data & Store Transparency

Prople Store enforces radical transparency for both end users inspecting software and developers/systems querying public catalog metadata.

### A. Public Application & Package Metadata
Every published app exposes the following structured data on its **App Detail**, **About This App**, and **Data Safety** views:
1. **Identity & Attribution**: Canonical slug, App ID, package identifier (`com.example.app`), verified Publisher Name, support contact, official website, Privacy Policy URL, and Terms of Service URL.
2. **Release & Binary Specs**: Version name/tag, primary package format (`.apk`, `.exe`, `.dmg`, `.deb`, `.AppImage`, `.ipa`, `.pwa`), resolved download size, initial release date, latest update timestamp, and formatted release notes (`What's New`).
3. **System Compatibility**: Required OS version (Android, iOS, macOS, Linux, Windows, Web), supported CPU architectures, minimum RAM requirements, and age/content rating classification.
4. **Cryptographic Provenance**: Copyable **64-character SHA-256 binary checksum** and upstream distribution source verification.
5. **Data Safety & Permissions**:
   - **Data Shared**: Explicit disclosure of whether any user data is shared with third parties.
   - **Data Collected**: Itemized categories and purposes of any data processed by the app.
   - **Deletion & Retention Policy**: Developer-declared instructions for requesting user data removal.
   - **Categorized OS Permissions**: Grouped hardware/system access disclosures (e.g., Camera, Microphone, Storage, Network, Location).
6. **Authentic Community Metrics**:
   - **Verified Downloads**: Every newly published app starts strictly at **`0+` downloads** (zero synthetic inflation). Download counters increment only after verified download scheduling checks.
   - **Ratings & Reviews**: Bayesian-aggregated star ratings, rating distribution histograms, verified user reviews, and official developer replies.

### B. Platform Storage & Account Data Boundaries
| Storage Layer | Scope | Stored Data Elements |
| :--- | :--- | :--- |
| **Browser LocalStorage / IndexedDB** | Local Device Only | UI theme (`prople_theme`), local wishlist (`prople_wishlist`), recent search queries, offline catalog cache (`prople-store-db`), and isolated Developer Console drafts. |
| **Firestore `apps`** | Public Catalog | Published application metadata, binary URLs, SHA-256 digests, Data Safety declarations, permissions, and verified download/rating aggregates. |
| **Firestore `publisher_registry`** | Public Attribution | Globally unique claimed Publisher Names mapped to owner UID, update timestamps, and cooldown enforcement metadata. |
| **Firestore `users`** | Private / Account | Authenticated user UID, email, display/publisher name, avatar URL, developer verification status, and name-change cooldown state. |
| **Firestore `reviews`** | Public Feedback | Voluntary star ratings, written review text, optional review media, timestamps, and publisher responses. |

### C. Machine-Readable Endpoints & Open Discovery
- **XML Sitemaps**: `/sitemap.xml` (indexing `/sitemaps/apps.xml`, `categories.xml`, `developers.xml`, `platforms.xml`, and `pages.xml`).
- **Generative Engine Optimization (GEO)**: `/llms.txt` and `/llms-full.txt` providing structured plain-text catalog summaries and specifications for search crawlers and AI assistants.
- **Structured Data**: Pre-rendered Schema.org `SoftwareApplication`, `AggregateRating`, `ItemList`, and `BreadcrumbList` JSON-LD on public routes.
- **Model Context Protocol (MCP)**: Read/discovery tools (`search_apps`, `get_app_details`, `get_download_artifacts`, `get_data_safety_and_security`, `list_trending_and_top_charts`, `list_categories`) exposed via `/api/mcp`.
