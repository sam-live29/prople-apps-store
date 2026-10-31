# Prople Store — Multi-Platform App Store & Web Store

[![CI](https://github.com/sam-live2c/prople-apps-store-/actions/workflows/ci.yml/badge.svg)](https://github.com/sam-live2c/prople-apps-store-/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B%20%7C%20v22%2B-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)](https://web.dev/progressive-web-apps/)

**Prople Store** is an independent, consumer-grade multi-platform application store and web store operated by **Cloaktail Industries**. It provides verified software distribution across Android, Apple (iOS/iPadOS), Mac (macOS), Linux, Windows, and Web/PWA platforms.

- **Official Marketplace**: [www.prople.co.in](https://www.prople.co.in)
- **Security Policy**: [SECURITY.md](SECURITY.md)
- **Roadmap & Priorities**: [ROADMAP.md](ROADMAP.md)
- **Beginner Issues**: [Good First Issues](docs/GOOD_FIRST_ISSUES.md)
- **Advanced Contributor Challenges**: [Advanced Challenges](docs/ADVANCED_CONTRIBUTOR_CHALLENGES.md)

---

## Supported Platforms & Package Formats

| Platform | Target OS / Runtime | Primary Package Formats |
| :--- | :--- | :--- |
| **Android** | Android 7.0 and up | `.apk` (Standard Package), `.aab` (Android App Bundle) |
| **Apple (iOS / iPadOS)** | iOS 14.0 or later | `.ipa` (iOS Package for sideloading & enterprise distribution) |
| **Mac (macOS)** | macOS 12.0 Monterey or later | `.dmg` (Apple Disk Image), `.pkg` (macOS Installer), `.zip` |
| **Linux** | Universal Linux | `.deb` (Debian/Ubuntu), `.AppImage` (Universal Portable), `.rpm` (Fedora/RHEL), `.flatpak`, `.tar.gz` |
| **Windows** | Windows 10, 11 (64-bit) | `.exe` (Win32/x64 Executable), `.msi` (Windows Installer), `.msix`, `.appx`, `.zip` |
| **Web Store** | Modern Web Browsers | Installable Progressive Web Apps (`.pwa`), Web applications, and live interactive demos |

---

## Key Features

- **Multi-Platform Independent Distribution**: Direct binary distribution for Android APK, Windows EXE/MSI, macOS DMG/PKG, Linux DEB/AppImage, and Progressive Web Apps.
- **GitHub Release Integration**: Seamless ingestion of releases, release notes, and binary artifacts directly from public GitHub repositories.
- **Zero Sponsored Auctions**: 100% Bayesian quality scoring and meritocratic catalog discovery with zero pay-to-play promotions.
- **Developer Publishing Console**: Real-time app submission, media gallery uploads (AWS S3), version changelog management, and publisher analytics.
- **Dual-Layer Authentication & 2FA**: Secure password hashing with PBKDF2-SHA512, 6-digit TOTP verification codes, and Google OAuth integration.
- **Search & Generative Engine Optimization (GEO)**: Automated XML sitemaps, OpenGraph/Twitter cards, Schema.org `@graph` JSON-LD, and `/llms.txt` integration for AI search assistants.
- **Offline & PWA Resilience**: Service Worker background caching, install prompt support, and IndexedDB download checkpointing.

---

## Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend / Server**: Express 4.x running in Node.js 22 with Vite development middleware.
- **Database & Auth**: Firebase Firestore (multi-tenant app catalog), Firebase Authentication, Firebase Realtime Database.
- **Search Engine**: Meilisearch indexer with client-side fallback fuzzy scoring.
- **Storage**: AWS S3 pre-signed upload URLs with strict MIME and magic-byte validation against image poisoning.
- **Transpiler & Bundler**: Vite 6, tsx, esbuild.

---

## Project Structure

```text
├── .github/                   # GitHub workflows, PR templates, and issue forms
│   ├── ISSUE_TEMPLATE/        # Structured YAML issue forms (bugs, features)
│   ├── workflows/ci.yml       # Automated GitHub Actions CI (lint, typecheck, build)
│   └── PULL_REQUEST_TEMPLATE.md # Contributor pull request guidelines
├── api/                       # Serverless API endpoints (Vercel & cloud functions)
│   ├── apps.ts                # Catalog retrieval endpoint
│   ├── auth/[action].ts       # 2FA OTP and authentication gateway
│   ├── download-apk.ts        # Secure binary stream proxy
│   └── github-release-meta.ts # GitHub release asset metadata resolver
├── docs/                      # Contributor and community documentation
│   └── GOOD_FIRST_ISSUES.md   # Beginner-friendly starter tasks with acceptance criteria
├── public/                    # Static public assets, PWA manifests, icons
│   ├── manifest.webmanifest   # Progressive Web App manifest
│   ├── robots.txt             # Search crawler directives & GEO permissions
│   └── sitemap.xml            # XML Sitemap index
├── server/                    # Backend server modules
│   ├── authSecurity.ts        # Rate limiting, IP lockouts, and brute-force defense
│   ├── emailAuth.ts           # Resend & transactional email dispatch logic
│   ├── meilisearch.ts         # Full-text search catalog sync & health monitor
│   ├── otpStore.ts            # Distributed OTP storage and session security
│   ├── s3Storage.ts           # AWS S3 pre-signed URLs and buffer uploads
│   ├── securityDefense.ts     # OWASP defense engine (SSRF, CORS, prototype pollution)
│   └── seoRenderer.ts         # Server-side HTML metadata and JSON-LD injection
├── src/                       # Frontend application source
│   ├── components/            # UI pages, sections, modals, and navigation
│   ├── context/               # React Context providers (Auth, Navigation, Install, Theme)
│   ├── services/              # Client-side business logic and Firebase connectors
│   ├── utils/                 # Security validators, search algorithms, media helpers
│   ├── App.tsx                # Main view router and overlay shell
│   └── main.tsx               # Application bootstrap and PWA service worker mount
├── ROADMAP.md                 # Public product roadmap, priorities, and RFCs
├── server.ts                  # Unified full-stack Express server entry point
├── package.json               # Project manifest, dependencies, and build scripts
├── vite.config.ts             # Vite configuration with PWA and Tailwind plugins
└── tsconfig.json              # TypeScript compiler configuration
```

---

## Quick Start

### 1. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (recommended)
- **npm**: `v10+`

### 2. Clone & Install

```bash
git clone https://github.com/sam-live2c/prople-apps-store-.git
cd prople-apps-store-
npm install
```

### 3. Configure Environment Variables

Copy the example environment template:

```bash
cp .env.example .env
```

Configure your environment keys as required:

| Variable | Description |
| :--- | :--- |
| `FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `FIREBASE_API_KEY` | Firebase Web API Key |
| `FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain |
| `FIREBASE_DATABASE_URL` | Firebase Realtime Database URL |
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key for S3 storage (Optional) |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Access Key for S3 storage (Optional) |
| `AWS_S3_BUCKET` | AWS S3 Bucket Name for media uploads |
| `AWS_REGION` | AWS Region (e.g. `ap-south-1`) |
| `RESEND_API_KEY` | Resend API Key for 2FA verification emails |
| `AUTH_EMAIL_FROM` | Sender address for transactional emails |
| `SESSION_SECRET` | Secret key for signed challenge tokens |
| `MEILISEARCH_HOST` | Meilisearch server host (Default: `http://localhost:7700`) |
| `MEILISEARCH_ADMIN_KEY` | Meilisearch Master/Admin API key |

### 4. Run Development Server

```bash
npm run dev
```

The application will start on **`http://localhost:3000`**.

### 5. Build for Production

```bash
npm run build
npm start
```

---

## Security & Vulnerability Reporting

Please review our [SECURITY.md](SECURITY.md) policy for instructions on coordinating vulnerability disclosures. Do not file public issues for security vulnerabilities.

---

## Contributing

We welcome community contributions from developers, designers, and security researchers worldwide!

- ⚡ **Zero-Config Setup**: Contribute to frontend and UI features with zero cloud API keys using our built-in offline mock mode.
- 📖 [**Good First Issues**](docs/GOOD_FIRST_ISSUES.md): Check out small, well-scoped tasks with clear acceptance criteria.
- 🗺️ [**Roadmap**](ROADMAP.md): Read our strategic milestones and active RFCs.
- 📋 [**Contribution Guidelines**](CONTRIBUTING.md): Review our development setup, coding standards, and PR workflows.
- 🤝 [**Code of Conduct**](CODE_OF_CONDUCT.md): Community behavioral standards.

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for details.

Copyright &copy; 2026 **Cloaktail Industries** (Sahanur Molla). All rights reserved.
