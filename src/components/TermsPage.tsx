import React from 'react';
import { ArrowLeft, Shield, Scale, AlertTriangle, FileText, CheckCircle2, Lock, Ban } from 'lucide-react';
import { usePreserveScroll } from '../services/scrollManager';

interface TermsPageProps {
  onBack: () => void;
  onOpenPrivacy?: () => void;
  onOpenAbout?: () => void;
  onOpenSecurity?: () => void;
  onOpenAntiPiracy?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenUserConsent?: () => void;
}

export default function TermsPage({ 
  onBack,
  onOpenPrivacy,
  onOpenAbout,
  onOpenSecurity,
  onOpenAntiPiracy,
  onOpenHowItWorks,
  onOpenUserConsent
}: TermsPageProps) {
  const lastUpdated = 'September 2026';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('terms-page', scrollRef);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Top Header */}
      <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 bg-theme-bg shrink-0 gap-3 z-20 w-full border-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 -translate-x-[2px]">
          <button 
            type="button"
            onClick={onBack} 
            className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer flex items-center justify-center"
            title="Go back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-theme-text" />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate leading-tight">
              Terms of Service
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Legal agreements, liability limits &amp; safe harbors
            </span>
          </div>
        </div>
        <div className="flex-1"></div>
      </header>

      {/* Content Body */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-8 pb-24 max-w-4xl mx-auto w-full outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* Title Header */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-google-sans text-theme-text tracking-tight">
            Terms of Service &amp; End-User License Agreement
          </h1>
          <p className="text-xs sm:text-sm text-theme-text-muted">
            Prople Store &bull; Operated by Cloaktail Industries &bull; Founder &amp; CEO: Sahanur Molla &bull; Last updated: {lastUpdated}
          </p>
        </div>

        {/* Section 1: Agreement to Terms */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <Scale className="w-5 h-5 text-theme-text shrink-0" />
            1. Agreement to Terms &amp; Executive Authority
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            These Terms of Service constitute a legally binding agreement between you (&quot;User&quot;, &quot;Publisher&quot;, or &quot;Developer&quot;) and Cloaktail Industries, the parent organization operating Prople Store as an open multi-platform digital application marketplace under the executive leadership of Founder &amp; CEO Sahanur Molla.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            By accessing, browsing, downloading software from, accessing platform APIs, or publishing applications to Prople Store, you acknowledge that you have read, understood, and agree to be bound by these Terms, our Privacy Policy, and our Data Collection &amp; Consent Policy. If you do not agree, you must immediately terminate use of Prople Store.
          </p>
        </section>

        {/* Section 2: Platform Purpose & Permitted Use */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-theme-text shrink-0" />
            2. Platform Purpose &amp; Permitted Personal Use
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Prople Store provides an open, high-performance marketplace enabling direct discovery, inspection, and unmediated downloading of verified software packages across Android (APKs, AAB), Linux (Debian .deb, AppImage, RPM, Tarballs), Mac (DMG, PKG), and Windows (executables and installers). Users are granted a revocable, non-exclusive, non-transferable license to browse the catalog and download published software for personal, lawful usage.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            You agree not to engage in any activity that impairs or interferes with platform operations, including:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            <li>Attempting to bypass authentication mechanisms, cryptographic rate limits, or access controls.</li>
            <li>Deploying automated scraping bots, mass web crawlers, or denial-of-service vectors against marketplace endpoints without express written permission.</li>
            <li>Submitting synthetic, automated, deceptive, or astroturfed reviews and star ratings.</li>
            <li>Uploading, distributing, or linking to malicious payloads, spyware, stalkerware, unauthorized cryptocurrency miners, or exploit kits.</li>
          </ul>
        </section>

        {/* Section 3: Intermediary Hosting Safe Harbor (Section 230 CDA & EU DSA) */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-theme-text shrink-0" />
            3. Intermediary Hosting Safe Harbor &amp; Third-Party Code Disclaimers
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Prople Store acts strictly as an intermediary digital marketplace and hosting platform under 47 U.S.C. § 230 (Communications Decency Act Safe Harbor) and Articles 6 through 8 of Regulation (EU) 2022/2065 (Digital Services Act, &quot;DSA&quot;).
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Third-party software applications listed in the catalog are developed, compiled, and provided by independent third-party developers, organizations, and open-source contributors. Cloaktail Industries is not the author, publisher, speaker, or legal manufacturer of third-party software packages and does not assume editorial responsibility or liability for code authored by third parties.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            While we calculate cryptographic SHA-256 release digests and perform automated security manifest checks, you acknowledge that downloading and installing software from third-party developers is performed at your sole discretion and risk.
          </p>
        </section>

        {/* Section 4: Developer Covenants, Warranties & Absolute Indemnification */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <Lock className="w-5 h-5 text-theme-text shrink-0" />
            4. Developer Covenants, Warranties &amp; Mandatory Indemnification
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Any developer or publisher submitting applications via the Publisher Console or GitHub Releases pipeline enters into a binding covenant:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            <li><strong className="text-theme-text font-medium">Warranty of Originality &amp; Authorization:</strong> Publisher warrants that they own all requisite intellectual property rights, licenses, and authorizations to distribute the software, and that the software does not infringe upon any third party&apos;s copyright, trademark, trade secret, or patent.</li>
            <li><strong className="text-theme-text font-medium">Warranty of Non-Malicious Code:</strong> Publisher warrants that all binaries, packages, and executables are completely free of trojan horses, backdoors, spyware, stalkerware, botnets, hidden miners, and unauthorized telemetry tools.</li>
            <li><strong className="text-theme-text font-medium">Mandatory Developer Indemnification:</strong> Publisher expressly agrees to defend, indemnify, and hold harmless Cloaktail Industries, Prople Store, its corporate affiliates, officers, directors, employees, and Founder &amp; CEO Sahanur Molla from and against any and all claims, actions, suits, demands, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorney&apos;s fees) arising out of or related to: (a) the publisher&apos;s software, packages, or updates; (b) any infringement or misappropriation of third-party intellectual property rights; (c) any violation of privacy, data safety, or consumer protection statutes; or (d) any breach of these Terms.</li>
            <li><strong className="text-theme-text font-medium">Adoption of Platform Privacy Policy &amp; Terms for Hosted Apps:</strong> When publishing or updating software in the Developer Console, developers are required to link an accessible Privacy Policy and Terms &amp; Conditions. To lower barriers for independent creators, open-source maintainers, and hobbyist developers who do not operate independent legal websites, developers are explicitly permitted to link and adopt Prople Store&apos;s official legal documentation (Privacy Policy: <em>https://www.prople.co.in/privacy</em> and Terms: <em>https://www.prople.co.in/terms</em>). By doing so, the developer covenants that their application operates in strict conformance with Prople Store&apos;s Zero-Surveillance Covenant, collects zero undisclosed personal telemetry, and truthfully reports all device permissions in their Data Safety declarations.</li>
            <li><strong className="text-theme-text font-medium">Catalog Sanctions &amp; Unilateral Removal:</strong> Cloaktail Industries reserves the unconstrained right to delist, suspend, or permanently ban any developer or application that violates platform policies, poses security hazards, or generates legal exposure.</li>
          </ul>
        </section>

        {/* Section 5: Anti-Piracy, Copyright Protection & DMCA Compliance */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <FileText className="w-5 h-5 text-theme-text shrink-0" />
            5. Anti-Piracy, Copyright Protection &amp; DMCA Procedures
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Prople Store complies with the Digital Millennium Copyright Act (17 U.S.C. § 512). Copyright holders who believe that content listed on Prople Store infringes their intellectual property may submit a statutory takedown notice to our designated copyright agent containing:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            <li>Physical or electronic signature of an authorized representative.</li>
            <li>Identification of the copyrighted work claimed to be infringed.</li>
            <li>Exact location/URL of the allegedly infringing listing on Prople Store.</li>
            <li>Sufficient contact details (name, physical address, email, telephone number).</li>
            <li>A statement of good faith belief that the disputed use is unauthorized.</li>
            <li>A statement made under penalty of perjury that the notification is accurate and authorized.</li>
          </ul>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Notice submissions should be directed to <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a> with the subject <em>&quot;DMCA Copyright Infringement Notice&quot;</em>. Valid notices result in prompt catalog quarantine within twenty-four (24) hours.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Repeat Infringer Termination Policy: Cloaktail Industries enforces a strict three-strikes policy, permanently expelling developers who repeatedly infringe intellectual property rights.
          </p>
        </section>

        {/* Section 6: Zero-Tolerance for Prohibited Content & CSAM */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-500 shrink-0" />
            6. Zero-Tolerance for Prohibited Content &amp; CSAM Policy
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Cloaktail Industries strictly bars the following categories of software and content:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            <li><strong className="text-red-500 font-medium">Child Sexual Abuse Material (CSAM):</strong> Absolute zero tolerance. Any instance of CSAM will result in immediate permanent expulsion, cryptographic evidence preservation, and mandatory statutory reporting to the National Center for Missing &amp; Exploited Children (NCMEC) and international criminal law enforcement.</li>
            <li><strong className="text-theme-text font-medium">Malware, Spyware &amp; Ransomware:</strong> Software designed to extort, record keystrokes without consent, steal passwords, or encrypt device partitions without authorization is strictly prohibited.</li>
            <li><strong className="text-theme-text font-medium">Terrorist Content &amp; Violent Extremism:</strong> Applications inciting violence, terroristic acts, or hate speech targeting protected characteristics are permanently barred.</li>
            <li><strong className="text-theme-text font-medium">Financial Fraud &amp; Deceptive Phishing:</strong> Fake banking overlays, deceptive crypto drainers, or applications masquerading as legitimate brands are removed on sight.</li>
          </ul>
        </section>

        {/* Section 7: Anti-Data-Selling & Privacy Covenant */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            7. Anti-Data-Selling &amp; User Privacy Guarantee
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            In keeping with our Zero-Surveillance Charter, Cloaktail Industries guarantees that we will never sell, rent, monetize, or broker user personal data, download histories, or developer catalog metadata to third-party advertisers, data aggregators, or marketing brokers.
          </p>
        </section>

        {/* Section 8: Disclaimer of Warranties */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            8. Comprehensive Disclaimer of Warranties
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted uppercase text-xs tracking-wider font-semibold text-theme-text">
            PLEASE READ THIS SECTION CAREFULLY AS IT LIMITS OUR LIABILITY:
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            PROPLE STORE, ITS SERVICES, AND ALL APPLICATION PACKAGES LISTED THEREIN ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            CLOAKTAIL INDUSTRIES AND FOUNDER &amp; CEO SAHANUR MOLLA EXPRESSLY DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO: (A) IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT; (B) WARRANTIES THAT THE SERVICES OR SOFTWARE WILL BE UNINTERRUPTED, TIMELY, ERROR-FREE, SECURE, OR FREE FROM VIRUSES OR MALICIOUS COMPONENTS; AND (C) WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR QUALITY OF ANY SOFTWARE PACKAGES DISTRIBUTED THROUGH THE CATALOG.
          </p>
        </section>

        {/* Section 9: Limitation of Liability */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            9. Strict Financial Limitation of Liability
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CLOAKTAIL INDUSTRIES, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, OR FOUNDER &amp; CEO SAHANUR MOLLA BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, OR HARDWARE LOSS, ARISING OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, PROPLE STORE OR ANY THIRD-PARTY APPLICATION PACKAGES.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            IN NO EVENT SHALL THE TOTAL AGGREGATE LIABILITY OF CLOAKTAIL INDUSTRIES ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE USE OF THE SERVICES EXCEED THE GREATER OF ONE HUNDRED UNITED STATES DOLLARS ($100.00 USD) OR THE TOTAL AMOUNT PAID BY YOU TO PROPLE STORE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        {/* Section 10: Mandatory Dispute Resolution & Class Action Waiver */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            10. Dispute Resolution, Binding Arbitration &amp; Class Action Waiver
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Informal Resolution First: You agree that prior to filing any formal legal proceeding, you will contact Cloaktail Industries at <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a> to attempt in good faith to resolve the dispute informally for a period of at least thirty (30) days.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Binding Individual Arbitration: Any dispute, controversy, or claim arising out of or relating to these Terms that cannot be resolved informally shall be resolved by binding individual arbitration administered by an established arbitration institution under its commercial rules.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted font-medium text-theme-text">
            CLASS ACTION WAIVER: YOU AND CLOAKTAIL INDUSTRIES AGREE THAT EACH PARTY MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, REPRESENTATIVE, OR PRIVATE ATTORNEY GENERAL PROCEEDING.
          </p>
        </section>

        {/* Section 11: Export Controls & International Sanctions */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            11. Export Controls &amp; Trade Sanctions Compliance
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Software distributed on Prople Store may be subject to international export control laws, including the U.S. Export Administration Regulations (EAR) and economic sanctions administered by the U.S. Office of Foreign Assets Control (OFAC) and the European Union. You represent and warrant that you are not located in an embargoed jurisdiction and are not named on any restricted party list.
          </p>
        </section>

        {/* Section 12: General Legal Provisions */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            12. General Provisions &amp; Severability
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Severability: If any provision of these Terms is deemed unlawful, void, or unenforceable, that provision shall be severed without affecting the validity and enforceability of any remaining provisions.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Force Majeure: Cloaktail Industries shall not be liable for any failure or delay resulting from acts of God, war, pandemic, government embargoes, or cloud infrastructure outages beyond its reasonable control.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            Entire Agreement: These Terms, together with the Privacy Policy and User Consent Policy, constitute the sole and entire legal agreement between you and Cloaktail Industries regarding Prople Store.
          </p>
        </section>

        {/* Section 13: Executive Legal Inquiries */}
        <section className="space-y-3">
          <h2 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
            13. Executive Legal Notices &amp; Contacts
          </h2>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
            For formal legal inquiries, statutory notices, or corporate correspondence:
          </p>
          <div className="text-[14px] sm:text-[15px] space-y-2 text-theme-text-muted pt-1 leading-relaxed">
            <p><span className="text-theme-text font-medium">Parent Organization:</span> Cloaktail Industries</p>
            <p><span className="text-theme-text font-medium">Founder &amp; CEO:</span> Sahanur Molla</p>
            <p><span className="text-theme-text font-medium">Platform Product:</span> Prople Store</p>
            <p><span className="text-theme-text font-medium">Executive Office:</span> <a href="mailto:cloaktailsupport@gmail.com" className="text-blue-500 hover:underline">cloaktailsupport@gmail.com</a></p>
            <p><span className="text-theme-text font-medium">Official Developer Email:</span> <a href="mailto:cloaktailofficial@gmail.com" className="text-blue-500 hover:underline">cloaktailofficial@gmail.com</a></p>
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
  );
}
