import React from 'react';
import { ArrowLeft, ShieldAlert, CheckCircle2, FileCode, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { usePreserveScroll } from '../services/scrollManager';

interface AntiPiracyPolicyPageProps {
  onBack: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenSecurity?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenUserConsent?: () => void;
  onOpenAbout?: () => void;
}

export default function AntiPiracyPolicyPage({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenSecurity,
  onOpenHowItWorks,
  onOpenUserConsent,
  onOpenAbout
}: AntiPiracyPolicyPageProps) {
  const lastUpdated = 'September 2026';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('anti-piracy-policy', scrollRef);

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
            <ArrowLeft className="w-5 h-5 text-theme-text" />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate leading-tight">
              Anti-Piracy &amp; DMCA
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Intellectual property &amp; copyright enforcement
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
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-8 pb-24">
          {/* Title Header */}
          <div className="space-y-1.5 sm:space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-google-sans text-theme-text tracking-tight">
              Anti-Piracy, Intellectual Property &amp; DMCA Policy
            </h2>
            <p className="text-xs sm:text-sm text-theme-text-muted">
              Prople Store &bull; Operated by Cloaktail Industries &bull; Executive Leadership: Sahanur Molla &bull; Last updated: {lastUpdated}
            </p>
          </div>

          {/* Section 1: Executive Zero-Tolerance Charter */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Lock className="w-5 h-5 text-theme-text shrink-0" />
              1. Zero-Tolerance Anti-Piracy Charter
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store, engineered and governed by Cloaktail Industries under Founder &amp; CEO Sahanur Molla, enforces a zero-tolerance mandate against digital piracy, counterfeit application software, unauthorized redistribution, cracked binaries, and intellectual property theft.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Our platform is built to celebrate authentic software engineering, indie creators, and verified open-source communities. We strictly prohibit the indexing, hosting, linking to, or distribution of warez, bypass tools, keygens, patched commercial APKs, reverse-engineered executables, or modified binaries that circumvent licensing restrictions.
            </p>
          </section>

          {/* Section 2: Prohibited Piracy & Counterfeiting Activities */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-theme-text shrink-0" />
              2. Prohibited Infringing &amp; Counterfeit Practices
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Any publisher, developer, or submitter is strictly barred from publishing or circulating:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Cracked &amp; Patched Packages:</strong> Binaries modified to bypass subscription paywalls, digital rights management (DRM), in-app purchases, or developer licensing checks.</li>
              <li><strong className="text-theme-text font-medium">Unauthorized Repackaging:</strong> Third-party repackaging of upstream open-source or proprietary software containing injected advertisements, telemetry wrappers, spyware, or malicious code.</li>
              <li><strong className="text-theme-text font-medium">Trademark Impersonation:</strong> Deceptive use of protected brand names, registered trade dress, official application icons, or publisher identities designed to mislead consumers into believing an app originates from an official vendor.</li>
              <li><strong className="text-theme-text font-medium">Circumvention Utilities:</strong> Tools, exploits, or key generation software whose primary design or commercial purpose is to defeat copyright protections or software licensing servers.</li>
              <li><strong className="text-theme-text font-medium">Unauthorized Commercial Redistribution:</strong> Re-uploading proprietary commercial software without explicit, demonstrable written authorization from the copyright holder.</li>
            </ul>
          </section>

          {/* Section 3: Verified Developer Ownership & License Compliance */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-theme-text shrink-0" />
              3. Verified Publisher Rights &amp; Open-Source Compliance
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Every publisher listing an application on Prople Store affirms, represents, and warrants that:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>They are the sole authentic author and copyright owner, or have obtained verified legal authorization to distribute the software package across the designated platforms (Android, Windows, Linux, or macOS).</li>
              <li>If the software incorporates open-source components (e.g., GPL v2/v3, LGPL, Apache 2.0, MIT, BSD, MPL), the submission strictly adheres to the applicable license terms, including the retention of original copyright notices, license texts, and source code availability where mandated.</li>
              <li>Binaries are compiled directly from clean, unadulterated source code without hidden surveillance payloads, unauthorized affiliate redirects, or telemetry harvesters.</li>
            </ul>
          </section>

          {/* Section 4: Cryptographic SHA-256 Digest Verification */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-theme-text shrink-0" />
              4. Cryptographic Binary Authenticity Standard
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              To preserve absolute binary authenticity, Prople Store mandates cryptographic integrity verification:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li>Published packages are matched directly against official upstream developer release repositories (such as verified GitHub release assets or signed publisher CDNs).</li>
              <li>Every verified listing displays a pinned 64-character SHA-256 checksum digest. If a binary's bitwise checksum differs from the author's declared build artifact, the distribution is quarantined and denied from download delivery.</li>
            </ul>
          </section>

          {/* Section 5: Notice & Takedown Procedure (DMCA Compliance) */}
          <section className="space-y-3" id="dmca-takedown">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <FileCode className="w-5 h-5 text-theme-text shrink-0" />
              5. DMCA &amp; International Copyright Takedown Procedure
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Cloaktail Industries complies with the Digital Millennium Copyright Act (17 U.S.C. § 512) and international intellectual property treaties. If you believe your copyrighted software, artwork, brand asset, or trademark has been infringed by a listing on Prople Store, you may submit a formal Notice of Infringement to our designated legal team.
            </p>
            <p className="font-medium text-theme-text pt-1 text-[14px] sm:text-[15px]">Required Information in a Takedown Notice:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] text-theme-text-muted">
              <li>A physical or electronic signature of the person authorized to act on behalf of the copyright owner.</li>
              <li>Clear identification of the copyrighted work claimed to have been infringed (e.g., title, registration number, or authorized repository URL).</li>
              <li>Specific identification of the allegedly infringing material on Prople Store, including direct application URL, App ID, package name, or screenshot.</li>
              <li>Your contact information, including full legal name, mailing address, telephone number, and official email address.</li>
              <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement made under penalty of perjury that the information in the notification is accurate, and that you are authorized to act on behalf of the owner.</li>
            </ul>
            
            <div className="space-y-1.5 text-[14px] sm:text-[15px] text-theme-text-muted pt-2 leading-relaxed">
              <p className="font-medium text-theme-text">Designated Copyright Agent Contact:</p>
              <p className="text-theme-text-muted">Cloaktail Industries Legal &amp; Copyright Affairs</p>
              <p className="text-theme-text-muted">Attention: Founder &amp; CEO Sahanur Molla</p>
              <p className="text-theme-text-muted">Email: <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a></p>
              <p className="text-theme-text-muted">Secondary Support: <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a></p>
              <p className="text-theme-text-muted">Platform Operations: <a href="mailto:prople.site@gmail.com" className="text-blue-500 hover:underline">prople.site@gmail.com</a></p>
            </div>
          </section>

          {/* Section 6: Expedited Quarantine & Repeat Infringer Policy */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              6. Rapid Takedown &amp; Repeat Infringer Sanctions
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Upon receipt of a substantiated copyright notification, Cloaktail Industries initiates immediate remediation:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Rapid Quarantine:</strong> The contested application listing and binary download links are immediately quarantined and hidden from global catalog discovery within twenty-four (24) hours of receipt.</li>
              <li><strong className="text-theme-text font-medium">Publisher Notification:</strong> The uploader is promptly notified with the details of the infringement claim and given the statutory opportunity to respond.</li>
              <li><strong className="text-theme-text font-medium">Strict Repeat Infringer Rule:</strong> In accordance with statutory safe harbor mandates, any publisher account found to repeatedly infringe third-party copyrights faces permanent account revocation and blacklisting.</li>
            </ul>
          </section>

          {/* Section 7: Counter-Notification Procedure */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              7. Counter-Notification Procedure
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              If a developer believes their software was delisted or disabled as a result of mistake or misidentification, they may file a formal Counter-Notification including:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] text-theme-text-muted">
              <li>The developer's physical or electronic signature.</li>
              <li>Identification of the material that has been removed or disabled, and the location where it appeared prior to removal.</li>
              <li>A statement under penalty of perjury that the developer has a good-faith belief that the material was removed as a result of mistake or misidentification.</li>
              <li>The developer's legal name, address, telephone number, and consent to legal jurisdiction.</li>
            </ul>
          </section>

          {/* Section 8: Strict Anti-Data-Selling Guarantee */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              8. Anti-Data Selling &amp; Commercial Exploitation Prohibition
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              In alignment with our Zero-Surveillance Charter, Cloaktail Industries firmly establishes that intellectual property governance and compliance enforcement will never be monetized through commercial surveillance. We do not sell, rent, monetize, or trade publisher records, catalog analytics, or user browsing activity to third-party data brokers or marketing conglomerates.
            </p>
          </section>

          {/* Section 9: Executive Governance Contacts */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              9. Executive Governance &amp; Inquiries
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              For direct inquiries regarding software licensing verification, open-source compliance, or legal disputes, please reach out to our executive office:
            </p>
            <div className="space-y-1.5 text-[14px] sm:text-[15px] text-theme-text-muted pt-1 leading-relaxed">
              <p><span className="text-theme-text font-medium">Parent Organization:</span> Cloaktail Industries</p>
              <p><span className="text-theme-text font-medium">Founder &amp; CEO:</span> Sahanur Molla</p>
              <p><span className="text-theme-text font-medium">Platform Product:</span> Prople Store</p>
              <p><span className="text-theme-text font-medium">Executive Legal Email:</span> <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a></p>
              <p><span className="text-theme-text font-medium">Developer Security Email:</span> <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a></p>
              <p><span className="text-theme-text font-medium">Support Operations:</span> <a href="mailto:prople.site@gmail.com" className="text-blue-500 hover:underline">prople.site@gmail.com</a></p>
            </div>
          </section>

          {/* Related Links */}
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
            {onOpenSecurity && (
              <button
                type="button"
                onClick={onOpenSecurity}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Apps &amp; Security
              </button>
            )}
            {onOpenHowItWorks && (
              <button
                type="button"
                onClick={onOpenHowItWorks}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                How It Works
              </button>
            )}
            {onOpenAbout && (
              <button
                type="button"
                onClick={onOpenAbout}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                About Prople Store
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
