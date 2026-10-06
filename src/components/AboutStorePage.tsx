import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { usePreserveScroll } from '../services/scrollManager';

interface AboutStorePageProps {
  onBack: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenSecurity?: () => void;
  onOpenAntiPiracy?: () => void;
  onOpenUserConsent?: () => void;
}

export default function AboutStorePage({ 
  onBack, 
  onOpenPrivacy, 
  onOpenTerms,
  onOpenSecurity,
  onOpenAntiPiracy,
  onOpenUserConsent
}: AboutStorePageProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('about-store', scrollRef);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Header aligned with app standard */}
      <header className="h-[60px] sm:h-[68px] bg-theme-bg shrink-0 z-20 w-full border-0">
        <div className="w-full max-w-4xl mx-auto h-full flex items-center justify-between px-2.5 sm:px-4 md:px-6 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 -translate-x-[2px]">
            <button 
              type="button"
              onClick={onBack} 
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center" 
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center min-w-0">
              <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate">About Prople Store</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content Body */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-8 pb-20 max-w-4xl mx-auto w-full outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* Title Header */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-google-sans text-theme-text tracking-tight">
            About Prople Store
          </h1>
          <p className="text-xs sm:text-sm text-theme-text-muted leading-relaxed">
            An open, high-performance multi-platform app store and web store for Android, Apple (iOS/iPadOS), Mac, Linux, and Windows applications, operated by Cloaktail Industries
          </p>
        </div>

        {/* Section 1: Organization & Identity */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            1. Organization &amp; Identity
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Prople Store is an independent multi-platform application store engineered and operated by Cloaktail Industries. As the parent technology organization, Cloaktail Industries builds next-generation developer tooling, distributed systems, and open software platforms designed to empower creators worldwide across desktop and mobile environments.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Prople Store serves as the flagship digital distribution product within the Cloaktail Industries technology ecosystem, combining open-access software principles with an uncompromising, consumer-grade marketplace experience.
          </p>
        </section>

        {/* Section 2: Leadership */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            2. Executive Leadership
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Sahanur Molla is the Founder and Chief Executive Officer of Cloaktail Industries. Under his direction, Cloaktail Industries establishes the architectural standards, cryptographic verification protocols, and strategic roadmap across all ecosystem initiatives, ensuring that Prople Store remains independent, secure, and developer-first.
          </p>
        </section>

        {/* Section 3: Purpose & Multi-Platform App Store Concept */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            3. Purpose &amp; Multi-Platform App Store Concept
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Traditional app distribution platforms have become heavily gated monopolies defined by high fees, mandatory proprietary billing, algorithmic ad auctions, and intrusive telemetry wrappers.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Prople Store was founded to deliver an authentic, bloat-free alternative: a modern distribution engine that connects independent software developers directly to users. We eliminate middlemen hurdles by supporting native GitHub Releases ingestion, letting creators publish signed Android APKs, Apple iOS applications (.ipa), Mac packages (.dmg, .pkg, app bundles), Linux packages (Debian .deb, AppImage, RPM, Flatpak, Tarball), Windows executables (.exe, .msi, .msix), and Web/PWA applications directly from their source repositories with zero repackaging or commission penalties.
          </p>
        </section>

        {/* Section 4: Cryptographic Integrity & Security */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            4. Cryptographic Integrity &amp; Multi-Platform Security Standards
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Trust is the foundation of digital distribution. Every application package hosted or linked through Prople Store—whether an Android APK, Apple iOS package, Mac bundle, Linux package, Windows executable, or Web/PWA application—is distributed in its authentic, developer-signed binary format. Cloaktail Industries never injects proprietary tracking SDKs, modifies app manifests, or alters source binaries.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Each release listing features transparent SHA-256 cryptographic checksums, verified keystore and developer certificate fingerprints, and operating system compatibility signals, allowing security researchers and end users to independently verify the origin and provenance of every release.
          </p>
        </section>

        {/* Section 5: Meritocratic Discovery & Zero-Ad Experience */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            5. Meritocratic Discovery &amp; Zero-Ad Commitment
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Our recommendation algorithms and top charts are governed entirely by Bayesian weighted ratings, real install velocity, and authentic community feedback. We strictly reject sponsored app placements, paid search bidding, and keyword manipulation. On Prople Store, software quality and developer craftsmanship determine visibility.
          </p>
        </section>

        {/* Section 6: Official Contact & Corporate Information */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            6. Official Contact &amp; Executive Information
          </h2>
          <div className="text-[14px] sm:text-[15px] space-y-1.5 text-theme-text-muted leading-relaxed">
            <p><span className="text-theme-text font-medium">Parent Organization:</span> Cloaktail Industries</p>
            <p><span className="text-theme-text font-medium">Founder &amp; CEO:</span> Sahanur Molla</p>
            <p><span className="text-theme-text font-medium">Platform Product:</span> Prople Store</p>
            <p><span className="text-theme-text font-medium">Executive Office:</span> <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a></p>
            <p><span className="text-theme-text font-medium">Developer Organization:</span> <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a></p>
            <p><span className="text-theme-text font-medium">Platform Support:</span> <a href="mailto:prople.site@gmail.com" className="text-blue-500 hover:underline">prople.site@gmail.com</a></p>
          </div>
        </section>

        {/* Clean Text Links */}
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
              Terms and Conditions
            </button>
          )}
          {onOpenUserConsent && (
            <button
              type="button"
              onClick={onOpenUserConsent}
              className="text-blue-500 hover:underline font-medium cursor-pointer"
            >
              Data Collection &amp; Consent
            </button>
          )}
          {onOpenAntiPiracy && (
            <button
              type="button"
              onClick={onOpenAntiPiracy}
              className="text-blue-500 hover:underline font-medium cursor-pointer"
            >
              Anti-Piracy &amp; DMCA
            </button>
          )}
          {onOpenSecurity && (
            <button
              type="button"
              onClick={onOpenSecurity}
              className="text-blue-500 hover:underline font-medium cursor-pointer"
            >
              Apps &amp; Security
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
  );
}
