# Prople Store — Multi-Platform App Store Concept, Architectural Audit & Strategic Blueprint

> **Parent Organization**: Cloaktail Industries  
> **Founder & CEO**: Sahanur Molla  
> **Platform**: Prople Store (`prople.store` / `www.prople.co.in`)  
> **Target Platforms**: Android (APK, AAB), Apple (iOS/iPadOS .ipa), Mac (DMG, PKG, .app bundle), Linux (Debian .deb, AppImage, RPM, Flatpak, Tarball), Windows (EXE, MSI, MSIX, Portable ZIP), and Web Store (PWAs / Web Apps)  
> **Official Executive Contact**: `cloaktailsupport@gmail.com`  
> **Developer Organization**: `cloaktailofficial@gmail.com`  
> **Platform Support**: `prople.site@gmail.com`  
> **Latest Architecture Audit**: October 30, 2026  

---

## 1. Platform Concept & Executive Vision

### The Problem With Modern App Distribution
Traditional application stores have evolved into congested, monopolistic gatekeepers characterized by:
1. **Predatory Monetization & Developer Lock-in**: 15%–30% platform cuts, proprietary billing mandates, and restrictive terms that punish independent creators and open-source developers.
2. **Binary Obfuscation & Telemetry Bloat**: Invasive store SDKs, mandatory telemetry wrappers, and opaque repackaging pipelines that compromise binary provenance.
3. **Advertising-Driven Search & Pay-to-Win Discovery**: Search results dominated by sponsored banners, keyword auctions, and algorithmic suppression of authentic indie software in favor of ad-supported corporate applications.
4. **Sluggish, Bloated Client Interfaces**: Heavy web wrappers with multiple navigation spinners, layout shifts (CLS > 0.25), and aggressive user tracking.

### The Prople Store Solution
**Prople Store** is engineered by **Cloaktail Industries** under the leadership of **Sahanur Molla** as an open, high-performance, developer-first multi-platform application store and web store supporting **Android, Apple (iOS/iPadOS), Mac, Linux, Windows, and Web/PWA applications**. It bridges the gap between raw open-source code repositories (such as GitHub Releases) and modern consumer-grade marketplace experiences.

#### Core Pillars:
1. **Multi-Platform Direct-to-Install Integrity**: Untouched, direct-from-source distribution across Android (APKs), Apple (iOS .ipa), Linux (Debian .deb, AppImage, RPM, Tarball), Mac (DMG, PKG, .app bundles), Windows (Executables & Installers), and Web/PWA applications. Every package retains its authentic developer cryptographic signature, with verifiable SHA-256 checksums matching upstream releases.
2. **Zero-Friction GitHub Pipeline & Private Repo Support**: Developers publish directly from their public GitHub repositories or private repositories using direct package uploads, scoped token imports, or cloud storage mirrors without proprietary build repackaging.
3. **Absolute Transparency & Data Safety**: Mandatory Data Safety declarations, clear permission auditing, zero hidden trackers, and no third-party data monetization.
4. **Meritocratic Discovery (Zero Ad Injections)**: Discovery feeds and ranking matrices are governed strictly by Bayesian weighted ratings, real velocity, and genuine community feedback—never by paid search auctions or pay-to-play promotions.
5. **Instantaneous Client Architecture**: Built with strict zero-CLS principles, persistent DOM retention, session-cached feeds, OS-aware detection algorithms, and Google Play / macOS Store-grade visual craftsmanship.
6. **Resilient Publishing & Draft Lifecycle**: Safe, multi-step publishing wizard with robust local persistence, clear discard/save dialogs, and zero accidental data loss.

---

## 2. Platform Architecture & Functional Audit Matrix

| Domain | Current Architecture | Audit Findings & Standard | Status |
| :--- | :--- | :--- | :--- |
| **Multi-Platform Binary Delivery** | Direct streaming via upstream GitHub release assets & mirrors (Android APK, Linux .deb/.AppImage/.rpm, Mac .dmg/.pkg/.zip, Windows .exe/.msi, iOS .ipa) | Binaries are served unaltered without injected middleware. Verified SHA-256 hashes are displayed and copyable for end-user auditing. Dynamic OS detection recommends the appropriate package format for the user's operating system (Android, Linux, macOS, or Windows). | Verified Pass |
| **Developer Console** | Multi-Platform Repo Sync & Publishing Wizard (`AppConsole.tsx`) | Allows one-click release publishing, automated asset parsing, semantic changelog Markdown rendering, and instant catalog updates across Android, Linux, Mac, and Windows targets. | Verified Pass |
| **Draft & Session Resilience** | Validated Draft Engine with explicit Discard/Save confirmation | Form state persists safely during active editing. Purges empty/stale drafts automatically, cleans all account/guest storage keys on discard, and prevents accidental modal hijacking. | Verified Pass |
| **Security Auditing** | Google Play Protect verification flags, Keystore SHA-256 fingerprints, and Anti-Piracy Policy | App detail pages clearly delineate whether an app is verified, open-source, or independently signed. Built-in DMCA and anti-piracy submission pipelines. | Verified Pass |
| **Ranking Engine** | Bayesian Weighted Algorithm ($\mu = 3.5, m = 5$) + Cold-Start Indie Boost | Eliminates review manipulation, prevents 1-review 5.0-star anomalies, and guarantees high visibility for verified newly published software. | Verified Pass |
| **Feed Pacing** | 4-Stage Multi-Facet Slicing Engine with Strict Visual Rhythm | Alternates between 5 distinct UI archetypes (`column_stack`, `landscape_cards`, `squircle_row`, `video_cards`, `editorial_feature`) preventing visual fatigue. | Verified Pass |
| **Client Performance** | Persistent DOM Shell + Memory-Cached Overlays (`z-[70]`) | Zero skeleton reloading on revisited tabs; instantaneous back-stack navigation without losing scroll offsets. Mobile gesture back navigation fully integrated. | Verified Pass |
| **SEO & Entity Graph** | Schema.org `@graph` JSON-LD (`Organization` + `Person` + `WebApplication` + `WebSite`) | Directly ties Prople Store as a multi-platform app store to Cloaktail Industries and Founder Sahanur Molla across search engines and AI crawlers. | Verified Pass |
| **Legal & Privacy** | GDPR, CCPA, and Google API Services Compliant Declarations | Clear user data deletion flows, zero third-party data broker sales, and transparent publisher responsibilities across all operating systems. | Verified Pass |

---

## 3. Private Repository & Proprietary Build Architecture

To support proprietary and closed-source applications alongside open-source software, the platform supports a four-tier distribution architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Binary Ingestion Strategies                       │
├───────────────────────┬─────────────────────────┬──────────────────────┤
│ 1. Direct Upload      │ 2. Scoped Token Proxy   │ 3. Cloud Mirroring   │
│ Drag-and-drop binary  │ Publisher provides PAT  │ Server imports once  │
│ package (.apk/.exe)   │ with Releases:Read      │ to Store CDN storage │
│ directly into Console │ Server streams via API  │ Bypasses rate limits │
└───────────────────────┴─────────────────────────┴──────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Prople Store CDN / Proxy                        │
│                 - High-speed global edge distribution                  │
│                 - Verifiable SHA-256 cryptographic check               │
│                 - Zero telemetry injection                             │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Direct Package Upload (GFI-06)**: Developers upload binaries directly from their computer, hosted on Prople Store's private storage bucket. Source code remains completely private.
2. **Authenticated Private Release Proxy (GFI-07)**: Developers provide a fine-grained token with `Releases: Read` scope. The backend securely authenticates with GitHub API without exposing credentials to client browsers.
3. **One-Time Cloud Mirroring (GFI-09)**: Releases are mirrored once into CDN storage at publish time, ensuring user downloads are never throttled by GitHub rate limits (5,000 req/hr) or broken by token expiration.
4. **Self-Hosted Storage / Custom CDN**: Developers can link direct binary URLs hosted on Cloudflare R2, AWS S3, Firebase Storage, or their own servers.

---

## 4. Platform Governance & Policy Matrix

### A. Developer Publishing Commitments
- **Authentic Ownership**: Publishers must possess legitimate copyright, open-source license rights, or distribution authority for submitted applications.
- **No Malicious Payloads**: Zero tolerance for hidden miners, adware backdoors, spyware, unauthorized access, or unverified permission escalations.
- **Privacy Policy Mandate**: Every listed application must provide an authorized, reachable privacy policy URL or inherit the open-source repository's declared privacy disclosure.
- **Transparency on Monetization**: Any in-app purchases, advertisements, or subscription tiers must be explicitly declared in metadata for consumer warning.

### B. User Protections & Privacy Rights
- **Zero Surveillance**: Prople Store does not sell, trade, or monetize personal user behavior, browsing histories, or query patterns to advertising networks.
- **Instant Data Deletion**: Users can revoke Google OAuth permissions, clear local storage, or request full account and review deletion within 30 days via direct administrative channels.
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
