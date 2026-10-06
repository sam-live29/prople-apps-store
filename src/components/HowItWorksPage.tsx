import React from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Cpu, GitBranch, ShieldCheck } from 'lucide-react';
import { usePreserveScroll } from '../services/scrollManager';

interface HowItWorksPageProps {
  onBack: () => void;
  onNavigateHome?: () => void;
  onOpenConsole?: () => void;
  onOpenSecurity?: () => void;
  onOpenCatalog?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenAntiPiracy?: () => void;
  onOpenUserConsent?: () => void;
}

interface ThreadStep {
  number: string;
  title: string;
  description: string;
  protocol: string;
}

interface WorkflowThreadBranch {
  branchNumber: string;
  title: string;
  summary: string;
  steps: ThreadStep[];
  actionLink?: {
    label: string;
    target: 'home' | 'console' | 'security' | 'catalog';
  };
}

const WORKFLOW_BRANCHES: WorkflowThreadBranch[] = [
  {
    branchNumber: '01',
    title: 'User Discovery & Hardware Compatibility Thread',
    summary: 'How user requests are resolved, matched against client hardware, and ranked algorithmically with zero telemetry.',
    steps: [
      {
        number: '1',
        title: 'Client Environment Detection',
        description: 'The store client extracts navigator platform, user agent architecture hints, and display profile directly in the browser to accurately distinguish Android (ARM64), Apple iOS (iPhone / iPad), Windows (x64), Linux (amd64), macOS (Apple Silicon / Intel), or modern Web browsers.',
        protocol: 'osDetectionService'
      },
      {
        number: '2',
        title: 'Non-Linear Algorithmic Ranking',
        description: 'Apps are weighted based on authentic download milestones, verified rating ratios, and publication recency using an exponential time-decay model without tracking cookies or behavioral profiles.',
        protocol: 'appMetricsAlgorithm (Wilson-Score)'
      },
      {
        number: '3',
        title: 'Binary Package Filtering',
        description: 'Incompatible platform executables are flagged or filtered out, ensuring users only download binaries that execute cleanly on their system architecture.',
        protocol: 'Compatibility Filter Engine'
      }
    ],
    actionLink: {
      label: 'Browse compatible applications →',
      target: 'catalog'
    }
  },
  {
    branchNumber: '02',
    title: '1-Click Zero-Reload Direct Download Engine',
    summary: 'How package binaries stream straight from upstream developer release CDNs without middleman proxies or browser page reload lines.',
    steps: [
      {
        number: '1',
        title: 'Synchronous User Gesture Capture',
        description: 'When the user taps Install or Download, the browser click gesture is synchronously preserved in memory, preventing popup blockers and security interruptions.',
        protocol: 'DOM Event Dispatch (startInstall)'
      },
      {
        number: '2',
        title: 'Direct Browser Stream Dispatch',
        description: 'The download anchor triggers authentic direct browser stream capture without nested iframe sandboxing, ensuring zero CSP or X-Frame-Options blocking across Android Chrome, desktop browsers, and PWAs.',
        protocol: 'Direct Anchor Stream Dispatch (triggerDirectDownloadLink)'
      },
      {
        number: '3',
        title: 'Direct CDN Binary Streaming',
        description: 'The browser establishes a direct HTTPS connection to the official upstream host (GitHub Releases CDN, AWS S3, Cloudflare) at full unthrottled bandwidth without passing through proxy bottlenecks.',
        protocol: 'HTTP 302 Direct Stream Redirection'
      },
      {
        number: '4',
        title: '5-Minute Verified Download Increments',
        description: 'Downloads are scheduled and registered to the publisher after an authentic verification interval to eliminate synthetic spamming.',
        protocol: 'Cryptographic Milestone Scheduler'
      }
    ],
    actionLink: {
      label: 'Test 1-click downloads on home catalog →',
      target: 'home'
    }
  },
  {
    branchNumber: '03',
    title: 'Developer Ingestion & GitHub Release Sync Pipeline',
    summary: 'How developers publish and maintain releases in 30 seconds via automated GitHub release asset parsing.',
    steps: [
      {
        number: '1',
        title: 'Release URL Ingestion',
        description: 'The developer inputs an open-source GitHub release, tag, or repository URL directly into the Developer Console.',
        protocol: 'Server-Side Ingestion (/api/github-release-meta)'
      },
      {
        number: '2',
        title: 'Automated Binary Asset Separation',
        description: 'The system scans all assets in the release, filtering out raw source code archives (.zip of repos, tarballs of git trees) and isolating compiled executable binaries.',
        protocol: 'Executable Asset Filter'
      },
      {
        number: '3',
        title: 'Format & OS Heuristic Recognition',
        description: 'The algorithm analyzes file extensions (.apk, .deb, .exe, .dmg, .AppImage) and automatically derives minimum operating system requirements, package size, and architecture tags.',
        protocol: 'inferPlatformAndFormat'
      },
      {
        number: '4',
        title: 'Instant Distributed Publication',
        description: 'Application metadata is committed to Google Cloud Firestore and broadcast in real time to thousands of active store clients simultaneously.',
        protocol: 'Firestore Distributed Document Sync'
      }
    ],
    actionLink: {
      label: 'Open Developer Console →',
      target: 'console'
    }
  },
  {
    branchNumber: '04',
    title: 'Multi-Platform Binary & Web Store Matrix (22 Formats)',
    summary: 'The comprehensive catalog architecture supporting native execution across Android, Apple (iOS), Mac (macOS), Linux, Windows, and Web/PWA platforms.',
    steps: [
      {
        number: '1',
        title: 'Android Ecosystem Distribution',
        description: 'Natively serves .apk (Standard Package), .aab (Google App Bundle), and .aar (Android Library Archive) with verified package names and target SDK levels.',
        protocol: 'Android Runtime (ART) Packaging'
      },
      {
        number: '2',
        title: 'Apple & macOS Ecosystem Distribution',
        description: 'Distributes Apple iOS (.ipa) mobile packages, macOS mountable disk images (.dmg), and native installer packages (.pkg) for Apple Silicon and Intel systems.',
        protocol: 'Apple iOS & Mach-O macOS Pipeline'
      },
      {
        number: '3',
        title: 'Windows Desktop Distribution',
        description: 'Distributes .exe (Win32/x64 PE Executable), .msi (Windows Installer), .msix (Modern App Container), .appx (UWP), and high-compression archives (.zip, .7z, .rar).',
        protocol: 'Microsoft Windows Desktop Pipeline'
      },
      {
        number: '4',
        title: 'Linux Universal & Web Store Distribution',
        description: 'Handles .deb (Debian/Ubuntu), .AppImage (Universal Portable), .rpm (Fedora/RHEL), .snap (Canonical), .flatpak (Flatpak Desktop), .tar.gz, and installable Progressive Web Apps (.pwa / Web Store).',
        protocol: 'FreeDesktop / Universal Web PWA Standards'
      }
    ],
    actionLink: {
      label: 'Submit a new application package →',
      target: 'console'
    }
  },
  {
    branchNumber: '05',
    title: 'Cryptographic Integrity & Device Safety Workflow',
    summary: 'How user devices are safeguarded from malicious tampering, unsigned scripts, and malware injections.',
    steps: [
      {
        number: '1',
        title: 'SSRF & Domain Whitelist Filtering',
        description: 'Before any binary is indexed, URLs are sanitized against private loopback ranges (127.0.0.1, 10.0.0.0/8, 192.168.0.0/16, link-local, and cloud metadata addresses).',
        protocol: 'Private IP Sanitization & SSRF Firewall'
      },
      {
        number: '2',
        title: 'SHA-256 Cryptographic Checksum Pinning',
        description: 'Every verified application listing pins the exact 64-character SHA-256 release digest to guarantee the binary on your device is byte-for-byte identical to the developer release.',
        protocol: 'NIST FIPS 180-4 SHA-256 Standard'
      },
      {
        number: '3',
        title: 'Play Protect Safety Emulation',
        description: 'Automated scanning validates package declarations, permission scopes, and verified publisher account credentials before execution.',
        protocol: 'Safety Verification Protocol'
      },
      {
        number: '4',
        title: 'Community Moderation & Admin Quarantine',
        description: 'Any flagged app is immediately placed in quarantine, inspected by administrators, and removed from discovery within seconds if non-compliant.',
        protocol: 'Real-time Safety Triage Engine'
      }
    ],
    actionLink: {
      label: 'Read Apps & Security report →',
      target: 'security'
    }
  }
];

export default function HowItWorksPage({
  onBack,
  onNavigateHome,
  onOpenConsole,
  onOpenSecurity,
  onOpenCatalog,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAntiPiracy,
  onOpenUserConsent
}: HowItWorksPageProps) {
  const lastUpdated = 'September 2026';
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll('how-it-works', scrollRef);

  const handleActionClick = (target: 'home' | 'console' | 'security' | 'catalog') => {
    if (target === 'home' && onNavigateHome) onNavigateHome();
    else if (target === 'console' && onOpenConsole) onOpenConsole();
    else if (target === 'security' && onOpenSecurity) onOpenSecurity();
    else if (target === 'catalog' && onOpenCatalog) onOpenCatalog();
    else onBack();
  };

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
              How It Works
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Architecture &amp; workflows
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
              How Prople Store Works
            </h2>
            <p className="text-xs sm:text-sm text-theme-text-muted">
              Prople Store &bull; A product of Cloaktail Industries &bull; Architecture &amp; Workflows &bull; Updated: {lastUpdated}
            </p>
          </div>

          {/* Section: Architectural Overview */}
          <section className="space-y-3">
            <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-theme-text shrink-0" />
              1. Overview &amp; Architectural Model
            </h3>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Prople Store is an open, independent multi-platform application store developed and operated by Cloaktail Industries under the direction of Founder &amp; CEO Sahanur Molla. The store connects users directly with authentic upstream developer binaries across 22 executable formats without middleman packaging proxies, surveillance trackers, or walled-garden constraints.
            </p>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted">
              Below are the five primary architectural branches and connected workflow threads illustrating how applications are discovered, downloaded, verified, and executed.
            </p>
          </section>

          {/* Workflow Branches */}
          <div className="space-y-8">
            {WORKFLOW_BRANCHES.map((branch, branchIdx) => (
              <section key={branch.branchNumber} className="space-y-4">
                <div>
                  <h3 className="text-[17px] sm:text-[18px] font-medium font-google-sans text-theme-text">
                    {branchIdx + 2}. {branch.title}
                  </h3>
                  <p className="text-[14px] sm:text-[15px] leading-relaxed text-theme-text-muted mt-1">
                    {branch.summary}
                  </p>
                </div>

                {/* Connected Thread Flow */}
                <div className="relative pl-7 sm:pl-9 space-y-5 pt-1">
                  {/* Continuous Vertical Thread Line */}
                  <div 
                    className="absolute left-[11px] sm:left-[13px] top-3 bottom-3 w-[2px] bg-theme-border/60"
                    aria-hidden="true"
                  />

                  {/* Steps along the thread */}
                  {branch.steps.map((step) => (
                    <div key={step.number} className="relative group">
                      {/* Thread Node / Junction Point */}
                      <div 
                        className="absolute -left-[27px] sm:-left-[35px] top-0.5 w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] rounded-full bg-theme-bg border border-theme-border text-theme-text flex items-center justify-center text-[10px] font-mono font-bold shrink-0 select-none shadow-xs"
                      >
                        {step.number}
                      </div>

                      {/* Step Information */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <h4 className="text-[14px] sm:text-[15px] font-medium text-theme-text">
                            {step.title}
                          </h4>
                          <span className="text-[11px] font-mono text-theme-text-muted/80">
                            ({step.protocol})
                          </span>
                        </div>
                        <p className="text-[13px] sm:text-[14px] leading-relaxed text-theme-text-muted">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Link */}
                {branch.actionLink && (
                  <div className="pt-1 pl-7 sm:pl-9">
                    <button
                      type="button"
                      onClick={() => handleActionClick(branch.actionLink!.target)}
                      className="text-blue-500 hover:underline cursor-pointer font-medium text-sm inline-flex items-center gap-1"
                    >
                      <span>{branch.actionLink.label}</span>
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Related Links */}
          <div className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Browse Applications
              </button>
            )}
            {onOpenConsole && (
              <button
                type="button"
                onClick={onOpenConsole}
                className="text-blue-500 hover:underline font-medium cursor-pointer"
              >
                Developer Console
              </button>
            )}
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
    </div>
  );
}
