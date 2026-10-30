# Advanced Contributor Challenges (Systems, Algorithms & Core Architecture)

**Target Audience**: Senior Software Engineers, Algorithm Designers, Systems Architects, Backend & Security Specialists  
**Prerequisites**: Familiarity with algorithm design (clustering, ranking, constraint solvers, search indexing), Node.js streaming APIs, cryptographic primitives (WebCrypto / Node `crypto`), HTTP range requests, cloud object storage (AWS S3 / Cloudflare R2), and binary package formats (APK / ELF / PE / Mach-O).

For beginner-friendly tasks (UI micro-interactions, accessibility, catalog validators), please see [**Good First Issues**](GOOD_FIRST_ISSUES.md).

---

## 1. Architectural Context & Security Foundation

Prople Store originated with support for open-source applications distributed via public GitHub releases. As the platform matures, developers who maintain proprietary codebases in **private repositories** (GitHub, GitLab, self-hosted Gitea) or self-host their binaries (AWS S3, Cloudflare R2, private VPS) also need to distribute software seamlessly.

The core challenge for advanced contributors:
> **Deliver high-speed, reliable package distribution and dynamic, intelligent storefront section algorithms while preserving 100% cryptographic transparency, user security, and mathematical integrity.**

### The 4 Distribution Models at a Glance

| Dimension | Model 1: Direct Binary Upload | Model 2: Ephemeral Importer + Mirror | Model 3: Self-Hosted Direct Binary | Model 4: Split Repo (Public Releases) |
| :--- | :--- | :--- | :--- | :--- |
| **Source Privacy** | 100% Private | 100% Private | 100% Private | 100% Private |
| **Storage Host** | Prople S3/R2 Bucket | Prople S3/R2 Bucket | Developer Infrastructure | GitHub CDN (Free) |
| **Token Exposure** | None (Local binary) | Ephemeral read token | None (Direct URL) | None (Public repo) |
| **Integrity Assurance** | Client + Server SHA-256 | Server SHA-256 on mirror | Real-time streaming SHA-256 | GitHub asset checksum |
| **Implementation** | `ADV-02` | `ADV-03` + `ADV-04` | `ADV-01` | Developer documentation |

### Cryptographic Transparency & Threat Model

```
[ External / Self-Hosted URL ]
              │
              ▼
    [ SSRF IP Guardrail ] ─────────► (Blocks 127.0.0.1, 10.0.0.0/8, 169.254.169.254)
              │
              ▼
[ Streaming HTTP Pipe ($O(1)$ RAM) ] ───► [ Node crypto.createHash('sha256') ]
              │                                          │
              ▼                                          ▼
   [ Sidecar Checksum Probe ]                     [ Computed Digest ]
 (e.g., .apk.sha256 / SHA256SUMS.txt)                    │
              │                                          │
              ▼                                          ▼
   [ Integrity Verification ] ◄──────────────────────────┘
              │
              ├───► Match: Stamped with "Double-Verified" Badge in Firestore
              └───► Mismatch: Reject release submission immediately
              │
              ▼
[ Android Keystore Signature Scheme (v2/v3) ]
              │
              ├─── Initial Release: Seal Developer Signing Key in App Record
              └─── Future Update: Require exact match of registered signing key
```

---

## 2. Index of Advanced Challenges

### Part A: Distribution Architecture, Streaming Cryptography & Cloud Pipelines
| ID | Title | Domain | Complexity | Target Files |
| :--- | :--- | :--- | :--- | :--- |
| **ADV-01** | [Automated Streaming SHA-256 Digest & Sidecar Verifier](#adv-01-automated-streaming-sha-256-digest--sidecar-verifier) | Backend / Crypto | 🔴 Advanced | `api/resolve-apk.ts`, `server.ts` |
| **ADV-02** | [Direct Binary Package Multipart Upload with S3/R2](#adv-02-direct-binary-package-multipart-upload-with-s3r2) | Cloud / Full-Stack | 🔴 Advanced | `server/s3Storage.ts`, `src/components/AppConsole.tsx` |
| **ADV-03** | [Scoped Private GitHub Release Importer & Token Sanitizer](#adv-03-scoped-private-github-release-importer--token-sanitizer) | Security / API | 🔴 Advanced | `api/github-release-meta.ts`, `api/resolve-apk.ts` |
| **ADV-04** | [One-Time Binary Release Mirroring & Edge CDN Cache](#adv-04-one-time-binary-release-mirroring--edge-cdn-cache) | Systems / Proxy | 🔴 Advanced | `server.ts`, `api/download-apk.ts` |
| **ADV-05** | [Android Keystore Signature (v2/v3) Fingerprint Parser & Lock](#adv-05-android-keystore-signature-v2v3-fingerprint-parser--lock) | Security / Android | 🔴 Advanced | `api/verify-signature.ts`, `src/components/AppConsole.tsx` |

### Part B: Store Distribution Sections Generation & Algorithmic Systems
| ID | Title | Domain | Complexity | Target Files |
| :--- | :--- | :--- | :--- | :--- |
| **ADV-06** | [Dynamic Store Distribution Section Generator & Category Clustering](#adv-06-dynamic-store-distribution-section-generator--category-clustering) | Feed / Clustering | 🔴 Advanced | `src/utils/dynamicStoreFeedAlgorithm.ts`, `src/utils/productionFeedAlgorithm.ts` |
| **ADV-07** | [Context-Aware Dynamic Ranking & Time-Decay Feed Scoring Engine](#adv-07-context-aware-dynamic-ranking--time-decay-feed-scoring-engine) | Ranking / Math | 🔴 Advanced | `src/utils/productionFeedAlgorithm.ts`, `src/utils/appMetricsAlgorithm.ts` |
| **ADV-08** | [Anti-Gaming Download Velocity & Sybil Review Detection Engine](#adv-08-anti-gaming-download-velocity--sybil-review-detection-engine) | Fraud / Statistics | 🔴 Advanced | `src/utils/appMetricsAlgorithm.ts`, `server/moderation.ts` |
| **ADV-09** | [Multi-Platform Package Asset Matching & Architecture Constraint Solver](#adv-09-multi-platform-package-asset-matching--architecture-constraint-solver) | Systems / Solver | 🔴 Advanced | `src/utils/packageResolution.ts`, `api/resolve-apk.ts` |
| **ADV-10** | [Sub-5ms Client-Side BM25 & Fuzzy Typo-Tolerant Search Engine](#adv-10-sub-5ms-client-side-bm25--fuzzy-typo-tolerant-search-engine) | Search / IR | 🔴 Advanced | `src/utils/searchEngine.ts`, `src/utils/indexedSuggestions.ts` |

---

## Part A: Distribution Architecture & Cloud Storage

### ADV-01: Automated Streaming SHA-256 Digest & Sidecar Verifier

- **Domain**: Cryptographic Verification, Streaming I/O, SSRF Mitigation
- **Files to Inspect**:
  - `api/resolve-apk.ts`
  - `src/components/AppConsole.tsx`
  - `src/types.ts`
- **Problem Statement**:
  When developers submit an external or self-hosted package URL (e.g. `https://downloads.example.com/app-v2.0.apk`), Prople Store detects the binary format, but does not calculate or verify its cryptographic SHA-256 checksum in real time. We cannot rely on unverified client claims, nor can we allow external hosts to modify binaries post-submission without store detection.
- **Detailed Acceptance Criteria**:
  1. **SSRF Guardrail**: Validate host IP before making outbound requests. Reject loopback (`127.0.0.0/8`, `::1`), private CIDR blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`).
  2. **Streaming Hash Computation**:
     - Connect to the binary URL using an HTTP `GET` stream.
     - Pipe chunks into `crypto.createHash('sha256')`.
     - Stream without buffering the full binary into memory (constant $O(1)$ RAM usage).
     - Enforce a 2 GB size cap—terminate the stream if the limit is exceeded.
  3. **Sidecar Auto-Discovery**:
     - Concurrently probe for `URL + '.sha256'` and `dirname(URL) + '/SHA256SUMS.txt'`.
     - If found, extract the declared checksum and cross-verify with the computed hash.
  4. **API Response Payload**:
     ```json
     {
       "success": true,
       "sha256Checksum": "a1b2c3d4...",
       "sidecarFound": true,
       "sidecarChecksum": "a1b2c3d4...",
       "verifiedMatch": true,
       "fileSizeBytes": 45829104,
       "source": "direct_binary"
     }
     ```
  5. **Console Integration**:
     Populate `sha256Checksum` automatically in `AppConsole.tsx` and display a verified cryptographic status indicator.

---

### ADV-02: Direct Binary Package Multipart Upload with S3/R2

- **Domain**: Cloud Storage, Presigned S3 URLs, Client-Side WebCrypto
- **Files to Inspect**:
  - `server/s3Storage.ts`
  - `src/components/AppConsole.tsx`
  - `src/components/MediaUpload/AppMediaUploader.tsx`
- **Problem Statement**:
  Developers compiling proprietary applications locally or in private CI pipelines need to upload their built packages directly to Prople Store's managed object storage without relying on external hosting or public GitHub repositories.
- **Detailed Acceptance Criteria**:
  1. **Presigned Upload Pipeline**:
     - Create `/api/storage/presigned-package-upload` in `server/s3Storage.ts`.
     - Restrict to authenticated developers.
     - Return an S3/Cloudflare R2 presigned PUT URL with enforced Content-Type (e.g. `application/vnd.android.package-archive` for `.apk`) and a 15-minute expiration.
  2. **Client-Side Hashing & Drag-and-Drop**:
     - Add a "Direct File Upload" tab in Step 1 of `AppConsole.tsx`.
     - Compute the SHA-256 hash in-browser using Web Crypto API (`crypto.subtle.digest('SHA-256', buffer)`) with a chunked progress bar for large files.
     - Upload directly to the presigned S3 URL with live byte-progress feedback.
  3. **Metadata Extraction**:
     - Auto-detect filename, size, and package format (`apk`, `exe`, `deb`, `dmg`, etc.).
     - Write the final immutable CDN URL (`https://releases.prople.co.in/...`) into the app draft.

---

### ADV-03: Scoped Private GitHub Release Importer & Token Sanitizer

- **Domain**: Authentication, Secret Zeroization, API Proxy
- **Files to Inspect**:
  - `api/github-release-meta.ts`
  - `api/resolve-apk.ts`
  - `src/components/AppConsole.tsx`
- **Problem Statement**:
  When developers maintain proprietary apps in private GitHub repositories, `api.github.com` requests fail with HTTP 404. Developers can provide a scoped GitHub Personal Access Token (PAT) (with `Releases: Read` scope), but this token must **never** leak into client bundles, public Firestore documents, error logs, or user-facing download links.
- **Detailed Acceptance Criteria**:
  1. **Secure UI Input**:
     - Masked input field: *"Private Repository Personal Access Token (Optional)"*.
     - Disclaimer explaining the token is used strictly in-memory during import and is never stored permanently.
  2. **Backend Secret Zeroization**:
     - Accept token over HTTPS POST payload.
     - Pass `Authorization: Bearer <token>` when querying GitHub Releases API.
     - Strip the token from all responses, logs, error handlers, and database write payloads.
  3. **Error Handling**:
     - Catch `401 Unauthorized` (invalid token) and `403 Forbidden` (insufficient token scope) and return clear, actionable feedback.

---

### ADV-04: One-Time Binary Release Mirroring & Edge CDN Cache

- **Domain**: Systems Architecture, TOCTOU Attack Prevention, Edge Caching
- **Files to Inspect**:
  - `server.ts`
  - `api/download-apk.ts`
  - `server/s3Storage.ts`
- **Problem Statement**:
  Proxying downloads on-the-fly from private repositories using developer tokens exhausts GitHub's 5,000/hour API rate limit and breaks if the developer revokes their token. Furthermore, external URLs are vulnerable to TOCTOU (Time-of-Check to Time-of-Use) attacks if a host changes the binary after publication.
- **Detailed Acceptance Criteria**:
  1. **Mirroring Endpoint**:
     - Implement `/api/mirror-release-package` (authenticated developer endpoint).
     - Stream the binary directly from the private source or external URL into the store's S3/R2 bucket during publication.
     - Compute the SHA-256 checksum during streaming.
  2. **Integrity Validation**:
     - Ensure the mirrored file's SHA-256 matches the approved release checksum. Abort and delete the cached artifact if there is any discrepancy.
  3. **High-Speed CDN Delivery**:
     - Serve user downloads directly from the mirrored CDN asset, decoupled from developer tokens and external rate limits.

---

### ADV-05: Android Keystore Signature (v2/v3) Fingerprint Parser & Lock

- **Domain**: Android Security, Binary Parsing, Tamper Prevention
- **Files to Inspect**:
  - `api/verify-signature.ts`
  - `src/components/AppConsole.tsx`
  - `src/types.ts`
- **Problem Statement**:
  Android applications are cryptographically signed by developers using private keystores. The v2/v3 signing scheme is embedded directly inside the APK file in a dedicated signing block. This certificate's SHA-256 fingerprint is permanent and unforgeable.
- **Detailed Acceptance Criteria**:
  1. **APK Signing Block Parser**:
     - Parse the ZIP End of Central Directory (EOCD) to locate the APK Signing Block (magic value `APK Sig Block 42`).
     - Extract the v2/v3 signer certificate blocks.
     - Compute the SHA-256 digest of the raw X.509 certificate (`certificateFingerprintSha256`).
  2. **Initial Release Registration**:
     - Record `signingCertificateSha256` in Firestore upon initial app publication.
  3. **Update Tamper Lock**:
     - On any update, extract the new APK's certificate fingerprint.
     - If the fingerprint does not match the registered key, automatically **block the update** with an explicit error: `"Security Violation: Update is signed with a different developer keystore than the original release."`
  4. **Transparency Badge**:
     - Render the verified developer certificate fingerprint on the App Detail page alongside the package SHA-256 digest.

---

## Part B: Store Distribution Sections Generation & Algorithmic Systems

### ADV-06: Dynamic Store Distribution Section Generator & Category Clustering

- **Domain**: Feed Generation, Unsupervised Categorization, Shelf Composition
- **Files to Inspect**:
  - `src/utils/dynamicStoreFeedAlgorithm.ts`
  - `src/utils/productionFeedAlgorithm.ts`
  - `src/components/HomePage.tsx`
- **Problem Statement**:
  A static, hardcoded app store layout causes catalog fatigue and fails to adapt as new categories and indie apps are published. We need an autonomous section generation algorithm that dynamically clusters the active catalog into cohesive, thematically aligned horizontal shelves (e.g. *"Top Offline Utilities"*, *"High-Performance Developer Tools"*, *"Verified Community Highlights"*).
- **Mathematical & Algorithmic Requirements**:
  1. **Cluster Partitioning**:
     - Implement k-means or agglomerative category-tag clustering on `tags`, `category`, `subCategory`, and feature flags (`hasOfflineSupport`, `isVerified`, `hasVideoPromo`).
     - Each cluster must contain at least 4 apps and no more than 16 apps.
  2. **Dynamic Section Title & Tag Inference**:
     - Compute category entropy across the cluster. If $\ge 70\%$ of apps belong to one domain, derive specific titles (e.g. *"Media & Creative Suites"*).
     - If cluster is multi-domain but shares a quality trait (e.g., $100\%$ open-source + verified + high rating), derive qualitative titles (e.g., *"Editor's Choice: Essential Open Source"*).
  3. **Visual Layout Diversity Engine**:
     - Intelligently assign layout types to adjacent sections to prevent visual monotony:
       - `column` (3-row compact app grid) for utility and productivity apps.
       - `landscape` (banner card) for media, creative, and visually rich tools.
       - `video` (hero preview card) for apps with verified trailer graphics or gameplay clips.
     - Constraint: Never place two identical layout types in immediately adjacent shelf positions.
  4. **Shelf-to-Shelf Deduplication**:
     - An app appearing in the top 3 positions of a primary shelf must not appear in the subsequent 2 shelves, ensuring catalog breadth.
- **Acceptance Criteria**:
  - Dynamic feed algorithm generates 6 to 12 varied shelves with 0 duplicate apps across immediately adjacent rows.
  - Generates zero empty or single-item shelves.

---

### ADV-07: Context-Aware Dynamic Ranking & Time-Decay Feed Scoring Engine

- **Domain**: Multi-Objective Optimization, Bayesian Inference, Decay Functions
- **Files to Inspect**:
  - `src/utils/productionFeedAlgorithm.ts`
  - `src/utils/appMetricsAlgorithm.ts`
  - `src/data.ts`
- **Problem Statement**:
  Raw download counts unfairly favor old, legacy applications, suppressing innovative new releases. Conversely, sorting solely by rating allows an app with a single 5-star review to outrank a battle-tested app with 10,000 reviews at 4.7 stars. We need a mathematical ranking function that balances freshness, credible ratings, velocity, and platform compatibility.
- **Mathematical Specification**:
  Define the global composite score $S(a, u)$ for an application $a$ under user context $u$:
  $$S(a, u) = W_{\text{bayesian}} \cdot R_{\text{bayesian}}(a) + W_{\text{freshness}} \cdot e^{-\lambda \Delta t} + W_{\text{velocity}} \cdot V(a) + W_{\text{compat}} \cdot C(a, u)$$
  Where:
  - **Bayesian Weighted Rating**:
    $$R_{\text{bayesian}} = \frac{v \cdot \bar{r} + m \cdot C}{v + m}$$
    ($v$ is review count, $\bar{r}$ is app average, $m$ is minimum threshold e.g. 10 reviews, $C$ is global store mean).
  - **Half-Life Freshness Decay**:
    $$e^{-\lambda \Delta t}$$ with a half-life of 30 days for updates and 14 days for initial releases.
  - **Download Velocity**:
    $$V(a) = \log_{10}(\text{recent downloads in last 7 days} + 1)$$
  - **Platform Affinity**:
    $$C(a, u) = 1.0$$ if package format matches user operating system (`.apk` on Android, `.deb`/`AppImage` on Linux, `.dmg` on Mac), $0.2$ if incompatible.
- **Acceptance Criteria**:
  - Implement and unit test the formula in `productionFeedAlgorithm.ts`.
  - Validate that newly updated apps with positive velocity rise dynamically into *"Trending & Fresh"* without completely displacing high-confidence classics.

---

### ADV-08: Anti-Gaming Download Velocity & Sybil Review Detection Engine

- **Domain**: Statistical Anomaly Detection, Fraud Prevention, Trust Scoring
- **Files to Inspect**:
  - `src/utils/appMetricsAlgorithm.ts`
  - `server/moderation.ts`
  - `src/services/adminModerationService.ts`
- **Problem Statement**:
  Malicious publishers may attempt to artificially game store ranks through scripted download bots or coordinated review bombing (both 5-star spam rings and 1-star competitor sabotage). The platform requires an automated anomaly detection algorithm.
- **Detailed Acceptance Criteria**:
  1. **Z-Score Anomaly Detector**:
     - Maintain a rolling 7-day download velocity baseline ($\mu$ and $\sigma$).
     - If current hourly velocity exceeds $Z = \frac{x - \mu}{\sigma} \ge 4.5$ without a corresponding surge in unique IP subnets or verified referrals, flag the spike as an unverified artificial surge.
  2. **Sybil Review Ring Detection**:
     - Group reviews by timestamp windows ($\Delta t \le 10$ minutes).
     - Calculate lexical similarity across review text (Jaccard similarity on 3-grams).
     - If similarity exceeds $0.85$ across multiple accounts created within the same 48-hour window, discount their weight in the Bayesian rating calculation.
  3. **Trust-Weighted Aggregation**:
     - Scale review influence based on user account longevity and whether the user actually downloaded the binary package through the store client.

---

### ADV-09: Multi-Platform Package Asset Matching & Architecture Constraint Solver

- **Domain**: Constraint Satisfaction (CSP), Hardware ABI Matching, Systems Optimization
- **Files to Inspect**:
  - `src/utils/packageResolution.ts`
  - `api/resolve-apk.ts`
  - `src/types.ts`
- **Problem Statement**:
  Modern open-source and proprietary releases frequently bundle dozens of binary assets for a single release tag (e.g., `vlc-3.0.18-arm64-v8a.apk`, `vlc-3.0.18-x86_64.apk`, `vlc-3.0.18.dmg`, `vlc-3.0.18.tar.xz`, `vlc-3.0.18.deb`, `vlc-3.0.18-win64.exe`). Choosing the wrong binary leads to installation failures (`INSTALL_FAILED_NO_MATCHING_ABIS` on Android, architecture mismatch on Linux).
- **Detailed Acceptance Criteria**:
  1. **Target ABI & Architecture Hierarchy**:
     - Android: `arm64-v8a` > `armeabi-v7a` > `universal` > `x86_64`.
     - Linux: Native packages (`.deb` / `.rpm`) vs portable bundles (`.AppImage` / `.flatpak`) based on user distribution hints.
     - macOS: `arm64` (Apple Silicon / M1-M4) vs `x86_64` (Intel) vs `universal`.
     - Windows: `x64` > `arm64` > `x86` installer (`.exe` / `.msi`).
  2. **Bloatware & Non-Installable Filter**:
     - Filter out debug artifacts, checksum sidecars (`.sha256`, `.asc`, `.sig`), developer archives (`-sources.jar`, `-javadoc.jar`, `.aar`), and symbols (`.pdb`).
  3. **Deterministic Tie-Breaking**:
     - When multiple valid binaries match the user's platform, select the package with the most specific architecture tag before falling back to universal builds.
  4. **Fallback Warning**:
     - If only an architecture-incompatible package exists for the user's detected OS, display an informative compatibility alert instead of triggering a doomed download.

---

### ADV-10: Sub-5ms Client-Side BM25 & Fuzzy Typo-Tolerant Search Engine

- **Domain**: Information Retrieval (IR), N-Gram Inverted Indexes, Phonetic Matching
- **Files to Inspect**:
  - `src/utils/searchEngine.ts`
  - `src/utils/indexedSuggestions.ts`
  - `src/components/ActiveSearchPage.tsx`
- **Problem Statement**:
  Users expect instant, keystroke-by-keystroke search suggestions with full tolerance for spelling mistakes, acronyms, and phonetic misspellings (e.g., "blnder" $\to$ "Blender", "gmp" $\to$ "GIMP", "vlc player" $\to$ "VLC Media Player"), without making costly network round-trips for every keypress.
- **Algorithmic Requirements**:
  1. **Inverted Index & Tokenization**:
     - Build an in-memory inverted index of tokenized app titles, package IDs, developer names, and curated keyword tags upon store initialization.
  2. **BM25 Relevance Scoring**:
     - Score matches based on Term Frequency-Inverse Document Frequency (BM25) with parameters $k_1 = 1.2$, $b = 0.75$:
       - Field weights: `title` ($3.0\times$), `packageName` ($2.5\times$), `tags` ($1.8\times$), `summary` ($1.0\times$).
  3. **Fuzzy Typo-Tolerance via Damerau-Levenshtein**:
     - Allow up to 1 edit distance for words $\ge 4$ characters, and up to 2 edit distances for words $\ge 7$ characters.
     - Support prefix trie completions for instant 1-character and 2-character suggestions.
  4. **Performance Benchmark**:
     - Index generation must execute in $< 50\text{ms}$ on a catalog of 2,500 items.
     - Single-query search execution must complete in $< 5\text{ms}$ on low-end mobile devices.

---

## 3. Contribution & Review Process for Advanced Issues

1. **RFC & Design Discussion**: Open an issue thread with your proposed mathematical model or architecture schema before submitting large PRs.
2. **Computational Complexity & Benchmarks**: All algorithmic additions (feed generators, search indexing, constraint solvers) must specify their time/space complexity ($O(N)$) and provide performance benchmark tests.
3. **Security & Zero-Leakage Audit**: PRs touching tokens, cryptographic verification, or external URL streaming undergo automated security scanning and maintainer review.
