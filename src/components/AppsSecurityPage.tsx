import React from 'react';
import { ArrowLeft, Lock, CheckCircle2, FileCode, Server, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { usePreserveScroll } from '../services/scrollManager';

interface AppsSecurityPageProps {
  onBack: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenDataSafety?: () => void;
}

export default function AppsSecurityPage({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenDataSafety,
}: AppsSecurityPageProps) {
  const lastUpdated = 'September 23, 2026';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('apps-security', scrollRef);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Top Header */}
      <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 bg-theme-bg shrink-0 gap-3 z-20 w-full border-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 -translate-x-[2px]">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Go back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate leading-tight">
              Apps &amp; Security
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Platform security policy &amp; verification
            </span>
          </div>
        </div>
        <div className="flex-1"></div>
      </header>

      {/* Content Body */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto w-full pb-safe outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-8 pb-20">
          {/* Title Header */}
          <div className="space-y-1.5 sm:space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-google-sans text-theme-text tracking-tight">
              Apps &amp; Platform Security Policy
            </h2>
            <p className="text-xs sm:text-sm text-theme-text-muted">
              Prople Store &bull; A product of Cloaktail Industries &bull; Last updated: {lastUpdated}
            </p>
          </div>

          {/* Section 1: Overview & Foundation */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-theme-text shrink-0" />
              1. Security Philosophy &amp; Architecture
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store is designed with a defense-in-depth security model to deliver verified applications across Android, Linux, Mac, and Windows. Under the operational stewardship of Cloaktail Industries, our mission is to eliminate binary tampering, prevent covert surveillance, and establish verifiable software integrity while maintaining frictionless, account-free user discovery.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              We adhere to strict non-confidential transparency: users and developers have complete insight into our verification criteria, security protocols, and data safety expectations without exposing internal defense mechanisms that could compromise platform integrity.
            </p>
          </section>

          {/* Section 2: Application Verification & Code Integrity */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-theme-text shrink-0" />
              2. Multi-Platform Binary Verification &amp; Hash Integrity
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Every software package distributed through Prople Store undergoes strict provenance validation before it is served to users:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>
                <strong className="text-theme-text font-medium">Cryptographic Checksums:</strong> Release binaries are cross-referenced with upstream cryptographic digests (SHA-256) to ensure files have not been corrupted or modified in transit.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Source &amp; Release Attestation:</strong> Packages originate directly from authenticated publisher repositories and tagged releases (e.g. verified GitHub Releases, official developer builds), eliminating third-party repackaging risks.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Package Format Validation:</strong> Only authentic executable binaries (.apk, .deb, .AppImage, .rpm, .tar.gz, .exe, .msi, .dmg, .pkg) matching strict format standards are accepted. HTML files, source-only archives, or non-executable web pages are rejected by our binary streaming engine.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Package Signing Standards:</strong> Android APK releases must be signed with valid developer release keystores. Unsigned development debug packages or mismatched signature updates are blocked.
              </li>
            </ul>
          </section>

          {/* Section 3: Safe Download Delivery */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2.5">
              <Server className="w-5 h-5 text-theme-text shrink-0" />
              3. Safe Download Delivery &amp; Origin Validation
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              When you download an application from Prople Store, the binary transfer occurs through verified transport protocols:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>
                <strong className="text-theme-text font-medium">Transport Layer Encryption:</strong> 100% of download streams and API calls are secured using modern TLS encryption, preventing eavesdropping and Man-in-the-Middle (MitM) packet tampering.
              </li>
              <li>
                <strong className="text-theme-text font-medium">No Intermediate Ad Injectors:</strong> Unlike conventional mirror sites, Prople Store never injects adware, wrapper installers, browser toolbars, or download managers into app packages.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Anti-Spoofing URL Resolution:</strong> Our server-side release resolution engine rigorously verifies upstream download hosts, rejecting unauthenticated redirects or suspect hostnames.
              </li>
            </ul>
          </section>

          {/* Section 4: Sandboxing & Client Safety */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2.5">
              <FileCode className="w-5 h-5 text-theme-text shrink-0" />
              4. Client Sandboxing &amp; Operating System Permissions
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store operates under the standard security model of your device operating system:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>
                <strong className="text-theme-text font-medium">Zero Root or Administrator Requirements:</strong> Browsing, searching, and installing applications through Prople Store requires no root access, kernel modules, or elevated background services.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Explicit User Consent:</strong> All installations require standard system package manager confirmation. The store cannot silently install or execute code on your device without your explicit permission.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Permission Transparency:</strong> Applications disclose their intended permissions in their Data Safety section before installation, allowing you to review camera, microphone, storage, and network access requirements in advance.
              </li>
            </ul>
          </section>

          {/* Section 5: Zero-Telemetry Privacy Policy */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2.5">
              <EyeOff className="w-5 h-5 text-theme-text shrink-0" />
              5. Privacy-First Catalog Browsing (Zero Surveillance)
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Security and privacy are inextricably linked. Our platform enforces strict surveillance-free operation:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>
                <strong className="text-theme-text font-medium">No User Profiling:</strong> We do not track, profile, or sell your search queries, downloaded apps, or browsing behavior.
              </li>
              <li>
                <strong className="text-theme-text font-medium">No Account Barrier:</strong> Anyone can discover and download applications without registering an account, providing an email, or sharing credentials.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Local Storage Isolation:</strong> User preferences such as theme mode, wishlist items, and search history remain stored locally on your device unless you choose to sign in to sync reviews or publish apps.
              </li>
            </ul>
          </section>

          {/* Section 6: Publisher Security & Release Authorization */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              6. Publisher Security &amp; Release Authorization
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              To prevent unauthorized modifications, impersonation, or malicious takeovers of published software:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>
                <strong className="text-theme-text font-medium">Publisher Authentication:</strong> While downloading is anonymous, publishing or updating applications requires an authenticated developer account with verified credentials.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Strict Ownership Boundaries:</strong> Only the original author who registered an application repository can publish updates. Cross-developer hijacking is programmatically blocked at the database and API levels.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Burst &amp; Quota Safeguards:</strong> Anti-flood rate limiting is enforced on all release endpoints to mitigate automated submission attacks and denial-of-service attempts.
              </li>
            </ul>
          </section>

          {/* Section 7: Media Sanitization & Content Validation */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              7. Media Sanitization &amp; Content Validation
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              All graphical assets (app icons, screenshots, feature graphics) uploaded to the platform are validated by server-authoritative filters:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>
                <strong className="text-theme-text font-medium">Strict Format Validation:</strong> Media payloads are verified for valid image structures (WebP, PNG, JPEG, GIF, AVIF). Non-image files, executable scripts, documents, or active content masked as images are rejected immediately.
              </li>
              <li>
                <strong className="text-theme-text font-medium">Sanitized Asset Rendering:</strong> Image rendering in client interfaces is strictly quarantined from script execution contexts, preventing Cross-Site Scripting (XSS) or image-based payload attacks.
              </li>
              <li>
                <strong className="text-theme-text font-medium">External Asset Restrictions:</strong> External image references must comply with secure HTTPS transport and origin verification.
              </li>
            </ul>
          </section>

          {/* Section 8: Vulnerability Reporting */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-theme-text shrink-0" />
              8. Responsible Disclosure &amp; Security Inquiries
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Cloaktail Industries welcomes constructive collaboration with independent security researchers, developers, and the broader open-source community. If you discover a potential vulnerability, bug, or security concern:
            </p>
            <div className="space-y-1.5 text-[14px] sm:text-[15px] text-theme-text-muted pt-2 leading-relaxed">
              <p className="font-medium text-theme-text">
                Direct Security Contact:
              </p>
              <p>
                Email: <a href="mailto:cloaktailofficial@gmail.com?subject=Prople%20Store%20Security%20Vulnerability%20Report" className="text-blue-500 hover:underline font-mono">cloaktailofficial@gmail.com</a>
              </p>
              <p className="text-xs text-theme-text-muted leading-relaxed pt-1">
                Please include a technical summary, steps to reproduce, and any relevant logs. We ask that researchers observe responsible disclosure by refraining from public disclosure until an appropriate patch is deployed.
              </p>
            </div>
          </section>

          {/* Section 9: Related Policies */}
          <div className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {onOpenPrivacy && (
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Privacy Policy
              </button>
            )}
            {onOpenTerms && (
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Terms of Service
              </button>
            )}
            {onOpenDataSafety && (
              <button
                type="button"
                onClick={onOpenDataSafety}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Data Safety
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="text-blue-500 hover:underline font-medium cursor-pointer"
            >
              Return to Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
