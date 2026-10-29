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

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
   *Fill in your development Firebase, S3, or Resend credentials as needed.*

4. Start the local full-stack development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

---

## Coding Standards & Workflow

- **TypeScript**: All new code must be written in strict TypeScript. Avoid `any` where strong types can be defined.
- **Styling**: Use Tailwind CSS utilities. Adhere to Material Design 3 and Google Sans typography standards.
- **Linting & Validation**: Run typecheck and lint before committing:
  ```bash
  npm run lint
  ```
- **Build Verification**: Ensure the production build completes with zero errors:
  ```bash
  npm run build
  ```

---

## Submitting Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat: add deb package checksum validation"
   ```
3. Push to your fork and open a Pull Request against `main`.
4. Provide a clear description in your PR outlining:
   - What problem is solved
   - How to test the change
   - Any UI screenshots or API responses (if applicable)

---

## Security Disclosures

If your contribution relates to a security vulnerability or sensitive credential exposure, please do **not** open a public issue. Follow our [Security Policy](SECURITY.md) to report responsibly.
