# Prople Store — Multi-Platform App Store Concept, Architectural Audit & Strategic Blueprint

> **Parent Organization**: Cloaktail Industries  
> **Founder & CEO**: Sahanur Molla  
> **Platform**: Prople Store (`prople.store` / `www.prople.co.in`)  
> **Target Platforms**: Android (APK, AAB), Apple (iOS/iPadOS .ipa), Mac (DMG, PKG, .app bundle), Linux (Debian .deb, AppImage, RPM, Flatpak, Tarball), Windows (EXE, MSI, MSIX, Portable ZIP), and Web Store (PWAs / Web Apps)  
> **Official Executive Contact**: `cloaktailsupport@gmail.com`  
> **Developer Organization**: `cloaktailofficial@gmail.com`  
> **Platform Support**: `prople.site@gmail.com`  
> **Latest Architecture Audit**: November 2026  

---

## 1. Platform Concept & Executive Vision

### The Problem With Modern App Distribution
Traditional application stores have evolved into congested, monopolistic gatekeepers characterized by:
1. **Predatory Monetization & Developer Lock-in**: 15%–30% platform cuts, proprietary billing mandates, and restrictive terms that punish independent creators and open-source developers.
2. **Binary Obfuscation & Telemetry Bloat**: Invasive store SDKs, mandatory telemetry wrappers, and opaque repackaging pipelines that compromise binary provenance.
3. **Advertising-Driven Search & Pay-to-Win Discovery**: Search results dominated by sponsored banners, keyword auctions, and algorithmic suppression of authentic indie software in favor of ad-supported corporate applications.
4. **Sluggish, Bloated Client Interfaces**: Heavy web wrappers with multiple navigation spinners, layout shifts (CLS > 0.25), and aggressive user tracking.

### The Prople Store Solution
**Prople Store** is engineered by **Cloaktail Industries** under the leadership of **Sahanur Molla** as an open, high-performance, developer-first multi-platform application store and web store supporting **Android, Apple (iOS/iPadOS), Mac, Linux, Windows, and Web/PWA applications**. It connects both open-source repositories and proprietary cloud-hosted software releases directly to a modern consumer-grade marketplace experience.

#### Core Pillars:
1. **Multi-Platform Direct-to-Install Integrity**: Untouched, direct-from-source distribution across Android (APKs, AABs), Apple (iOS .ipa), Linux (Debian .deb, AppImage, RPM, Flatpak, Tarball), Mac (DMG, PKG, .app bundles), Windows (Executables & Installers), and Web/PWA applications. Every package retains its authentic developer cryptographic signature, with verifiable SHA-256 checksums and contained in-app downloading (zero new-tab redirects).
2. **Multi-Source Cloud & GitHub Publishing**: Developers publish seamlessly from **Cloudflare R2, AWS S3, self-hosted VPS, custom CDNs**, or **GitHub Releases**—allowing private-repository and proprietary software teams to distribute public binaries without exposing private codebases or tokens.
3. **Global Publisher Identity & Immutability**: Each developer claims a globally unique Publisher Name in **Settings → Edit Profile** that universally propagates across every app and release they own (governed by a 30-minute grace window and 15-day cooldown), while remaining locked and immutable inside individual release forms to eliminate per-release name spoofing.
4. **Absolute Transparency & Available Data**: Mandatory Data Safety declarations, granular categorized OS permissions, copyable SHA-256 digests, hardware/OS compatibility specs, authentic `0+`-baseline verified downloads, and zero third-party data monetization.
5. **Meritocratic Discovery (Zero Ad Injections)**: Discovery feeds and ranking matrices across Home, Explore, Top Charts, Categories, and Meilisearch/fuzzy search are governed strictly by Bayesian weighted ratings, real velocity, and genuine community feedback—never by paid search auctions.
6. **Instantaneous Client & Resilient Draft Lifecycle**: Built with strict zero-CLS principles, persistent DOM retention, session-cached feeds, OS-aware detection, and a stable 6-step publishing wizard with isolated local drafts for new apps vs. updates.

---

## 2. Platform Architecture & Functional Audit Matrix

| Domain | Current Architecture | Audit Findings & Standard | Status |
| :--- | :--- | :--- | :--- |
| **Multi-Platform Binary Delivery** | Contained in-app direct streaming from Cloudflare R2, AWS S3, VPS, CDNs, and GitHub Releases (`.apk`, `.aab`, `.deb`, `.AppImage`, `.rpm`, `.dmg`, `.pkg`, `.exe`, `.msi`, `.ipa`, `.pwa`) | Binaries stream unaltered within the store session without opening external browser tabs (`target="_blank"` eliminated). Copyable SHA-256 hashes and dynamic client OS detection highlight compatible formats automatically. | Verified Pass |
| **Developer Console & Identity** | 6-Step Publishing Wizard (`AppConsole.tsx`) + Global Publisher Registry (`publisherNameService.ts`) | Enforces immutable Publisher Name, Support Email, and Distribution Source per release. Profile name edits in Settings propagate universally across all owned apps/releases with 30m grace + 15d cooldown, plus quota limits (3 new apps/15m, 5 updates/1h). | Verified Pass |
| **Draft & Session Resilience** | Isolated Draft Engine (New App vs. Per-App Update) with Save/Discard confirmation | Form state persists safely per account during active editing. Purges empty/stale drafts automatically, cleans guest/account storage keys on discard, and maintains zero layout shift across step transitions. | Verified Pass |
| **Available Data & Transparency** | `AboutAppPage.tsx` + `DataSafetyPage.tsx` + `AppPermissionsPage.tsx` | Surfaces version, resolved binary size, required OS, CPU architectures, min RAM, SHA-256 checksum, Data Shared/Collected disclosures, deletion policy, categorized permissions, and authentic `0+` starting download counts. | Verified Pass |
| **Security Auditing** | SSRF IP guardrails, SHA-256 checksum pinning, ownership isolation, and Anti-Piracy Policy | Blocks private/loopback URLs, enforces strict per-UID/email release ownership, validates S3 media magic bytes, and provides 24-hour DMCA quarantine pipelines. | Verified Pass |
| **Ranking Engine** | Bayesian Weighted Algorithm ($\mu = 3.5, m = 5$) + Cold-Start Indie Boost | Eliminates review manipulation, prevents 1-review 5.0-star anomalies, and guarantees fair visibility for verified newly published software. | Verified Pass |
| **Feed Pacing & Browsing** | 4-Stage Multi-Facet Slicing Engine + Guest-Accessible Discovery | Alternates between 5 distinct UI archetypes (`column_stack`, `landscape_cards`, `squircle_row`, `video_cards`, `editorial_feature`) across Home, Explore, Top Charts, Categories, and hybrid Meilisearch/client search with zero login walls. | Verified Pass |
| **Client Performance & Routing** | Persistent DOM Shell + SSR/SPA Canonical Route Hydration (`/apps/:slug`) | Zero skeleton reloading on revisited tabs; clean 200 OK refreshes on deep-linked app detail, category, developer, and platform URLs across Express and serverless deployments. | Verified Pass |
| **SEO & Entity Graph** | Schema.org JSON-LD (`SoftwareApplication` + `ItemList` + `BreadcrumbList`) + `/llms.txt` + MCP | Directly ties Prople Store as a multi-platform app store to Cloaktail Industries and Founder Sahanur Molla across search engines and AI crawlers. | Verified Pass |
| **Legal & Privacy** | GDPR, CCPA/CPRA, ePrivacy, and Zero-Surveillance Governance | Exhaustive local storage & Firestore data inventory, 2FA (PBKDF2 + 6-digit Email OTP), 30-day data deletion SLA, and zero third-party data broker sales. | Verified Pass |

---

## 3. Private Repository & Cloud Storage Distribution Architecture

Because private GitHub release asset URLs reject unauthenticated public downloads, Prople Store provides first-class support for **public cloud object storage and self-hosted binary delivery** alongside public GitHub repositories:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Binary Ingestion Strategies                       │
├───────────────────────┬─────────────────────────┬──────────────────────┤
│ 1. Cloud Storage/CDN  │ 2. Self-Hosted VPS      │ 3. GitHub Releases   │
│ Cloudflare R2, AWS S3 │ Direct HTTPS binary URL │ Public repo or split │
│ GCS, Spaces, Backblaze│ from publisher server   │ public releases repo │
└───────────────────────┴─────────────────────────┴──────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Prople Store Resolution & Direct Delivery                │
│        - Contained in-app download stream (no new-tab popups)          │
│        - SSRF-validated HTTPS transport & format verification          │
│        - Verifiable 64-char SHA-256 cryptographic checksum             │
│        - Zero binary repackaging & zero telemetry injection            │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Public Cloud Object Storage (Recommended for Private Repos)**: Developers keep their source code in private repositories and upload compiled release binaries (`.apk`, `.exe`, `.dmg`, `.deb`, `.AppImage`, `.ipa`) to Cloudflare R2, AWS S3, or equivalent object storage, pasting the public HTTPS binary link into Step 1 of the Developer Console.
2. **Self-Hosted VPS / Custom CDN**: Organizations distribute binaries directly from their own HTTPS release servers (`https://releases.example.com/app-v1.2.0.apk`) with full bandwidth control.
3. **Split-Repository Release Pattern**: Teams with private source code publish compiled release artifacts to a dedicated public `releases` repository on GitHub for automated tag and asset resolution.
4. **Public Open-Source GitHub Sync**: Open-source projects paste their GitHub repository or release tag URL to automatically extract release notes, version tags, and compiled platform binaries.

---

## 4. Platform Governance & Policy Matrix

### A. Developer Publishing Commitments
- **Authentic Ownership & Account Isolation**: Publishers must possess legitimate copyright, open-source license rights, or distribution authority. Only the verified owner account (`uid` / email) that registered an app can publish updates to it.
- **Global Publisher Identity**: Publishers maintain one globally unique Publisher Name in **Edit Profile** (propagated universally across all releases, with a 30-minute adjustment window and 15-day cooldown). Publisher identity fields cannot be overridden per release.
- **No Malicious Payloads**: Zero tolerance for hidden miners, adware backdoors, spyware, unauthorized access, or unverified permission escalations.
- **Data Safety & Privacy Policy Mandate**: Every listed application must declare its Data Safety practices, disclose categorized OS permissions, and link an authorized HTTPS Privacy Policy and Terms (or adopt Prople Store's Zero-Surveillance policy for telemetry-free software).

### B. User Protections, Browsing & Privacy Rights
- **Zero-Barrier Anonymous Browsing**: Users can browse, search, inspect package checksums/permissions, and download software with zero account registration.
- **Zero Surveillance**: Prople Store does not sell, trade, or monetize personal user behavior, browsing histories, or query patterns to advertising networks.
- **Instant Data Deletion**: Authenticated users can revoke Google OAuth permissions, clear local storage, or request full account, publisher profile, and review deletion within 30 days via direct administrative channels.
- **Clean Device Removal**: All downloaded applications adhere to standard operating system package management (Android package manager, Linux dpkg/rpm/AppImage, macOS .app/.dmg, Windows uninstaller), enabling clean device-level removal with no residual platform locks.

---

## 5. Entity Disambiguation for Global Search & AI Discovery

```
                         [Cloaktail Industries]
                   (Parent Technology Organization)
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
          [Sahanur Molla]                  [Prople Store]
         (Founder & CEO)            (Multi-Platform App Store)
                  │                               │
                  └───────────────┬───────────────┘
                                  ▼
                [Developer Community & Catalog]
                - Android (APK/AAB) & Mobile Ecosystem
                - Linux (Debian, AppImage, RPM, Tarball)
                - Mac (DMG, PKG, .app Bundles)
                - Windows (Executables & Installers)
                - iOS / iPadOS (.ipa Packages)
                - Direct GitHub & Private Release Ingestion
                - Cryptographic Hash & Keystore Auditing
```

1. **Cloaktail Industries**: The parent technological entity operating the infrastructure, security services, and platform ecosystem.
2. **Sahanur Molla**: Founder & CEO directing the company, defining platform standards, open-source initiatives, and architecture.
3. **Prople Store**: The flagship digital marketplace delivering direct, verified multi-platform application discovery across Android, Apple, Mac, Linux, and Windows.
