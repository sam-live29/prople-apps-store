# Contributing to Prople Store

Thank you for your interest in contributing to **Prople Store**! As an open-source project operated under Cloaktail Industries, we welcome contributions from developers, designers, and security researchers worldwide.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect, patience, and empathy.

---

## Development Setup

### Prerequisites

- **Node.js**: v20.x or v22.x
- **Package Manager**: `npm` (v10 or later)
- **Git**

### Installation

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/sam-live2c/prople-apps-store-.git
   cd prople-apps-store-
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables (**Optional for Local Development**):
   ```bash
   cp .env.example .env
   ```

### ⚡ Zero-Config Local Development Mode (No Secrets Required)

**You do NOT need AWS S3, Resend, or production Firebase credentials to contribute!**

Prople Store features built-in fallback mock layers:
- **Application Catalog**: If Firestore or Meilisearch credentials are left empty in `.env`, the store automatically boots using the rich static offline catalog defined in `src/data.ts`.
- **Media Uploads**: If AWS S3 credentials are unset, image uploads fall back gracefully to in-memory Base64 data URLs in local developer sessions.
- **Authentication & 2FA**: If Resend email delivery is unconfigured, the server logs generated 6-digit OTP codes directly to the terminal console during login testing.

To start developing immediately:
```bash
npm run dev
```
The application will boot on `http://localhost:3000` with full UI, search, category browsing, and local publishing simulation enabled.

---

## Starter Issues for New Contributors

Looking for a good place to start? Check out our curated list:
- 📖 [**Good First Issues Guide**](docs/GOOD_FIRST_ISSUES.md) — 5 actionable, clearly scoped starter tasks with acceptance criteria and files to inspect.
- 🗺️ [**Platform Roadmap**](ROADMAP.md) — Current priorities, planned milestones, and RFCs.

---

## Coding Standards & Workflow

- **TypeScript**: All new code must be written in strict TypeScript. Avoid `any` where strong types can be defined.
- **Styling**: Use Tailwind CSS utilities. Adhere to Material Design 3 and Google Sans typography standards.
- **Linting & Validation**: Run typecheck before committing:
  ```bash
  npm run lint
  ```
- **Catalog Sanity**: Validate the starter catalog:
  ```bash
  npm run test:catalog
  ```
- **Build Verification**: Ensure the production build completes with zero errors:
  ```bash
  npm run build
  ```
- **Testing the Production Server**:
  ```bash
  npm start
  # or to test the pre-compiled server bundle:
  npm run start:bundle
  ```

---

## Submitting Pull Requests & Issues

1. **Pull Requests**:
   - Create a feature branch from `main`:
     ```bash
     git checkout -b feature/your-feature-name
     ```
   - Commit your changes with clear, descriptive commit messages:
     ```bash
     git commit -m "feat: add deb package checksum validation"
     ```
   - Push to your fork and open a Pull Request against `main`. Our [PR Template](.github/PULL_REQUEST_TEMPLATE.md) will guide you through providing the problem statement, testing performed, and UI screenshots.
   - All PRs are automatically validated by [GitHub Actions CI](.github/workflows/ci.yml) across Node 20 and 22.

2. **Issues**:
   - Use our GitHub issue forms for [Bug Reports](.github/ISSUE_TEMPLATE/bug_report.yml) and [Feature Requests](.github/ISSUE_TEMPLATE/feature_request.yml).
   - Please include reproduction steps, environment details, and expected behavior.

---

## Security Disclosures

If your contribution relates to a security vulnerability or sensitive credential exposure, please do **not** open a public issue. Follow our [Security Policy](SECURITY.md) to report responsibly.
