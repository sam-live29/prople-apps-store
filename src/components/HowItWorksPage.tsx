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
    title: 'Zero-Barrier Browsing, Search & Hardware Compatibility',
    summary: 'How guests and signed-in users discover software across Home, Explore, Top Charts, Categories, and hybrid search with zero telemetry.',
    steps: [
      {
        number: '1',
        title: 'Anonymous Discovery & Optional Account Sync',
        description: 'Users can browse every storefront surface, inspect checksums and permissions, save local wishlists, and download binaries without creating an account. Signing in (Google OAuth or 2FA Email + 6-digit OTP) unlocks cloud-synced Wishlists, Ratings & Reviews, Notifications, and Developer Console access.',
        protocol: 'Guest-First Access + 2FA Session Sync'
      },
      {
        number: '2',
        title: 'Client Environment & Architecture Detection',
        description: 'The store client inspects navigator platform and CPU architecture hints strictly in browser memory to distinguish Android (ARM64), Apple iOS/iPadOS, Windows (x64/ARM64), Linux (amd64/arm64), macOS (Apple Silicon / Intel), and modern Web browsers.',
        protocol: 'osDetectionService'
      },
      {
        number: '3',
        title: 'Meritocratic Bayesian Ranking & Hybrid Search',
        description: 'Home shelves, Top Charts, and instant search (Meilisearch + sub-5ms client-side fuzzy BM25 fallback) rank software purely by Bayesian weighted ratings, authentic download milestones, and release freshness—with zero sponsored placements.',
        protocol: 'appMetricsAlgorithm + Hybrid Search'
      },
      {
        number: '4',
        title: 'Canonical Deep-Link & Refresh Resilience',
        description: 'Every app (/apps/:slug), category, developer profile, and platform collection resolves cleanly on both client navigation and full page refreshes with pre-rendered OpenGraph and Schema.org metadata.',
        protocol: 'SSR + SPA Route Hydration'
      }
    ],
    actionLink: {
      label: 'Browse compatible applications →',
      target: 'catalog'
    }
  },
  {
    branchNumber: '02',
    title: 'Contained 1-Click Direct Download Engine',
    summary: 'How binaries stream directly within the store session from verified cloud object storage or release CDNs without opening external browser tabs.',
    steps: [
      {
        number: '1',
        title: 'Contained In-App Gesture Dispatch',
        description: 'When a user taps Install or Download, the stream initiates directly inside the active store experience—eliminating blank new-tab popups (target="_blank" redirects) and preserving scroll and navigation state.',
        protocol: 'Contained Stream Dispatch (startInstall)'
      },
      {
        number: '2',
        title: 'Multi-Host HTTPS Binary Streaming',
        description: 'The browser connects over encrypted TLS directly to the publisher’s verified release host—Cloudflare R2, AWS S3, self-hosted VPS, enterprise CDN, or GitHub Releases—delivering untouched binaries at unthrottled bandwidth.',
        protocol: 'Direct HTTPS Binary Delivery'
      },
      {
        number: '3',
        title: 'Authentic 0+ Baseline & Verified Download Counting',
        description: 'Every new listing starts strictly at 0+ downloads with zero synthetic inflation. Download milestones increment only after a scheduled verification interval to block automated bot gaming.',
        protocol: 'scheduledDownloadService'
      }
    ],
    actionLink: {
      label: 'Test 1-click downloads on home catalog →',
      target: 'home'
    }
  },
  {
    branchNumber: '03',
    title: 'Multi-Source Publishing & Global Publisher Identity',
    summary: 'How developers publish from private or public codebases via a 6-step release wizard with immutable per-release attribution and universal profile sync.',
    steps: [
      {
        number: '1',
        title: 'Cloud Storage, VPS & GitHub Release Ingestion',
        description: 'Developers paste either a direct HTTPS binary URL hosted on Cloudflare R2, AWS S3, VPS, or custom CDN (ideal for private repositories) or a public GitHub Release URL into Step 1 of the 6-step wizard (Release → App Info → Package → Media → Safety & Legal → Review).',
        protocol: '/api/resolve-apk + /api/github-release-meta'
      },
      {
        number: '2',
        title: 'Immutable Release Attribution & Global Publisher Sync',
        description: 'Inside publishing and update forms, Publisher Name, Support Email, and Distribution Source are locked and read-only to prevent per-release spoofing. Developers manage their globally unique Publisher Name exclusively in Settings → Edit Profile, which universally updates every app and release they own (with a 30-minute adjustment grace window followed by a 15-day cooldown).',
        protocol: 'publisherNameService + publisher_registry'
      },
      {
        number: '3',
        title: 'Isolated Drafts, Ownership Lock & Quotas',
        description: 'New app drafts and per-app update drafts persist in isolated local storage slots. Server endpoints enforce strict UID/email ownership isolation alongside anti-abuse rate limits (3 new apps per 15 minutes; 5 version updates per hour).',
        protocol: 'publishQuotaService + Ownership Guard'
      },
      {
        number: '4',
        title: 'Instant Catalog & Search Broadcast',
        description: 'Approved submissions commit to Cloud Firestore and synchronize immediately with Meilisearch and active store clients worldwide.',
        protocol: 'Firestore + Meilisearch Sync'
      }
    ],
    actionLink: {
      label: 'Open Developer Console →',
      target: 'console'
    }
  },
  {
    branchNumber: '04',
    title: 'Available Data, Package Specs & Safety Transparency',
    summary: 'What technical, cryptographic, and privacy data is openly available to inspect on every application listing before installation.',
    steps: [
      {
        number: '1',
        title: 'Technical Package & Compatibility Metadata',
        description: 'Every listing openly surfaces version tag, package format (.apk, .aab, .ipa, .dmg, .pkg, .deb, .AppImage, .rpm, .exe, .msi, .pwa), resolved binary size, required OS version, supported CPU architectures, minimum RAM, release dates, and full release notes.',
        protocol: 'AboutAppPage Specifications'
      },
      {
        number: '2',
        title: 'Copyable 64-Character SHA-256 Checksums',
        description: 'Each release displays its 64-character SHA-256 cryptographic digest so users and security researchers can verify byte-for-byte authenticity against the downloaded file.',
        protocol: 'NIST FIPS 180-4 SHA-256'
      },
      {
        number: '3',
        title: 'Data Safety & Categorized OS Permissions',
        description: 'Developers declare third-party data sharing, collected data categories, data deletion policies, categorized hardware/OS permissions (Camera, Microphone, Storage, Network, Location), and authorized HTTPS Privacy Policy & Terms links.',
        protocol: 'DataSafetyPage + AppPermissionsPage'
      },
      {
        number: '4',
        title: 'Open Machine-Readable Catalog Endpoints',
        description: 'Public catalog metadata is structured cleanly across XML sitemaps (/sitemap.xml), Schema.org SoftwareApplication JSON-LD, /llms.txt, /llms-full.txt, and read-only Model Context Protocol (MCP) discovery tools.',
        protocol: 'SEO / GEO / MCP Transparency Layer'
      }
    ],
    actionLink: {
      label: 'Explore catalog metadata →',
      target: 'catalog'
    }
  },
  {
    branchNumber: '05',
    title: 'Platform Defense, SSRF Guardrails & Moderation',
    summary: 'How user devices and publisher accounts are safeguarded from tampering, private-network probing, and malicious uploads.',
    steps: [
      {
        number: '1',
        title: 'SSRF & Private Network Firewall',
        description: 'All external binary and media URLs are validated against loopback, link-local, carrier-grade NAT, and cloud metadata IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254) prior to resolution.',
        protocol: 'securityDefense SSRF Guard'
      },
      {
        number: '2',
        title: 'Media Magic-Byte & Format Sanitization',
        description: 'Icons, screenshots, and feature banners stored in Firebase are validated for authentic image structures (PNG, JPEG, WebP, GIF, AVIF), blocking disguised executables or active scripts.',
        protocol: 'Firebase Storage + Media Validator'
      },
      {
        number: '3',
        title: 'Community Reporting & Rapid Admin Quarantine',
        description: 'Flagged listings and reviews enter real-time administrative moderation queues, allowing non-compliant or infringing packages to be quarantined and delisted immediately.',
        protocol: 'AdminModerationService'
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
  const lastUpdated = 'November 2026';
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
