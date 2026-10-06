import React from 'react';
import { usePreserveScroll } from '../services/scrollManager';
import { 
  ArrowLeft, 
  Shield, 
  Lock, 
  EyeOff, 
  UserCheck, 
  HardDrive, 
  FileCheck, 
  Server, 
  AlertCircle, 
  Cookie, 
  Scale, 
  Globe, 
  Database 
} from 'lucide-react';

interface PrivacyPolicyPageProps {
  onBack: () => void;
  onOpenTerms?: () => void;
  onOpenAbout?: () => void;
  onOpenSecurity?: () => void;
  onOpenAntiPiracy?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenUserConsent?: () => void;
}

export default function PrivacyPolicyPage({ 
  onBack,
  onOpenTerms,
  onOpenAbout,
  onOpenSecurity,
  onOpenAntiPiracy,
  onOpenHowItWorks,
  onOpenUserConsent
}: PrivacyPolicyPageProps) {
  const lastUpdated = 'September 2026';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('privacy-policy', scrollRef);

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
              Privacy &amp; Cookie Policy
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Zero-surveillance data governance &amp; legal charter
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
              Privacy Policy, Cookie Disclosures &amp; Data Governance
            </h2>
            <p className="text-xs sm:text-sm text-theme-text-muted">
              Prople Store &bull; Cloaktail Industries &bull; Founder &amp; CEO: Sahanur Molla &bull; Last updated: {lastUpdated}
            </p>
          </div>

          {/* Section 1: Overview & Organizational Architecture */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Lock className="w-5 h-5 text-theme-text shrink-0" />
              1. Overview &amp; Corporate Identity
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store is an independent, multi-platform digital application marketplace developed and operated by Cloaktail Industries. Under the executive leadership of Founder &amp; CEO Sahanur Molla, Cloaktail Industries is dedicated to open software ecosystems, binary transparency, and user privacy across Android, Linux, Mac, and Windows applications.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              This Privacy Policy articulates our comprehensive legal and technical data governance practices: what limited information we process, the statutory legal bases for processing, our strict prohibition against user tracking or data monetization, our exhaustive cookie disclosures, and the concrete mechanisms available to exercise statutory data rights under GDPR, CCPA/CPRA, and international data protection laws.
            </p>
          </section>

          {/* Section 2: Zero-Surveillance & Anti-Data-Selling Charter */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-theme-text shrink-0" />
              2. The Zero-Surveillance &amp; Anti-Data-Selling Covenant
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Cloaktail Industries operates Prople Store under an absolute zero-surveillance covenant. We fundamentally reject the surveillance economy:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Zero Data Selling or Commercial Brokering:</strong> We do not sell, rent, monetize, license, or trade user personal data, telemetry records, search queries, or download activities to advertisers, data brokers, algorithmic hedge funds, or commercial third parties under any circumstances (CCPA/CPRA Cal. Civ. Code § 1798.120 compliant).</li>
              <li><strong className="text-theme-text font-medium">No Binary Tampering or Tracking Injection:</strong> We do not inject tracking SDKs, telemetry listeners, advertising libraries, or surveillance wrappers into publisher binaries or packages (including Android APKs, Linux Debian/AppImage packages, Mac bundles, or Windows executables). All software packages are distributed untouched with original developer signatures.</li>
              <li><strong className="text-theme-text font-medium">No Cross-Site Ad Tracking or Device Fingerprinting:</strong> We do not deploy cross-site tracking cookies, canvas fingerprinting scripts, behavioral advertising beacons, or pixel trackers across our marketplace interfaces.</li>
              <li><strong className="text-theme-text font-medium">Zero Telemetry Surreptitious Harvesting:</strong> We do not collect hidden background analytics, battery status, ambient sensor readings, or peripheral usage data.</li>
            </ul>
          </section>

          {/* Section 3: Comprehensive Cookies & Web Storage Policy */}
          <section className="space-y-4">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Cookie className="w-5 h-5 text-theme-text shrink-0" />
              3. Comprehensive Cookies &amp; Local Storage Policy
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              In accordance with Directive 2002/58/EC (EU ePrivacy Directive, as amended by Directive 2009/136/EC), UK Privacy and Electronic Communications Regulations (PECR), and California AB 370, this section provides an exhaustive, transparent audit of all client-side storage technologies utilized on Prople Store.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] sm:text-[14px] text-theme-text-muted border-collapse">
                <thead>
                  <tr className="border-b border-theme-border/60 text-theme-text font-medium">
                    <th className="py-2.5 px-3 sm:px-4">Storage Key / Tech</th>
                    <th className="py-2.5 px-3 sm:px-4">Classification</th>
                    <th className="py-2.5 px-3 sm:px-4">Exact Purpose</th>
                    <th className="py-2.5 px-3 sm:px-4">Lifespan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/30">
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">prople_theme (LocalStorage)</td>
                    <td className="py-3 px-3 sm:px-4">Strictly Necessary</td>
                    <td className="py-3 px-3 sm:px-4">Preserves user interface theme selection (Dark / Light / AMOLED).</td>
                    <td className="py-3 px-3 sm:px-4">Persistent until cleared by user.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">prople_wishlist (LocalStorage)</td>
                    <td className="py-3 px-3 sm:px-4">Functional Preference</td>
                    <td className="py-3 px-3 sm:px-4">Stores saved bookmark app IDs on the local device without server tracking.</td>
                    <td className="py-3 px-3 sm:px-4">Persistent until cleared by user.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">Firebase Auth Tokens (IndexedDB / Session)</td>
                    <td className="py-3 px-3 sm:px-4">Strictly Necessary</td>
                    <td className="py-3 px-3 sm:px-4">Maintains voluntary session state when user signs in to review apps or publish software.</td>
                    <td className="py-3 px-3 sm:px-4">Session or until explicit user sign-out.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">prople-store-db (IndexedDB)</td>
                    <td className="py-3 px-3 sm:px-4">Functional Performance</td>
                    <td className="py-3 px-3 sm:px-4">Caches catalog metadata locally on device to enable instantaneous offline browsing.</td>
                    <td className="py-3 px-3 sm:px-4">Persistent on device, refreshes on network revalidation.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-theme-text">PWA Service Worker Cache</td>
                    <td className="py-3 px-3 sm:px-4">Functional Performance</td>
                    <td className="py-3 px-3 sm:px-4">Caches web application static assets (HTML/JS/icons) for fast PWA execution.</td>
                    <td className="py-3 px-3 sm:px-4">Managed automatically by browser cache storage.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 sm:px-4 font-medium text-emerald-500">Third-Party Tracking Cookies</td>
                    <td className="py-3 px-3 sm:px-4 font-medium text-emerald-500">PROHIBITED</td>
                    <td className="py-3 px-3 sm:px-4">None. We do not use Google AdSense, Facebook Pixel, TikTok SDK, or marketing cookies.</td>
                    <td className="py-3 px-3 sm:px-4">Zero.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-2 text-[14px] sm:text-[15px] text-theme-text-muted leading-relaxed">
              <p className="font-medium text-theme-text">Do Not Track (DNT) &amp; Global Privacy Control (GPC):</p>
              <p>
                Prople Store natively respects and complies with all automated browser privacy signals, including Global Privacy Control (&quot;GPC&quot;) and Do Not Track (&quot;DNT&quot;). Because we do not track users or sell data, your privacy is fully protected regardless of whether a signal is transmitted.
              </p>
              <p className="font-medium text-theme-text pt-2">Managing Storage &amp; Cookies via Your Browser:</p>
              <p>
                You have the absolute legal and technical right to manage or clear storage items at any time through your browser settings:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li><strong className="text-theme-text font-medium">Google Chrome / Android Chrome:</strong> Settings &gt; Privacy and security &gt; Third-party cookies &gt; Clear browsing data &gt; Cookies and other site data.</li>
                <li><strong className="text-theme-text font-medium">Mozilla Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data &gt; Clear Data.</li>
                <li><strong className="text-theme-text font-medium">Apple Safari (macOS / iOS):</strong> Settings &gt; Safari &gt; Advanced &gt; Website Data &gt; Remove All Website Data.</li>
                <li><strong className="text-theme-text font-medium">Microsoft Edge:</strong> Settings &gt; Cookies and site permissions &gt; Manage and delete cookies and site data.</li>
              </ul>
            </div>
          </section>

          {/* Section 4: Collected Data Utilization & Statutory Legal Bases */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Database className="w-5 h-5 text-theme-text shrink-0" />
              4. Collected Data Utilization &amp; Statutory Legal Bases (GDPR Art. 6 &amp; 13)
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              We process personal data solely on established statutory legal grounds under Regulation (EU) 2016/679 (General Data Protection Regulation):
            </p>

            <div className="space-y-4 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <div className="space-y-1">
                <p className="font-medium text-theme-text">A. Performance of a Contract (GDPR Art. 6(1)(b)):</p>
                <p>Delivering application marketplace services, routing binary downloads, maintaining developer publisher accounts, processing developer submissions, and providing core platform features requested by users.</p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-theme-text">B. Legitimate Commercial &amp; Security Interests (GDPR Art. 6(1)(f)):</p>
                <p>Preventing fraudulent activity, mitigating denial-of-service (DDoS) attacks, detecting counterfeit and malicious APK/package uploads, verifying cryptographic SHA-256 binary digests, enforcing rate limits, and securing cloud infrastructure.</p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-theme-text">C. Affirmative User Consent (GDPR Art. 6(1)(a)):</p>
                <p>Publishing voluntary community reviews, star ratings, and developer contact details displayed in public listings. Consent may be revoked at any time.</p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-theme-text">D. Legal &amp; Regulatory Compliance (GDPR Art. 6(1)(c)):</p>
                <p>Complying with statutory copyright notices under the Digital Millennium Copyright Act (DMCA), court orders, tax obligations, and legitimate law enforcement requests.</p>
              </div>
            </div>

            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted pt-2 font-medium text-theme-text">
              Automated Decision-Making &amp; Profiling Disclaimer (GDPR Art. 22):
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store does NOT utilize automated individual decision-making, behavioral profiling algorithms, or algorithmic credit scoring that produces legal or similarly significant effects concerning users. Feed recommendations are computed using objective, non-personalized Bayesian ranking formulas based on aggregate community downloads and ratings.
            </p>
          </section>

          {/* Section 5: Direct CDN Streaming */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Server className="w-5 h-5 text-theme-text shrink-0" />
              5. Direct CDN Binary Streaming &amp; Zero Payload Interception
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              When you initiate an application download on Prople Store, the binary package streams directly from the author&apos;s verified release repository (e.g., GitHub Releases CDN, AWS S3, or verified publisher host) via direct browser download stream dispatch.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store does not proxy, intercept, decrypt, or log binary traffic payloads. Because downloads connect directly to upstream release CDNs, your personal device communicates at full native speed without intermediate corporate bottlenecks.
            </p>
          </section>

          {/* Section 6: Anti-Piracy & Content Authenticity */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-theme-text shrink-0" />
              6. Anti-Piracy, Code Authenticity &amp; Copyright Compliance
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Cloaktail Industries strictly prohibits the distribution of cracked, pirated, or unauthorized commercial software. All published listings must originate from legitimate authors or authorized open-source projects. Packages are cryptographically verified against pinned SHA-256 release digests to ensure unadulterated binary authenticity.
            </p>
            {onOpenAntiPiracy && (
              <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted pt-1">
                For complete details on copyright protection, our 24-hour quarantine procedure, and DMCA takedown notice guidelines, read our dedicated{' '}
                <button
                  type="button"
                  onClick={onOpenAntiPiracy}
                  className="text-blue-500 hover:underline cursor-pointer font-medium"
                >
                  Anti-Piracy &amp; DMCA Policy
                </button>.
              </p>
            )}
          </section>

          {/* Section 7: Data Security, Cloud Infrastructure & Cross-Border Transfers */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-theme-text shrink-0" />
              7. Data Security, Cloud Infrastructure &amp; International Transfers
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store utilizes enterprise-grade cloud infrastructure provided by Google Cloud Platform and Firebase. All data transmissions are encrypted in transit using industry-standard TLS 1.3 cryptographic protocols. Databases are encrypted at rest using AES-256 standards, guarded by strict role-based access control (RBAC), and sensitive administrative tokens or developer credentials are never exposed to browser clients.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              International Cross-Border Transfers: Where data is stored in cloud regions across international borders, transfers are protected by European Commission Standard Contractual Clauses (SCCs) and rigorous technical safeguards ensuring an equivalent level of protection to EU GDPR standards.
            </p>
          </section>

          {/* Section 8: Two-Step Verification (2FA) & Authentication Security Architecture */}
          <section className="space-y-3" id="two-step-verification">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Shield className="w-5 h-5 text-theme-text shrink-0" />
              8. Two-Step Verification (2FA) &amp; Account Protection Charter
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              To defend user accounts, developer releases, and community contributions against automated credential stuffing, brute-forcing, account takeover (ATO), and phishing attacks, Prople Store mandates and enforces an enterprise-grade Two-Step Verification (2FA) authentication architecture:
            </p>

            <div className="space-y-3 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <div className="space-y-1">
                <p className="font-medium text-theme-text">A. Step 1 — Cryptographic Password Verification:</p>
                <p>
                  When signing in with email and password, the user&apos;s password is verified against server-authoritative PBKDF2-SHA512 cryptographic hash routines and secure identity toolkits with high-iteration salting. Plaintext passwords are never stored, logged, or retained.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-theme-text">B. Step 2 — Mandatory 6-Digit Email One-Time Password (OTP):</p>
                <p>
                  Upon successful password verification in Step 1, the platform automatically generates a cryptographically random (CSPRNG via <code className="text-xs bg-theme-hover px-1 py-0.5 rounded">crypto.randomInt</code>) 6-digit verification code dispatched directly to the user&apos;s verified registered email address. Authentication sessions remain strictly locked and unhydrated until the user enters and verifies the valid 6-digit OTP.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-theme-text">C. Constant-Time &amp; Single-Use Code Security:</p>
                <p>
                  Verification codes are validated using constant-time comparison algorithms (<code className="text-xs bg-theme-hover px-1 py-0.5 rounded">crypto.timingSafeEqual</code>) to prevent timing side-channel attacks. Codes expire automatically within 10 to 15 minutes and are atomically consumed and purged immediately upon verification to eliminate replay attacks.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-medium text-theme-text">D. Multi-Layer Rate-Limiting &amp; 20-Strike IP Defense:</p>
                <p>
                  To neutralize automated bots and distributed abuse:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[13px] sm:text-[14px]">
                  <li><strong>Account &amp; IP Failed Login Cap:</strong> Maximum 5 failed login attempts per 24-hour rolling window.</li>
                  <li><strong>OTP Dispatch Limiter:</strong> Maximum 10 verification codes per 2-hour rolling window to prevent mailbox flooding.</li>
                  <li><strong>Permanent IP Lockout:</strong> Client IP addresses accumulating more than 20 failed security verification strikes are automatically blocked from identity endpoints and audited in secure database logs.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 9: User Data Deletion Rights */}
          <section className="space-y-3" id="data-deletion">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-theme-text shrink-0" />
              9. User Data Deletion Rights &amp; Retention Policy
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              In compliance with global data protection frameworks (including GDPR, CCPA, and Google API Services User Data Policy), users maintain full ownership and control over their personal data.
            </p>

            <p className="font-medium text-theme-text pt-1 text-[14px] sm:text-[15px]">What Data Can Be Permanently Purged:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] text-theme-text-muted">
              <li>User profile information, associated authentication IDs, and email records.</li>
              <li>All submitted community reviews, comments, and star ratings.</li>
              <li>Developer catalog entries, descriptions, release references, and publisher dashboard records.</li>
              <li>Locally stored device caches, install states, and recent search history.</li>
            </ul>

            <div className="space-y-2 text-[14px] sm:text-[15px] text-theme-text-muted pt-2 leading-relaxed">
              <p className="font-medium text-theme-text">Concrete Deletion Procedures:</p>
              <p>
                1. <strong>Direct Email Deletion Request:</strong> Send an email from your registered address to <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a> with the subject <em>&quot;Data Deletion Request&quot;</em>. Requests are executed within thirty (30) calendar days.
              </p>
              <p>
                2. <strong>Revoke OAuth Access:</strong> You can sever authentication tokens at any time via <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">myaccount.google.com/permissions</a>.
              </p>
              <p>
                3. <strong>Clear Local Device Data:</strong> Purge local search histories and cached listings directly via browser site data settings.
              </p>
            </div>
          </section>

          {/* Section 10: Global Consumer Data Rights Matrix */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Globe className="w-5 h-5 text-theme-text shrink-0" />
              10. Global Consumer Data Rights Matrix (GDPR, CCPA/CPRA, DPDPA)
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Depending on your jurisdiction, you possess affirmative legal rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              <li><strong className="text-theme-text font-medium">Right to Access (GDPR Art. 15 / CCPA § 1798.100):</strong> Obtain confirmation of whether your data is processed and receive a readable copy.</li>
              <li><strong className="text-theme-text font-medium">Right to Rectification (GDPR Art. 16):</strong> Correct inaccurate or incomplete personal records.</li>
              <li><strong className="text-theme-text font-medium">Right to Erasure / &quot;Right to be Forgotten&quot; (GDPR Art. 17):</strong> Have your personal identifiers permanently purged from all operational databases.</li>
              <li><strong className="text-theme-text font-medium">Right to Data Portability (GDPR Art. 20):</strong> Request an export of your voluntarily provided data in a structured, machine-readable format.</li>
              <li><strong className="text-theme-text font-medium">Right to Opt-Out of Sale / Sharing:</strong> We do not sell or share your data with third parties. No opt-out is necessary, but the right is fully recognized.</li>
              <li><strong className="text-theme-text font-medium">Right to Non-Discrimination (CCPA § 1798.125):</strong> We will never deny services, charge different prices, or provide degraded performance because you exercised privacy rights.</li>
              <li><strong className="text-theme-text font-medium">Right to Lodge a Regulatory Complaint:</strong> EU/EEA residents retain the legal right to lodge complaints with their local Data Protection Authority (DPA).</li>
            </ul>
          </section>

          {/* Section 11: Third-Party Applications & Publisher Data Safety */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <Scale className="w-5 h-5 text-theme-text shrink-0" />
              11. Third-Party Applications, Publisher Data Safety &amp; Policy Adoption
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Applications listed on Prople Store are created by independent publishers and open-source contributors. Each listed application features a dedicated Data Safety panel detailing the developer&apos;s declarations regarding data collection, third-party sharing, and security practices. We require developers to link an authorized privacy policy for their software.
            </p>
            <div className="p-3.5 sm:p-4 bg-theme-hover/40 rounded-2xl text-xs sm:text-[13px] text-theme-text-muted space-y-2 border border-theme-border/20 leading-relaxed">
              <p className="font-semibold text-theme-text flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Developer Authorization to Adopt Prople Store Privacy Policy</span>
              </p>
              <p>
                To support open-source maintainers, independent developers, and individual contributors who do not maintain a dedicated corporate legal infrastructure or standalone privacy policy website, Prople Store explicitly permits developers to link and adopt Prople Store&apos;s official Privacy Policy (<strong>https://www.prople.co.in/privacy</strong> or within the app console) as their software&apos;s legal privacy reference.
              </p>
              <p>
                By providing the Prople Store Privacy Policy link during application submission or updates, the publishing developer legally warrants and covenants that:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-theme-text-muted">
                <li>The application strictly honors Prople Store&apos;s Zero-Surveillance Covenant and does not covertly collect, track, or sell user data.</li>
                <li>The application does not transmit unencrypted or undisclosed user personal data to third-party endpoints.</li>
                <li>All permissions (Camera, Location, Storage, Microphone, etc.) and on-device data processing are accurately disclosed in the application&apos;s Data Safety profile.</li>
                <li>If the application incorporates third-party behavioral advertising or commercial monetization SDKs in future updates, the developer must furnish an independent, dedicated privacy policy.</li>
              </ul>
            </div>
          </section>

          {/* Section 12: Children's Privacy Protections */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              12. Children&apos;s Privacy Protections
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store complies with the Children&apos;s Online Privacy Protection Act (COPPA) and Article 8 of the GDPR. We do not knowingly collect, process, or solicit personal information from children under thirteen (13) years of age (or under 16 in applicable EU jurisdictions). If we become aware that a child has provided personal information without verifiable parental consent, we immediately purge the data from our servers.
            </p>
          </section>

          {/* Section 13: Executive Contact & Legal Notices */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
              13. Contact &amp; Legal Notices
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              For inquiries regarding privacy governance, data rights execution, cookie disclosures, or technical audit reports, please contact Cloaktail Industries:
            </p>
            <div className="space-y-1.5 text-[14px] sm:text-[15px] text-theme-text-muted pt-1 leading-relaxed">
              <p><span className="text-theme-text font-medium">Parent Organization:</span> Cloaktail Industries</p>
              <p><span className="text-theme-text font-medium">Founder &amp; CEO:</span> Sahanur Molla</p>
              <p><span className="text-theme-text font-medium">Platform Product:</span> Prople Store</p>
              <p><span className="text-theme-text font-medium">Executive Email:</span> <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a></p>
              <p><span className="text-theme-text font-medium">Official Developer Email:</span> <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a></p>
              <p><span className="text-theme-text font-medium">Platform Support:</span> <a href="mailto:prople.site@gmail.com" className="text-blue-500 hover:underline">prople.site@gmail.com</a></p>
            </div>
          </section>

          {/* Related Links */}
          <div className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
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
