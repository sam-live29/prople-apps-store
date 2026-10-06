import React from 'react';
import { ArrowLeft, UserCheck, CheckCircle2, ShieldAlert, EyeOff, Server, HardDrive, Trash2, Cookie, Database, Globe } from 'lucide-react';
import { usePreserveScroll } from '../services/scrollManager';

interface UserConsentPolicyPageProps {
  onBack: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenSecurity?: () => void;
  onOpenAntiPiracy?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenAbout?: () => void;
}

export default function UserConsentPolicyPage({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
  onOpenSecurity,
  onOpenAntiPiracy,
  onOpenHowItWorks,
  onOpenAbout
}: UserConsentPolicyPageProps) {
  const lastUpdated = 'September 2026';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('user-consent-policy', scrollRef);

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
              Data Collection &amp; Consent
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Explicit consent, cookie disclosures &amp; data utilization
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
              Data Collection, Storage &amp; User Consent Charter
            </h2>
            <p className="text-xs sm:text-sm text-theme-text-muted">
              Prople Store &bull; Cloaktail Industries &bull; Founder &amp; CEO: Sahanur Molla &bull; Last updated: {lastUpdated}
            </p>
          </div>

          {/* Section 1: Introduction & Executive Purpose */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-theme-text shrink-0" />
              1. Executive Commitment &amp; Statutory Scope of Consent
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              At Prople Store, operated by Cloaktail Industries under Founder &amp; CEO Sahanur Molla, user privacy and autonomous consent are core architectural tenets. This policy delineates every operational data point processed across Android (APK), Linux (Debian, AppImage, RPM), Mac (DMG, PKG), Windows (EXE, MSI), and Web applications.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              We adhere strictly to global statutory data privacy frameworks, including Regulation (EU) 2016/679 (GDPR Articles 6 &amp; 7), California Consumer Privacy Act as amended by the CPRA (Cal. Civ. Code § 1798.100 et seq.), Directive 2002/58/EC (EU ePrivacy Directive), and Google API Services User Data Policy. Consent is never buried, forced, or implied.
            </p>
          </section>

          {/* Section 2: Complete Data Collection & Usage Matrix */}
          <section className="space-y-4">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Database className="w-5 h-5 text-theme-text shrink-0" />
              2. Exhaustive Data Processing &amp; Purpose Limitation Matrix
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              We minimize data processing strictly to what is technologically essential to operate an open digital marketplace:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] sm:text-[14px] text-theme-text-muted border-collapse">
                <thead>
                  <tr className="border-b border-theme-border/60 text-theme-text font-medium">
                    <th className="py-2.5 px-3 sm:px-4">Category</th>
                    <th className="py-2.5 px-3 sm:px-4">Data Elements</th>
                    <th className="py-2.5 px-3 sm:px-4">Purpose &amp; Statutory Basis</th>
                    <th className="py-2.5 px-3 sm:px-4">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/30">
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Anonymous Browsing</td>
                    <td className="py-3 px-3 sm:px-4">None. No account, email, or device ID required.</td>
                    <td className="py-3 px-3 sm:px-4">Catalog exploration and direct downloads require zero credentials.</td>
                    <td className="py-3 px-3 sm:px-4">Zero persistence.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Two-Step Verification (2FA)</td>
                    <td className="py-3 px-3 sm:px-4">Email address, PBKDF2 cryptographic salt/hash, dynamic 6-digit OTP codes.</td>
                    <td className="py-3 px-3 sm:px-4">Mandatory 2FA account protection (Password + Email OTP) to prevent credential stuffing and account takeover (GDPR Art. 6(1)(b) &amp; Art. 32).</td>
                    <td className="py-3 px-3 sm:px-4">OTP codes expire in 10–15 minutes and are purged atomically upon single use.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Optional Authentication</td>
                    <td className="py-3 px-3 sm:px-4">Email, display name, avatar URL (Google OAuth or OTP).</td>
                    <td className="py-3 px-3 sm:px-4">Authenticating community reviews, ratings, and publishing rights (GDPR Art. 6(1)(b)).</td>
                    <td className="py-3 px-3 sm:px-4">Until deletion or 30 days post-request.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Developer Ingestion</td>
                    <td className="py-3 px-3 sm:px-4">GitHub repository URL, release tags, SHA-256 hashes, contact.</td>
                    <td className="py-3 px-3 sm:px-4">Automated package ingestion and release verification (GDPR Art. 6(1)(b)).</td>
                    <td className="py-3 px-3 sm:px-4">Duration of store listing.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Device Compatibility</td>
                    <td className="py-3 px-3 sm:px-4">OS family (Android, Linux, macOS, Windows), CPU architecture.</td>
                    <td className="py-3 px-3 sm:px-4">Processed locally in browser to highlight compatible binary formats.</td>
                    <td className="py-3 px-3 sm:px-4">Ephemeral; never saved to server.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Security &amp; Abuse Prevention</td>
                    <td className="py-3 px-3 sm:px-4">Anonymized client IP and timestamp for rate-limiting.</td>
                    <td className="py-3 px-3 sm:px-4">Preventing DDoS, review fraud, spam publishing, and scraping attacks (GDPR Art. 6(1)(f)).</td>
                    <td className="py-3 px-3 sm:px-4">Rolling 7 days; auto-purged.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: The Anti-Data-Selling Guarantee */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-theme-text shrink-0" />
              3. The Absolute Anti-Data-Selling Guarantee
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Cloaktail Industries issues this binding, unequivocal guarantee: <strong>Prople Store does not sell, rent, monetize, trade, or share user personal data, search queries, download history, or telemetry with data brokers, advertisers, or third parties under any circumstances.</strong>
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Statutory CCPA/CPRA Compliance:</strong> Because we sell zero personal data, no opt-out sale is necessary, yet we maintain a full &quot;Do Not Sell My Personal Information&quot; legal guarantee across all interfaces.</li>
              <li><strong className="text-theme-text font-medium">No Behavioral Ad Targeting:</strong> We do not build commercial behavioral profiles, nor do we auction search terms or ad placements. Search rankings are governed strictly by meritocratic algorithms (Wilson-Score ratings and authentic download milestones).</li>
              <li><strong className="text-theme-text font-medium">No Data Broker Integrations:</strong> Our server infrastructure connects strictly to cloud database storage (Firebase) and search indexing operated under direct infrastructure control. No third-party data tracking SDKs exist.</li>
            </ul>
          </section>

          {/* Section 4: Direct CDN Streaming & Zero Interception */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Server className="w-5 h-5 text-theme-text shrink-0" />
              4. Direct CDN Streaming &amp; Zero Binary Interception
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Application packages distributed on Prople Store stream directly from the developer&apos;s verified upstream release hosting (such as GitHub Releases CDN, AWS S3, or verified publisher servers):
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Zero Repackaging:</strong> Prople Store never decompiles, injects, modifies, or repackages binaries. The file downloaded by your device is byte-for-byte identical to the developer&apos;s release.</li>
              <li><strong className="text-theme-text font-medium">No Injected Telemetry Wrappers:</strong> We reject the predatory practice of wrapping binaries in store telemetry or ad injection SDKs. Original developer cryptographic signatures are 100% preserved.</li>
              <li><strong className="text-theme-text font-medium">Direct Stream Download Protocol:</strong> Downloads initiate via authentic direct browser stream dispatch executing verified HTTP 302 stream redirection without interrupting your active browsing session.</li>
            </ul>
          </section>

          {/* Section 5: Explicit Voluntary Consent Architecture */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-theme-text shrink-0" />
              5. Explicit Voluntary Consent Architecture
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Under GDPR Article 7 and California CPRA standards, consent must be freely given, specific, informed, and unambiguous. We enforce this through concrete UI boundaries:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">No Pre-Checked Consent Boxes:</strong> We never utilize pre-ticked checkboxes or deceptive dark patterns to coerce consent.</li>
              <li><strong className="text-theme-text font-medium">Synchronous User Action Required:</strong> Downloads and installations only trigger upon an explicit, synchronous click or tap on the &quot;Install&quot; or &quot;Download&quot; button.</li>
              <li><strong className="text-theme-text font-medium">Granular Authentication Consent &amp; Two-Step Verification (2FA):</strong> Account creation and login are protected by mandatory Two-Step Verification (Password + 6-digit Email OTP). Verification codes are single-use, expire in 10–15 minutes, and are verified using constant-time cryptographic checks without persistent retention of unhashed secrets.</li>
              <li><strong className="text-theme-text font-medium">Unconditional Right of Revocation:</strong> You can revoke consent at any moment by signing out, clearing local browser storage, or submitting a formal deletion request.</li>
            </ul>
          </section>

          {/* Section 6: Client-Side Device Storage & Cookie Audit */}
          <section className="space-y-4">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Cookie className="w-5 h-5 text-theme-text shrink-0" />
              6. Client-Side Device Storage &amp; Cookie Audit
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store utilizes browser storage solely for functional operation and offline caching in compliance with the EU ePrivacy Directive:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] sm:text-[14px] text-theme-text-muted border-collapse">
                <thead>
                  <tr className="border-b border-theme-border/60 text-theme-text font-medium">
                    <th className="py-2.5 px-3 sm:px-4">Key / Storage Type</th>
                    <th className="py-2.5 px-3 sm:px-4">Type</th>
                    <th className="py-2.5 px-3 sm:px-4">Data Stored</th>
                    <th className="py-2.5 px-3 sm:px-4">Storage Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/30">
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">prople_theme</td>
                    <td className="py-3 px-3 sm:px-4">LocalStorage</td>
                    <td className="py-3 px-3 sm:px-4">Theme choice (&quot;dark&quot;, &quot;light&quot;, &quot;amoled&quot;)</td>
                    <td className="py-3 px-3 sm:px-4">Client browser only</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">prople_wishlist</td>
                    <td className="py-3 px-3 sm:px-4">LocalStorage</td>
                    <td className="py-3 px-3 sm:px-4">List of bookmarked application IDs</td>
                    <td className="py-3 px-3 sm:px-4">Client browser only</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">prople-store-db</td>
                    <td className="py-3 px-3 sm:px-4">IndexedDB</td>
                    <td className="py-3 px-3 sm:px-4">Catalog metadata for offline fast browsing</td>
                    <td className="py-3 px-3 sm:px-4">Client browser only</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Firebase Session Tokens</td>
                    <td className="py-3 px-3 sm:px-4">IndexedDB</td>
                    <td className="py-3 px-3 sm:px-4">Cryptographic authentication session (if signed in)</td>
                    <td className="py-3 px-3 sm:px-4">Client browser only</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-emerald-500">Ad &amp; Tracking Pixels</td>
                    <td className="py-3 px-3 sm:px-4 font-medium text-emerald-500">None</td>
                    <td className="py-3 px-3 sm:px-4">Zero third-party trackers or cross-site advertising cookies</td>
                    <td className="py-3 px-3 sm:px-4">Completely excluded</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Global Privacy Control (GPC) and Do Not Track (DNT) browser settings are honored globally by default across all client endpoints.
            </p>
          </section>

          {/* Section 7: Strictly Prohibited Data Ingestion */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-theme-text shrink-0" />
              7. Strictly Prohibited Data Ingestion
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              To guarantee complete privacy assurance, Prople Store&apos;s client codebase and server APIs are architecturally barred from querying or storing:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] text-theme-text-muted">
              <li>Precise GPS, GLONASS, or real-time geolocation coordinates.</li>
              <li>Device contacts, phone books, call logs, or SMS message records.</li>
              <li>Hardware persistent identifiers (IMEI, MEID, IMSI, MAC address).</li>
              <li>Biometric templates, fingerprint data, or facial recognition scans.</li>
              <li>Personal browsing history, web activity, or application usage outside the Prople Store origin.</li>
            </ul>
          </section>

          {/* Section 8: Developer Responsibilities */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              8. Developer Data Safety &amp; Publishing Mandates
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Every publisher listing software on Prople Store is legally required to uphold rigorous data transparency:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Mandatory Data Safety Declarations:</strong> Developers must declare all data collected, shared, or processed by their application via the Developer Console.</li>
              <li><strong className="text-theme-text font-medium">Authorized Privacy Policy URL:</strong> Every published listing must link to an active, transparent privacy policy.</li>
              <li><strong className="text-theme-text font-medium">Prohibition of Covert Telemetry:</strong> Applications with undisclosed background location tracking, covert cryptocurrency miners, spyware, or malicious payloads are subject to immediate expulsion.</li>
            </ul>
          </section>

          {/* Section 9: Revocation of Consent & 30-Day SLA */}
          <section className="space-y-3" id="consent-revocation">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-theme-text shrink-0" />
              9. Revocation of Consent &amp; 30-Day Deletion SLA
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              In accordance with GDPR Article 17 (Right to Erasure) and California Civil Code § 1798.105, users have the absolute right to have their personal data permanently erased:
            </p>

            <div className="space-y-2 text-[14px] sm:text-[15px] text-theme-text-muted pt-2 leading-relaxed">
              <p className="font-medium text-theme-text">Step-by-Step Deletion Channels:</p>
              <p>
                1. <strong>Direct Email Request:</strong> Send an email from your registered address to <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a> with the subject <em>&quot;User Consent Revocation &amp; Data Deletion&quot;</em>.
              </p>
              <p>
                2. <strong>Revoke OAuth Authorizations:</strong> Disconnect Prople Store from your Google Account at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">myaccount.google.com/permissions</a> to immediately invalidate session tokens.
              </p>
              <p>
                3. <strong>Clear Browser Storage:</strong> In your browser settings, navigate to Site Settings &rarr; Prople Store &rarr; Clear Data to instantaneously wipe all locally saved bookmarks, theme preferences, and cached entries.
              </p>
              <p className="pt-1 text-xs text-theme-text-muted">
                <strong>Guaranteed SLA:</strong> All verified data erasure requests are completed within thirty (30) calendar days. Associated records in Firebase Authentication and Firestore databases are permanently purged without residual monetization.
              </p>
            </div>
          </section>

          {/* Section 10: Legal Contact */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              10. Privacy Officer Contact &amp; Legal Inquiries
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              For questions regarding our data collection policies, user consent workflows, or regulatory audits, contact Cloaktail Industries executive leadership:
            </p>
            <div className="space-y-1.5 text-[14px] sm:text-[15px] text-theme-text-muted pt-1 leading-relaxed">
              <p><span className="text-theme-text font-medium">Parent Organization:</span> Cloaktail Industries</p>
              <p><span className="text-theme-text font-medium">Founder &amp; CEO:</span> Sahanur Molla</p>
              <p><span className="text-theme-text font-medium">Platform Product:</span> Prople Store</p>
              <p><span className="text-theme-text font-medium">Executive Support:</span> <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a></p>
              <p><span className="text-theme-text font-medium">Developer &amp; Legal:</span> <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a></p>
              <p><span className="text-theme-text font-medium">Platform Support:</span> <a href="mailto:prople.site@gmail.com" className="text-blue-500 hover:underline">prople.site@gmail.com</a></p>
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
