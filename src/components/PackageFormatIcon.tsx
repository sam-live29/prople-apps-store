import React from 'react';

export type SupportedPackageFormat = 
  | 'apk' | 'aab' | 'aar'
  | 'exe' | 'msi' | 'msix' | 'appx'
  | 'deb' | 'appimage' | 'rpm' | 'snap' | 'flatpak' | 'tar.gz' | 'tar.xz' | 'tar.zst' | 'bin' | 'run'
  | 'dmg' | 'pkg'
  | 'ipa'
  | 'zip' | '7z' | 'rar'
  | 'jar'
  | 'pwa' | 'web';

export interface PackageFormatMetadata {
  format: SupportedPackageFormat;
  label: string;
  shortLabel: string;
  platform: 'android' | 'windows' | 'linux' | 'mac' | 'ios' | 'universal' | 'web';
  accentColor: string;
  bgGradient: string;
  description: string;
  mimeType: string;
}

export const SUPPORTED_PACKAGE_FORMATS: Record<SupportedPackageFormat, PackageFormatMetadata> = {
  apk: {
    format: 'apk',
    label: 'Android Application Package',
    shortLabel: '.APK',
    platform: 'android',
    accentColor: '#34A853',
    bgGradient: 'from-emerald-500/15 to-emerald-600/5',
    description: 'Native Android executable distribution package for phones, tablets & TVs.',
    mimeType: 'application/vnd.android.package-archive'
  },
  aab: {
    format: 'aab',
    label: 'Android App Bundle',
    shortLabel: '.AAB',
    platform: 'android',
    accentColor: '#0F9D58',
    bgGradient: 'from-green-500/15 to-green-600/5',
    description: 'Modern dynamic delivery Android publishing format optimizing device size.',
    mimeType: 'application/octet-stream'
  },
  aar: {
    format: 'aar',
    label: 'Android Archive',
    shortLabel: '.AAR',
    platform: 'android',
    accentColor: '#4285F4',
    bgGradient: 'from-blue-500/15 to-blue-600/5',
    description: 'Compiled Android binary library archive with resources.',
    mimeType: 'application/zip'
  },
  exe: {
    format: 'exe',
    label: 'Windows Executable',
    shortLabel: '.EXE',
    platform: 'windows',
    accentColor: '#0078D7',
    bgGradient: 'from-blue-600/15 to-cyan-600/5',
    description: 'Standard PE32/PE64 portable executable for Windows 10/11 desktop PCs.',
    mimeType: 'application/x-msdownload'
  },
  msi: {
    format: 'msi',
    label: 'Windows Installer Package',
    shortLabel: '.MSI',
    platform: 'windows',
    accentColor: '#107C41',
    bgGradient: 'from-teal-600/15 to-emerald-600/5',
    description: 'Enterprise Windows installer package powered by Windows Installer service.',
    mimeType: 'application/x-msi'
  },
  msix: {
    format: 'msix',
    label: 'Modern Windows App Package',
    shortLabel: '.MSIX',
    platform: 'windows',
    accentColor: '#008AD7',
    bgGradient: 'from-sky-600/15 to-blue-600/5',
    description: 'Next-generation containerized Windows application package with clean uninstall.',
    mimeType: 'application/msix'
  },
  appx: {
    format: 'appx',
    label: 'Universal Windows AppX',
    shortLabel: '.APPX',
    platform: 'windows',
    accentColor: '#0063B1',
    bgGradient: 'from-indigo-600/15 to-blue-600/5',
    description: 'Sandboxed Universal Windows Platform (UWP) distribution package.',
    mimeType: 'application/msix'
  },
  deb: {
    format: 'deb',
    label: 'Debian / Ubuntu Package',
    shortLabel: '.DEB',
    platform: 'linux',
    accentColor: '#A80030',
    bgGradient: 'from-rose-600/15 to-red-600/5',
    description: 'Standard binary package for Debian, Ubuntu, Linux Mint and derivatives with APT.',
    mimeType: 'application/vnd.debian.binary-package'
  },
  appimage: {
    format: 'appimage',
    label: 'Universal AppImage',
    shortLabel: '.AppImage',
    platform: 'linux',
    accentColor: '#2574A9',
    bgGradient: 'from-sky-600/15 to-indigo-600/5',
    description: 'One app = one file universal portable binary running on all Linux distros.',
    mimeType: 'application/x-executable'
  },
  rpm: {
    format: 'rpm',
    label: 'RPM Linux Package',
    shortLabel: '.RPM',
    platform: 'linux',
    accentColor: '#EE0000',
    bgGradient: 'from-red-600/15 to-orange-600/5',
    description: 'Red Hat Package Manager binary for Fedora, RHEL, CentOS, and openSUSE.',
    mimeType: 'application/x-redhat-package-manager'
  },
  snap: {
    format: 'snap',
    label: 'Canonical Snap Package',
    shortLabel: '.SNAP',
    platform: 'linux',
    accentColor: '#E95420',
    bgGradient: 'from-orange-600/15 to-amber-600/5',
    description: 'Sandboxed cross-distribution Linux package format maintained by Canonical.',
    mimeType: 'application/vnd.snap'
  },
  flatpak: {
    format: 'flatpak',
    label: 'Flatpak Desktop Package',
    shortLabel: '.FLATPAK',
    platform: 'linux',
    accentColor: '#4A90E2',
    bgGradient: 'from-blue-600/15 to-sky-600/5',
    description: 'Containerized desktop application distribution for Linux desktop environments.',
    mimeType: 'application/vnd.flatpak'
  },
  'tar.gz': {
    format: 'tar.gz',
    label: 'Tarball Gzip Archive',
    shortLabel: '.TAR.GZ',
    platform: 'linux',
    accentColor: '#F0AD4E',
    bgGradient: 'from-amber-600/15 to-yellow-600/5',
    description: 'Compressed binary tarball archive commonly used for portable Linux distributions.',
    mimeType: 'application/gzip'
  },
  'tar.xz': {
    format: 'tar.xz',
    label: 'Tarball XZ High-Compression',
    shortLabel: '.TAR.XZ',
    platform: 'linux',
    accentColor: '#E67E22',
    bgGradient: 'from-orange-600/15 to-amber-600/5',
    description: 'High-ratio LZMA2 compressed binary distribution package for Linux systems.',
    mimeType: 'application/x-xz'
  },
  'tar.zst': {
    format: 'tar.zst',
    label: 'Zstandard Tarball',
    shortLabel: '.TAR.ZST',
    platform: 'linux',
    accentColor: '#2ECC71',
    bgGradient: 'from-emerald-600/15 to-teal-600/5',
    description: 'Ultra-fast decompression Zstandard archive widely adopted in Arch Linux.',
    mimeType: 'application/zstd'
  },
  bin: {
    format: 'bin',
    label: 'Standalone Linux Binary',
    shortLabel: '.BIN',
    platform: 'linux',
    accentColor: '#34495E',
    bgGradient: 'from-slate-600/15 to-zinc-600/5',
    description: 'Direct compiled ELF native binary executable without package overhead.',
    mimeType: 'application/x-executable'
  },
  run: {
    format: 'run',
    label: 'Linux Self-Extracting Script',
    shortLabel: '.RUN',
    platform: 'linux',
    accentColor: '#8E44AD',
    bgGradient: 'from-purple-600/15 to-indigo-600/5',
    description: 'Self-extracting binary installer script for Linux systems.',
    mimeType: 'application/x-executable'
  },
  dmg: {
    format: 'dmg',
    label: 'Apple Disk Image',
    shortLabel: '.DMG',
    platform: 'mac',
    accentColor: '#9333EA',
    bgGradient: 'from-purple-600/15 to-fuchsia-600/5',
    description: 'Standard mountable Apple disk image volume containing macOS .app bundles.',
    mimeType: 'application/x-apple-diskimage'
  },
  pkg: {
    format: 'pkg',
    label: 'macOS Installer Package',
    shortLabel: '.PKG',
    platform: 'mac',
    accentColor: '#7C3AED',
    bgGradient: 'from-violet-600/15 to-purple-600/5',
    description: 'Official macOS system installer package executing guided installations.',
    mimeType: 'application/x-newton-compatible-pkg'
  },
  ipa: {
    format: 'ipa',
    label: 'iOS App Package',
    shortLabel: '.IPA',
    platform: 'ios',
    accentColor: '#007AFF',
    bgGradient: 'from-blue-500/15 to-sky-600/5',
    description: 'Native iOS application package archive for iPhone, iPad and AltStore/SideStore sideloading.',
    mimeType: 'application/x-itunes-ipa'
  },
  zip: {
    format: 'zip',
    label: 'Compressed Archive',
    shortLabel: '.ZIP',
    platform: 'universal',
    accentColor: '#D97706',
    bgGradient: 'from-amber-600/15 to-orange-600/5',
    description: 'Universal compressed zip archive unpackable across Windows, Mac and Linux.',
    mimeType: 'application/zip'
  },
  '7z': {
    format: '7z',
    label: '7-Zip Ultra Archive',
    shortLabel: '.7Z',
    platform: 'universal',
    accentColor: '#EA580C',
    bgGradient: 'from-orange-600/15 to-red-600/5',
    description: 'High-compression ratio 7z archive offering maximum bandwidth savings.',
    mimeType: 'application/x-7z-compressed'
  },
  rar: {
    format: 'rar',
    label: 'WinRAR Compressed Archive',
    shortLabel: '.RAR',
    platform: 'universal',
    accentColor: '#C026D3',
    bgGradient: 'from-fuchsia-600/15 to-pink-600/5',
    description: 'Proprietary Roshal Archive compressed file container.',
    mimeType: 'application/vnd.rar'
  },
  jar: {
    format: 'jar',
    label: 'Java Executable Archive',
    shortLabel: '.JAR',
    platform: 'universal',
    accentColor: '#DC2626',
    bgGradient: 'from-red-600/15 to-rose-600/5',
    description: 'Java Virtual Machine runnable archive executing seamlessly on all OSes.',
    mimeType: 'application/java-archive'
  },
  pwa: {
    format: 'pwa',
    label: 'Progressive Web App',
    shortLabel: '.PWA',
    platform: 'web',
    accentColor: '#2563EB',
    bgGradient: 'from-blue-600/15 to-indigo-600/5',
    description: 'Offline-capable progressive web application installable in any browser.',
    mimeType: 'text/html'
  },
  web: {
    format: 'web',
    label: 'Cloud Web Application',
    shortLabel: 'WEB',
    platform: 'web',
    accentColor: '#0284C7',
    bgGradient: 'from-sky-600/15 to-blue-600/5',
    description: 'Browser-accessible cloud application with zero local storage requirements.',
    mimeType: 'text/html'
  }
};

export function normalizePackageFormat(formatOrName?: string): SupportedPackageFormat {
  if (!formatOrName) return 'apk';
  const raw = formatOrName.toLowerCase().trim().replace(/^\./, '');

  if (raw === 'apk') return 'apk';
  if (raw === 'aab') return 'aab';
  if (raw === 'aar') return 'aar';
  if (raw === 'exe') return 'exe';
  if (raw === 'msi') return 'msi';
  if (raw === 'msix') return 'msix';
  if (raw === 'appx') return 'appx';
  if (raw === 'deb') return 'deb';
  if (raw === 'appimage') return 'appimage';
  if (raw === 'rpm') return 'rpm';
  if (raw === 'snap') return 'snap';
  if (raw === 'flatpak' || raw === 'flatpakref') return 'flatpak';
  if (raw === 'tar.gz' || raw === 'tgz') return 'tar.gz';
  if (raw === 'tar.xz' || raw === 'txz') return 'tar.xz';
  if (raw === 'tar.zst' || raw === 'tzst') return 'tar.zst';
  if (raw === 'bin') return 'bin';
  if (raw === 'run') return 'run';
  if (raw === 'dmg') return 'dmg';
  if (raw === 'pkg') return 'pkg';
  if (raw === 'ipa') return 'ipa';
  if (raw === 'zip') return 'zip';
  if (raw === '7z') return '7z';
  if (raw === 'rar') return 'rar';
  if (raw === 'jar') return 'jar';
  if (raw === 'pwa') return 'pwa';
  if (raw === 'web' || raw === 'webapp') return 'web';

  // Fallback checks on file extension
  if (raw.endsWith('.apk')) return 'apk';
  if (raw.endsWith('.ipa')) return 'ipa';
  if (raw.endsWith('.exe')) return 'exe';
  if (raw.endsWith('.msi')) return 'msi';
  if (raw.endsWith('.dmg')) return 'dmg';
  if (raw.endsWith('.deb')) return 'deb';
  if (raw.endsWith('.appimage')) return 'appimage';
  if (raw.endsWith('.rpm')) return 'rpm';
  if (raw.endsWith('.zip')) return 'zip';
  if (raw.endsWith('.tar.gz') || raw.endsWith('.tgz')) return 'tar.gz';

  return 'apk';
}

interface PackageFormatIconProps {
  format?: string;
  className?: string;
  size?: number | string;
  variant?: 'badge' | 'icon' | 'document' | 'pill';
}

/**
 * Production-grade vector SVG Icon for all 22 supported package formats.
 * Delivers crisp, retina-ready graphics with platform-accurate coloring and iconography.
 */
export default function PackageFormatIcon({
  format = 'apk',
  className = 'w-5 h-5',
  size,
  variant = 'icon'
}: PackageFormatIconProps) {
  const norm = normalizePackageFormat(format);
  const meta = SUPPORTED_PACKAGE_FORMATS[norm] || SUPPORTED_PACKAGE_FORMATS.apk;

  const styleObj = size ? { width: size, height: size } : undefined;

  // Variant 1: Compact Pill Badge (e.g. for list items and tags)
  if (variant === 'pill') {
    return (
      <span
        style={{ borderColor: `${meta.accentColor}33`, color: meta.accentColor }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-theme-hover/50 border ${className}`}
      >
        <PackageFormatIcon format={format} variant="icon" className="w-3.5 h-3.5" />
        <span>{meta.shortLabel}</span>
      </span>
    );
  }

  // Variant 2: Document / File Style (folded corner with prominent text)
  if (variant === 'document') {
    return (
      <svg
        viewBox="0 0 40 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={styleObj}
      >
        {/* Document Body with folded corner */}
        <path
          d="M4 6C4 3.79086 5.79086 2 8 2H26L36 12V42C36 44.2091 34.2091 46 32 46H8C5.79086 46 4 44.2091 4 42V6Z"
          fill="currentColor"
          className="text-neutral-100 dark:text-neutral-800"
          stroke={meta.accentColor}
          strokeWidth="2"
        />
        {/* Fold Corner */}
        <path
          d="M26 2V10C26 11.1046 26.8954 12 28 12H36"
          fill={meta.accentColor}
          fillOpacity="0.2"
          stroke={meta.accentColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Accent Bar */}
        <rect x="8" y="24" width="24" height="14" rx="3" fill={meta.accentColor} />
        {/* Extension Label */}
        <text
          x="20"
          y="34"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="ui-monospace, monospace"
          fontSize="8"
          fontWeight="bold"
          letterSpacing="0.5"
        >
          {meta.shortLabel.replace('.', '')}
        </text>
      </svg>
    );
  }

  // Variant 3: Crisp Vector Platform / Format Emblems
  switch (norm) {
    // -------------------------------------------------------------
    // Android Ecosystem (.apk, .aab, .aar)
    // -------------------------------------------------------------
    case 'apk':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <path d="M5 16C5 17.1046 5.89543 18 7 18H17C18.1046 18 19 17.1046 19 16V10H5V16Z" fill="#34A853" />
          <path d="M7 9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9H7Z" fill="#34A853" />
          <circle cx="9.5" cy="7" r="0.9" fill="white" />
          <circle cx="14.5" cy="7" r="0.9" fill="white" />
          <path d="M8 4L6.5 2" stroke="#34A853" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16 4L17.5 2" stroke="#34A853" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M3 11V15" stroke="#34A853" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M21 11V15" stroke="#34A853" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 18V21" stroke="#34A853" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 18V21" stroke="#34A853" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'aab':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#0F9D58" />
          <path d="M12 6.5L17 9.5V14.5L12 17.5L7 14.5V9.5L12 6.5Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 6.5V17.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
          <path d="M7 9.5L17 14.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
          <path d="M7 14.5L17 9.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.7" />
        </svg>
      );

    case 'aar':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="4" fill="#4285F4" />
          <path d="M7 9H17M7 12H14M7 15H11" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    // -------------------------------------------------------------
    // Windows Ecosystem (.exe, .msi, .msix, .appx)
    // -------------------------------------------------------------
    case 'exe':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <path d="M3 5.5L10 4.5V11.5H3V5.5Z" fill="#0078D7" />
          <path d="M11.5 4.3L21 3V11.5H11.5V4.3Z" fill="#0078D7" />
          <path d="M3 12.5H10V18.5L3 17.5V12.5Z" fill="#0078D7" />
          <path d="M11.5 12.5H21V20L11.5 18.7V12.5Z" fill="#0078D7" />
        </svg>
      );

    case 'msi':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#107C41" />
          <path d="M7 8V16M7 8L12 13L17 8M17 8V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'msix':
    case 'appx':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#008AD7" />
          <path d="M7 7L17 17M17 7L7 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // -------------------------------------------------------------
    // Linux Ecosystem (.deb, .appimage, .rpm, .snap, .flatpak, tar)
    // -------------------------------------------------------------
    case 'deb':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#A80030" />
          {/* Debian Swirl representation */}
          <path
            d="M12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.8 17 15.3 16 16.1 14.6C16.3 14.3 16.1 13.9 15.7 13.9C15.5 13.9 15.3 14 15.2 14.2C14.6 15.1 13.4 15.8 12 15.8C9.9 15.8 8.2 14.1 8.2 12C8.2 9.9 9.9 8.2 12 8.2C13.4 8.2 14.6 8.9 15.2 10C15.4 10.3 15.8 10.4 16.1 10.2C16.4 10 16.5 9.6 16.3 9.3C15.4 7.9 13.8 7 12 7Z"
            fill="white"
          />
        </svg>
      );

    case 'appimage':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#2574A9" />
          <path d="M12 6L17 11H13.5V17H10.5V11H7L12 6Z" fill="white" />
        </svg>
      );

    case 'rpm':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#EE0000" />
          <path d="M7 8H11.5C12.9 8 14 9.1 14 10.5C14 11.9 12.9 13 11.5 13H7V8ZM7 13H10.5L14 17H11.5L8.5 13.5H7V17H5V8H7" fill="white" />
        </svg>
      );

    case 'snap':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4 7L12 12L20 7L12 2Z" fill="#E95420" />
          <path d="M4 8.5V16.5L11 21V13L4 8.5Z" fill="#C34113" />
          <path d="M20 8.5V16.5L13 21V13L20 8.5Z" fill="#77216F" />
        </svg>
      );

    case 'flatpak':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#4A90E2" />
          <rect x="7" y="7" width="10" height="10" rx="2" stroke="white" strokeWidth="2" />
          <path d="M7 12H17" stroke="white" strokeWidth="2" />
        </svg>
      );

    case 'tar.gz':
    case 'tar.xz':
    case 'tar.zst':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4.89543 19.1046 4 18V6Z" fill="#F0AD4E" />
          <path d="M9 4V20M12 8H10M12 12H10M12 16H10" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="9.5" y="14" width="5" height="4" rx="1" fill="#78350F" />
        </svg>
      );

    case 'bin':
    case 'run':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#34495E" />
          <path d="M7 8L11 12L7 16" stroke="#2ECC71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 16H17" stroke="#2ECC71" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // -------------------------------------------------------------
    // macOS Ecosystem (.dmg, .pkg)
    // -------------------------------------------------------------
    case 'dmg':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9.5" fill="#9333EA" />
          <circle cx="12" cy="12" r="3.5" fill="white" />
          <circle cx="12" cy="12" r="1.5" fill="#9333EA" />
          <path d="M12 2.5V5.5M12 18.5V21.5M2.5 12H5.5M18.5 12H21.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
        </svg>
      );

    case 'pkg':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="#7C3AED" />
          <path d="M3 7.5V16.5L12 21.5V12.5L3 7.5Z" fill="#6D28D9" />
          <path d="M21 7.5V16.5L12 21.5V12.5L21 7.5Z" fill="#5B21B6" />
          <path d="M12 2.5L12 21" stroke="white" strokeWidth="1.2" strokeOpacity="0.4" />
        </svg>
      );

    // -------------------------------------------------------------
    // iOS Ecosystem (.ipa)
    // -------------------------------------------------------------
    case 'ipa':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#007AFF" />
          <path d="M14.8 12.8c0-1.6 1.3-2.4 1.4-2.5-.7-1.1-1.9-1.2-2.3-1.3-1-.1-1.9.6-2.5.6-.5 0-1.3-.6-2.1-.6-1.1 0-2.1.6-2.7 1.7-1.2 2.1-.3 5.1.8 6.8.6.9 1.2 1.7 2.1 1.7.8 0 1.2-.6 2.2-.6 1 0 1.3.6 2.1.6.9 0 1.5-.8 2-1.6.6-.9.9-1.9.9-2-.1 0-1.9-.8-1.9-2.9z" fill="white" />
          <path d="M13.8 8.2c.5-.6.8-1.3.7-2.1-.7 0-1.5.5-2 1-.4.5-.7 1.2-.7 2 .8.1 1.5-.4 2-.9z" fill="white" />
        </svg>
      );

    // -------------------------------------------------------------
    // Universal Archives (.zip, .7z, .rar, .jar)
    // -------------------------------------------------------------
    case 'zip':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="3" width="16" height="18" rx="3" fill="#D97706" />
          <path d="M11 3V13M13 5H11M13 9H11M13 13H11" stroke="white" strokeWidth="1.4" />
          <rect x="10" y="13" width="4" height="4" rx="1" fill="white" />
          <circle cx="12" cy="15" r="0.8" fill="#D97706" />
        </svg>
      );

    case '7z':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#EA580C" />
          <path d="M6 7H12L8 17H6L10 9H6V7ZM13 17V15H15.5L13 7H15.5L18 15V17H13Z" fill="white" />
        </svg>
      );

    case 'rar':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#C026D3" />
          <path d="M7 6H17M7 10H17M7 14H17M7 18H17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="9" y="8" width="6" height="8" rx="1" fill="#701A75" stroke="white" strokeWidth="1" />
        </svg>
      );

    case 'jar':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#DC2626" />
          {/* Coffee cup emblem */}
          <path d="M6 9H16V15C16 16.6569 14.6569 18 13 18H9C7.34315 18 6 16.6569 6 15V9Z" fill="white" />
          <path d="M16 11H18C18.5523 11 19 11.4477 19 12V13C19 13.5523 18.5523 14 18 14H16V11Z" stroke="white" strokeWidth="1.5" />
          <path d="M9 5C9 6.5 10 6.5 10 8M13 5C13 6.5 14 6.5 14 8" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    // -------------------------------------------------------------
    // Web / Cloud (.pwa, .web)
    // -------------------------------------------------------------
    case 'pwa':
    case 'web':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={styleObj} xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9.5" fill="#2563EB" />
          <path d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12C2.5 17.25 6.75 21.5 12 21.5C17.25 21.5 21.5 17.25 21.5 12C21.5 6.75 17.25 2.5 12 2.5ZM12 4C14.5 6.5 15.5 9 15.5 12C15.5 15 14.5 17.5 12 20C9.5 17.5 8.5 15 8.5 12C8.5 9 9.5 6.5 12 4ZM4 12C4 10.5 4.5 9.1 5.3 7.9L8.1 10.7C8 11.1 8 11.5 8 12C8 12.5 8 12.9 8.1 13.3L5.3 16.1C4.5 14.9 4 13.5 4 12Z" fill="white" />
        </svg>
      );
  }
}
