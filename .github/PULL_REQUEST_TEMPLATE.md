## Description

<!--
Provide a clear, detailed summary of the changes in this pull request.
If this resolves an existing issue, please link it: Fixes #123
-->

### Problem Statement / Context
What problem does this PR solve or what feature does it introduce?

### Proposed Solution
Explain your implementation, design choices, and any trade-offs made.

---

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🎨 UI/UX enhancement (visual styling, layout, accessibility)
- [ ] ⚡ Performance improvement / code optimization
- [ ] 🛡️ Security hardening / vulnerability mitigation
- [ ] 📝 Documentation update (README, guides, comments)
- [ ] 🧪 Testing / CI workflow improvement
- [ ] 🔄 Refactoring (no functional changes)

---

## Platforms Affected

- [ ] 🌐 Web / PWA (Browser)
- [ ] 🤖 Android (`.apk`, `.aab`)
- [ ] 🍏 Apple iOS / iPadOS (`.ipa`)
- [ ] 🖥️ Mac (`.dmg`, `.pkg`)
- [ ] 🐧 Linux (`.deb`, `.AppImage`, `.rpm`, `.flatpak`)
- [ ] 🪟 Windows (`.exe`, `.msi`)
- [ ] ⚙️ Server / Backend (`server.ts`, Express API, security middleware)

---

## Testing Performed

<!--
Describe the tests you ran to verify your changes. Include steps so maintainers can reproduce.
-->

### Verification Steps
1. Ran `npm run lint` (typecheck with 0 errors)
2. Ran `npm run build` (production Vite + esbuild compilation succeeded)
3. Tested locally on `http://localhost:3000`

### Test Environment
- **Node.js Version**: v20 / v22
- **Operating System**: Linux / macOS / Windows
- **Browser / Device**: Chrome / Firefox / Safari / Edge / Android WebView

---

## Visual Previews (Screenshots / Screen Recordings)

<!--
If your PR introduces or modifies UI components, please attach before & after screenshots or screen recordings here.
-->

| Before | After |
| :--- | :--- |
| *(Image/GIF)* | *(Image/GIF)* |

---

## Contributor Checklist

- [ ] My code adheres to the project's coding standards and style guidelines.
- [ ] I have executed `npm run lint` with zero errors.
- [ ] I have executed `npm run build` to confirm production build stability.
- [ ] I have not introduced hardcoded secrets, API keys, or private service tokens.
- [ ] I have updated corresponding documentation or comments where necessary.
- [ ] I have verified that changes operate seamlessly in local mock development mode without requiring private cloud credentials.
- [ ] My commits are clear, descriptive, and follow conventional commit formats (`feat:`, `fix:`, `docs:`, etc.).
