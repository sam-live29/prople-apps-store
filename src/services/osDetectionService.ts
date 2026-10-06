/**
 * Operating System & Device Detection Service
 * 
 * Provides robust detection of the client's operating system (Windows vs. Android/iOS/macOS/Linux)
 * using navigator.userAgent, navigator.platform, and userAgentData to dynamically drive
 * OS-tailored button labels ('Download' vs 'Install', 'Download APK' vs 'Download Windows App')
 * and compatibility metadata across the store without requiring visual layout alterations.
 */

export type ClientOS = 'windows' | 'android' | 'macos' | 'ios' | 'linux' | 'other';

export interface OSInfo {
  os: ClientOS;
  isWindows: boolean;
  isAndroid: boolean;
  isMacOS: boolean;
  isIOS: boolean;
  isLinux: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  osName: string;
}

/**
 * Detects the client's operating system using navigator.userAgent and client hints.
 */
export function detectClientOS(): ClientOS {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'android'; // Safe default for store environment
  }

  const userAgent = (navigator.userAgent || navigator.vendor || '').toLowerCase();
  const platform = ((navigator as any).userAgentData?.platform || navigator.platform || '').toLowerCase();

  // Android detection (must precede Linux check as Android UA contains 'Linux')
  if (/android/.test(userAgent) || /android/.test(platform)) {
    return 'android';
  }

  // Windows detection
  if (/windows|win32|win64|wow64|win98|win2000|winxp/.test(userAgent) || /win/.test(platform)) {
    return 'windows';
  }

  // iOS detection (iPhone, iPad, iPod)
  if (/iphone|ipad|ipod/.test(userAgent) || (/mac/.test(platform) && (navigator as any).maxTouchPoints > 1)) {
    return 'ios';
  }

  // macOS detection
  if (/macintosh|mac os x/.test(userAgent) || /mac/.test(platform)) {
    return 'macos';
  }

  // Linux detection
  if (/linux|x11/.test(userAgent) || /linux/.test(platform)) {
    return 'linux';
  }

  return 'other';
}

/**
 * Returns comprehensive OS and device architecture information.
 */
export function getClientOSInfo(): OSInfo {
  const os = detectClientOS();
  const isWindows = os === 'windows';
  const isAndroid = os === 'android';
  const isMacOS = os === 'macos';
  const isIOS = os === 'ios';
  const isLinux = os === 'linux';
  const isDesktop = isWindows || isMacOS || isLinux;
  const isMobile = isAndroid || isIOS;

  let osName = 'Android';
  switch (os) {
    case 'windows':
      osName = 'Windows';
      break;
    case 'android':
      osName = 'Android';
      break;
    case 'macos':
      osName = 'macOS';
      break;
    case 'ios':
      osName = 'iOS';
      break;
    case 'linux':
      osName = 'Linux';
      break;
    default:
      osName = 'Device';
      break;
  }

  return {
    os,
    isWindows,
    isAndroid,
    isMacOS,
    isIOS,
    isLinux,
    isDesktop,
    isMobile,
    osName,
  };
}

/**
 * Checks if the current client is running Windows.
 */
export function isWindowsClient(): boolean {
  return detectClientOS() === 'windows';
}

/**
 * Checks if the current client is running Android.
 */
export function isAndroidClient(): boolean {
  return detectClientOS() === 'android';
}

/**
 * Checks if the current client is running iOS (iPhone, iPad, iPod touch).
 */
export function isIOSClient(): boolean {
  return detectClientOS() === 'ios';
}

function resolveAppContext(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | string | null,
  candidateAsset?: string
): { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string; fileName: string } {
  if (!app) {
    const raw = (candidateAsset || '').toLowerCase().split('?')[0];
    return { fileName: raw };
  }
  if (typeof app === 'string') {
    const raw = (app || candidateAsset || '').toLowerCase().split('?')[0];
    return { assetName: app, downloadUrl: app, fileName: raw };
  }
  const raw = (candidateAsset || app.assetName || app.downloadUrl || '').toLowerCase().split('?')[0];
  return { ...app, fileName: raw };
}

/**
 * Determines whether a target app is a macOS application (.dmg, .pkg, .app.zip).
 */
export function isMacApp(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | string | null,
  candidateAsset?: string
): boolean {
  const ctx = resolveAppContext(app, candidateAsset);
  if (!ctx.fileName && !ctx.platform && !ctx.packageFormat) return false;

  // If explicitly designated as another platform, never classify as Mac
  if (ctx.platform === 'windows' || ctx.platform === 'linux' || ctx.platform === 'android' || ctx.platform === 'ios') return false;
  if (
    ctx.packageFormat === 'deb' ||
    ctx.packageFormat === 'AppImage' ||
    ctx.packageFormat === 'rpm' ||
    ctx.packageFormat === 'tar.gz' ||
    ctx.packageFormat === 'snap' ||
    ctx.packageFormat === 'bin' ||
    ctx.packageFormat === 'apk' ||
    ctx.packageFormat === 'aar' ||
    ctx.packageFormat === 'ipa' ||
    ctx.packageFormat === 'exe' ||
    ctx.packageFormat === 'msi' ||
    ctx.packageFormat === 'msix'
  ) {
    return false;
  }

  const fileName = ctx.fileName;

  // Comprehensive check: Any Linux, Windows, Android, or iOS extensions/keywords immediately disqualify from being a Mac app
  if (
    fileName.endsWith('.apk') ||
    fileName.endsWith('.aar') ||
    fileName.endsWith('.aab') ||
    fileName.endsWith('.ipa') ||
    fileName.endsWith('.exe') ||
    fileName.endsWith('.msi') ||
    fileName.endsWith('.msix') ||
    fileName.endsWith('.msixbundle') ||
    fileName.endsWith('.appx') ||
    fileName.endsWith('.appxbundle') ||
    fileName.endsWith('.deb') ||
    fileName.endsWith('.appimage') ||
    fileName.endsWith('.rpm') ||
    fileName.endsWith('.tar.gz') ||
    fileName.endsWith('.tgz') ||
    fileName.endsWith('.tar.xz') ||
    fileName.endsWith('.tar.bz2') ||
    fileName.endsWith('.snap') ||
    fileName.endsWith('.flatpakref') ||
    fileName.endsWith('.flatpak') ||
    fileName.endsWith('.run') ||
    fileName.endsWith('.bin') ||
    fileName.includes('linux') ||
    fileName.includes('ubuntu') ||
    fileName.includes('debian') ||
    fileName.includes('fedora') ||
    fileName.includes('archlinux') ||
    fileName.includes('amd64') ||
    fileName.includes('x86_64-unknown-linux')
  ) {
    return false;
  }

  if (ctx.platform === 'mac' || ctx.platform === 'macos' || ctx.platform === 'darwin') return true;
  if (ctx.packageFormat === 'dmg' || ctx.packageFormat === 'pkg') return true;

  return (
    fileName.endsWith('.dmg') ||
    (fileName.endsWith('.pkg') && !fileName.includes('.pkg.tar.')) ||
    fileName.endsWith('.app.zip') ||
    fileName.includes('-mac.') ||
    fileName.includes('-macos.') ||
    fileName.includes('-darwin.') ||
    fileName.includes('_mac_') ||
    fileName.includes('_macos_') ||
    ((fileName.includes('mac') || fileName.includes('darwin') || fileName.includes('osx') || fileName.includes('apple')) && (fileName.endsWith('.zip') || fileName.endsWith('.7z')) && !fileName.includes('linux') && !fileName.includes('win'))
  );
}

/**
 * Determines whether a target app is a Windows executable package.
 */
export function isWindowsApp(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | string | null,
  candidateAsset?: string
): boolean {
  const ctx = resolveAppContext(app, candidateAsset);
  if (!ctx.fileName && !ctx.platform && !ctx.packageFormat) return false;

  if (ctx.platform === 'windows') return true;
  if (ctx.packageFormat === 'exe' || ctx.packageFormat === 'msi' || ctx.packageFormat === 'msix' || ctx.packageFormat === 'appx' || ctx.packageFormat === '7z' || ctx.packageFormat === 'zip' || ctx.packageFormat === 'rar') {
    if (ctx.platform !== 'linux' && ctx.platform !== 'mac') return true;
  }

  const fileName = ctx.fileName;
  if (
    fileName.endsWith('.apk') ||
    fileName.endsWith('.aar') ||
    fileName.endsWith('.aab') ||
    fileName.endsWith('.deb') ||
    fileName.endsWith('.appimage') ||
    fileName.endsWith('.rpm') ||
    fileName.endsWith('.tar.gz') ||
    fileName.endsWith('.dmg') ||
    (fileName.endsWith('.pkg') && !fileName.includes('.pkg.tar.'))
  ) {
    return false;
  }

  const isWinName = (
    fileName.endsWith('.exe') || 
    fileName.endsWith('.msi') || 
    fileName.endsWith('.msix') || 
    fileName.endsWith('.msixbundle') || 
    fileName.endsWith('.appx') || 
    fileName.endsWith('.appxbundle') || 
    fileName.includes('windows') || 
    fileName.includes('_win_') || 
    fileName.includes('-win_') || 
    fileName.includes('_win-') || 
    fileName.includes('-win-') || 
    fileName.includes('_win.') || 
    fileName.includes('-win.') || 
    fileName.includes('.win.') || 
    fileName.includes('.win') || 
    fileName.includes('win_x64') || 
    fileName.includes('win-x64') || 
    fileName.includes('win_arm64') || 
    fileName.includes('win-arm64') || 
    fileName.includes('win_x86') || 
    fileName.includes('win-x86') || 
    fileName.includes('win32') || 
    fileName.includes('win64') ||
    ((fileName.endsWith('.zip') || fileName.endsWith('.7z') || fileName.endsWith('.rar')) && 
      (fileName.includes('win') || fileName.includes('windows') || fileName.includes('portable') || fileName.includes('x64') || fileName.includes('x86') || fileName.includes('amd64')) && 
      !fileName.includes('linux') && !fileName.includes('mac') && !fileName.includes('darwin'))
  );

  if (isWinName) return true;

  // General .7z and .rar archives with no Linux/Mac designation are Windows desktop packages
  if (fileName.endsWith('.7z') || fileName.endsWith('.rar')) {
    if (!fileName.includes('linux') && !fileName.includes('mac') && !fileName.includes('darwin') && ctx.platform !== 'linux' && ctx.platform !== 'mac') {
      return true;
    }
  }

  if (ctx.platform === 'linux' || ctx.platform === 'android' || ctx.platform === 'mac' || ctx.platform === 'macos') return false;

  return false;
}

/**
 * Determines whether a target app is a Linux package (AppImage, deb, rpm, tar.gz, snap, etc.).
 */
export function isLinuxApp(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | string | null,
  candidateAsset?: string
): boolean {
  const ctx = resolveAppContext(app, candidateAsset);
  if (!ctx.fileName && !ctx.platform && !ctx.packageFormat) return false;

  if (ctx.platform === 'linux') return true;
  if (
    ctx.packageFormat === 'deb' ||
    ctx.packageFormat === 'AppImage' ||
    ctx.packageFormat === 'rpm' ||
    ctx.packageFormat === 'tar.gz' ||
    ctx.packageFormat === 'tar.xz' ||
    ctx.packageFormat === 'tar.zst' ||
    ctx.packageFormat === 'snap' ||
    ctx.packageFormat === 'flatpak' ||
    ctx.packageFormat === 'run' ||
    ctx.packageFormat === 'bin'
  ) {
    if (ctx.platform !== 'windows' && ctx.platform !== 'mac') return true;
  }

  const fileName = ctx.fileName;
  if (
    fileName.endsWith('.apk') ||
    fileName.endsWith('.aar') ||
    fileName.endsWith('.aab') ||
    fileName.endsWith('.exe') ||
    fileName.endsWith('.msi') ||
    fileName.endsWith('.dmg') ||
    (fileName.endsWith('.pkg') && !fileName.includes('.pkg.tar.'))
  ) {
    return false;
  }

  const isLinName = (
    fileName.endsWith('.deb') ||
    fileName.endsWith('.appimage') ||
    fileName.endsWith('.rpm') ||
    fileName.endsWith('.tar.gz') ||
    fileName.endsWith('.tgz') ||
    fileName.endsWith('.tar.xz') ||
    fileName.endsWith('.txz') ||
    fileName.endsWith('.tar.bz2') ||
    fileName.endsWith('.tbz2') ||
    fileName.endsWith('.tar.zst') ||
    fileName.endsWith('.tzst') ||
    fileName.endsWith('.pkg.tar.zst') ||
    fileName.endsWith('.pkg.tar.xz') ||
    fileName.endsWith('.snap') ||
    fileName.endsWith('.flatpakref') ||
    fileName.endsWith('.flatpak') ||
    fileName.endsWith('.run') ||
    fileName.endsWith('.bin') ||
    fileName.includes('linux') ||
    fileName.includes('ubuntu') ||
    fileName.includes('debian') ||
    fileName.includes('fedora') ||
    fileName.includes('archlinux') ||
    ((fileName.includes('amd64') || fileName.includes('x86_64') || fileName.includes('aarch64') || fileName.includes('arm64')) && 
     !fileName.includes('win') && !fileName.endsWith('.exe') && !fileName.endsWith('.msi') && !fileName.endsWith('.apk') && !fileName.endsWith('.dmg') && !fileName.endsWith('.pkg'))
  );

  if (isLinName) return true;

  if (ctx.platform === 'windows' || ctx.platform === 'android' || ctx.platform === 'mac' || ctx.platform === 'macos' || ctx.platform === 'ios') return false;

  return false;
}

/**
 * Determines whether a target app is an iOS package (.ipa).
 */
export function isIOSApp(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | string | null,
  candidateAsset?: string
): boolean {
  if (!app) {
    const raw = (candidateAsset || '').toLowerCase().split('?')[0];
    return raw.endsWith('.ipa') || raw.includes('-ios.') || raw.includes('_ios.') || raw.includes('.ios.') || raw.includes('ios_arm64') || raw.includes('ios-arm64');
  }
  if (typeof app === 'string') {
    const raw = (app || candidateAsset || '').toLowerCase().split('?')[0];
    return raw.endsWith('.ipa') || raw.includes('-ios.') || raw.includes('_ios.') || raw.includes('.ios.') || raw.includes('ios_arm64') || raw.includes('ios-arm64');
  }
  if (app.platform === 'ios') return true;
  if (app.packageFormat === 'ipa' || (app.packageFormat || '').toLowerCase().includes('ipa') || (app.packageFormat || '').toLowerCase().includes('ios')) return true;

  const raw = (candidateAsset || app.assetName || app.downloadUrl || '').toLowerCase().split('?')[0];
  return (
    raw.endsWith('.ipa') ||
    raw.includes('-ios.') ||
    raw.includes('_ios.') ||
    raw.includes('.ios.') ||
    raw.includes('ios_arm64') ||
    raw.includes('ios-arm64')
  );
}

/**
 * Determines whether a target app is an Android package (.apk, .aab).
 * Note: .aar is strictly excluded because it is a developer library, not an end-user installable app.
 */
export function isAndroidApp(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | string | null,
  candidateAsset?: string
): boolean {
  const ctx = resolveAppContext(app, candidateAsset);
  if (!ctx.fileName && !ctx.platform && !ctx.packageFormat) return false;

  // If detected as Windows, Linux, Mac, or iOS, it is NOT an Android app!
  if (isWindowsApp(app, candidateAsset) || isLinuxApp(app, candidateAsset) || isMacApp(app, candidateAsset) || isIOSApp(app, candidateAsset)) return false;
  if (ctx.platform === 'android') return true;
  if (ctx.packageFormat === 'apk' || ctx.packageFormat === 'aab') return true;
  const fileName = ctx.fileName;
  return fileName.endsWith('.apk') || fileName.endsWith('.aab');
}

/**
 * iOS Download Option definition
 */
export interface IOSDownloadOption {
  id: 'ipa';
  label: string;
  formatBadge: string;
  description: string;
  fileName: string;
  downloadUrl?: string;
}

/**
 * Returns available iOS download options (iOS Application Package .ipa)
 */
export function getIOSDownloadOptions(app?: {
  id?: string;
  name?: string;
  assetName?: string;
  downloadUrl?: string;
  packageFormat?: string;
  githubReleaseUrl?: string;
  versionName?: string;
} | null): IOSDownloadOption[] {
  if (!app) return [];

  const primaryUrl = app.downloadUrl || '';
  const exactUrlFile = primaryUrl ? decodeURIComponent(primaryUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim() : '';
  const exactAsset = app.assetName || exactUrlFile || '';

  return [{
    id: 'ipa',
    label: 'iOS App Package (.ipa)',
    formatBadge: '.ipa',
    description: 'Native iOS application package for iPhone, iPad, and AltStore / SideStore',
    fileName: exactAsset,
    downloadUrl: primaryUrl,
  }];
}

/**
 * macOS Download Option definition
 */
export interface MacDownloadOption {
  id: 'dmg' | 'pkg' | 'zip';
  label: string;
  formatBadge: string;
  description: string;
  fileName: string;
  downloadUrl?: string;
}

/**
 * Returns available macOS download options (e.g. Apple Disk Image vs PKG Installer vs Universal Zip)
 */
export function getMacDownloadOptions(app?: {
  id?: string;
  name?: string;
  assetName?: string;
  downloadUrl?: string;
  packageFormat?: string;
  githubReleaseUrl?: string;
  versionName?: string;
} | null): MacDownloadOption[] {
  if (!app) return [];

  const primaryUrl = app.downloadUrl || '';
  const exactUrlFile = primaryUrl ? decodeURIComponent(primaryUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim() : '';
  const exactAsset = app.assetName || exactUrlFile || '';
  const currentAsset = exactAsset.toLowerCase();

  const isPkg = currentAsset.endsWith('.pkg') || app.packageFormat === 'pkg';
  const isZip = currentAsset.endsWith('.zip') || app.packageFormat === 'zip';

  const dmgOption: MacDownloadOption = {
    id: 'dmg',
    label: 'Apple Disk Image (.dmg)',
    formatBadge: '.dmg',
    description: 'Standard macOS disk image — open and drag to Applications',
    fileName: exactAsset,
    downloadUrl: primaryUrl,
  };

  const pkgOption: MacDownloadOption = {
    id: 'pkg',
    label: 'macOS Installer Package (.pkg)',
    formatBadge: '.pkg',
    description: 'Guided Apple system installer wizard',
    fileName: exactAsset,
    downloadUrl: primaryUrl,
  };

  const zipOption: MacDownloadOption = {
    id: 'zip',
    label: 'Universal Standalone Archive (.zip)',
    formatBadge: '.zip',
    description: 'Universal .app bundle for Apple Silicon and Intel Macs',
    fileName: exactAsset,
    downloadUrl: primaryUrl,
  };

  if (isPkg) return [pkgOption];
  if (isZip) return [zipOption];
  return [dmgOption];
}

/**
 * Windows Download Option definition
 */
export interface WindowsDownloadOption {
  id: 'exe' | 'zip' | 'msi';
  label: string;
  formatBadge: string;
  description: string;
  fileName: string;
  downloadUrl?: string;
}

/**
 * Returns available Windows download options (e.g. Executable Installer vs Portable ZIP)
 */
export function getWindowsDownloadOptions(app?: {
  id?: string;
  name?: string;
  assetName?: string;
  downloadUrl?: string;
  packageFormat?: string;
  githubReleaseUrl?: string;
  versionName?: string;
} | null): WindowsDownloadOption[] {
  if (!app) return [];

  const primaryUrl = app.downloadUrl || '';
  const exactUrlFile = primaryUrl ? decodeURIComponent(primaryUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim() : '';
  const exactAsset = app.assetName || exactUrlFile || '';
  const currentAsset = exactAsset.toLowerCase();

  const isMsi = currentAsset.endsWith('.msi') || app.packageFormat === 'msi';
  const isZip = currentAsset.endsWith('.zip') || app.packageFormat === 'zip';

  if (isZip) {
    return [{
      id: 'zip',
      label: 'Portable Package (.zip)',
      formatBadge: '.zip',
      description: 'Standalone archive — run directly without setup',
      fileName: exactAsset,
      downloadUrl: primaryUrl,
    }];
  }

  return [{
    id: isMsi ? 'msi' : 'exe',
    label: isMsi ? 'Windows Installer (.msi)' : 'Windows Executable (.exe)',
    formatBadge: isMsi ? '.msi' : '.exe',
    description: 'Standard Windows setup installer',
    fileName: exactAsset,
    downloadUrl: primaryUrl,
  }];
}

/**
 * Linux Download Option definition
 */
export interface LinuxDownloadOption {
  id: 'appimage' | 'deb' | 'rpm' | 'tar.gz';
  label: string;
  formatBadge: string;
  description: string;
  fileName: string;
  downloadUrl?: string;
}

/**
 * Returns available Linux download options (e.g. AppImage vs Debian .deb vs Tarball)
 */
export function getLinuxDownloadOptions(app?: {
  id?: string;
  name?: string;
  assetName?: string;
  downloadUrl?: string;
  packageFormat?: string;
  githubReleaseUrl?: string;
  versionName?: string;
} | null): LinuxDownloadOption[] {
  if (!app) return [];

  const primaryUrl = app.downloadUrl || '';
  const exactUrlFile = primaryUrl ? decodeURIComponent(primaryUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim() : '';
  const exactAsset = app.assetName || exactUrlFile || '';
  const currentAsset = exactAsset.toLowerCase();

  const isDeb = currentAsset.endsWith('.deb') || app.packageFormat === 'deb';
  const isRpm = currentAsset.endsWith('.rpm') || app.packageFormat === 'rpm';
  const isTar = currentAsset.endsWith('.tar.gz') || currentAsset.endsWith('.tgz') || app.packageFormat === 'tar.gz';

  const primaryFormat = isDeb ? 'deb' : isRpm ? 'rpm' : isTar ? 'tar.gz' : 'appimage';

  return [{
    id: primaryFormat as any,
    label: isDeb ? 'Debian / Ubuntu Package (.deb)' : isRpm ? 'RedHat / Fedora Package (.rpm)' : isTar ? 'Tarball Archive (.tar.gz)' : 'Standalone Linux AppImage (.AppImage)',
    formatBadge: isDeb ? '.deb' : isRpm ? '.rpm' : isTar ? '.tar.gz' : '.AppImage',
    description: isDeb ? 'Universal Debian & Ubuntu package installer' : isRpm ? 'Fedora, RHEL & openSUSE package' : isTar ? 'Source and compiled binaries tarball' : 'Self-contained executable for all Linux distributions',
    fileName: exactAsset,
    downloadUrl: primaryUrl,
  }];
}

/**
 * Distinguishes whether the app is 'macOS Package', 'Linux Package', 'Windows Executable', 'iOS Package', 'Android AAB', or 'Android APK'.
 */
export function getAppFormatBadgeLabel(app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string; primaryApk?: any; releaseAsset?: any } | null): {
  type: 'windows' | 'android' | 'linux' | 'mac' | 'ios';
  label: 'Windows Executable' | 'Android APK' | 'Android AAB' | 'Linux Package' | 'macOS Package' | 'iOS Package';
  shortLabel: 'Windows' | 'Android' | 'Linux' | 'macOS' | 'iOS';
  compactLabel: 'Windows' | 'APK' | 'AAB' | 'Linux' | 'macOS' | 'iOS';
} {
  if (isIOSApp(app)) {
    return {
      type: 'ios',
      label: 'iOS Package',
      shortLabel: 'iOS',
      compactLabel: 'iOS',
    };
  }
  if (isLinuxApp(app)) {
    return {
      type: 'linux',
      label: 'Linux Package',
      shortLabel: 'Linux',
      compactLabel: 'Linux',
    };
  }
  if (isWindowsApp(app)) {
    return {
      type: 'windows',
      label: 'Windows Executable',
      shortLabel: 'Windows',
      compactLabel: 'Windows',
    };
  }
  if (isMacApp(app)) {
    return {
      type: 'mac',
      label: 'macOS Package',
      shortLabel: 'macOS',
      compactLabel: 'macOS',
    };
  }

  const rawFormat = (app?.packageFormat || '').trim().toLowerCase().replace(/^\./, '');
  const assetName = (app?.assetName || (app as any)?.primaryApk?.name || (app as any)?.releaseAsset?.name || '').toLowerCase().split('?')[0];
  const downloadUrl = (app?.downloadUrl || (app as any)?.primaryApk?.downloadUrl || (app as any)?.releaseAsset?.downloadUrl || '').toLowerCase().split('?')[0];
  const isAab = rawFormat === 'aab' || assetName.endsWith('.aab') || downloadUrl.endsWith('.aab') || downloadUrl.includes('.aab');

  if (isAab) {
    return {
      type: 'android',
      label: 'Android AAB',
      shortLabel: 'Android',
      compactLabel: 'AAB',
    };
  }

  return {
    type: 'android',
    label: 'Android APK',
    shortLabel: 'Android',
    compactLabel: 'APK',
  };
}

/**
 * Returns a precise, publisher-driven or release-derived single package format label
 * without ambiguous multi-format placeholders.
 */
export function getDetailedPackageFormatLabel(app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | null): string {
  if (!app) return 'Application Package';
  const rawFormat = (app.packageFormat || '').trim().replace(/^\./, '');
  const assetName = (app.assetName || app.downloadUrl || '').split('?')[0].toLowerCase();
  
  let fmt = rawFormat.toLowerCase();
  if (!fmt) {
    if (assetName.endsWith('.ipa')) fmt = 'ipa';
    else if (assetName.endsWith('.dmg')) fmt = 'dmg';
    else if (assetName.endsWith('.pkg')) fmt = 'pkg';
    else if (assetName.endsWith('.apk')) fmt = 'apk';
    else if (assetName.endsWith('.aab')) fmt = 'aab';
    else if (assetName.endsWith('.aar')) fmt = 'aar';
    else if (assetName.endsWith('.deb')) fmt = 'deb';
    else if (assetName.endsWith('.appimage')) fmt = 'appimage';
    else if (assetName.endsWith('.rpm')) fmt = 'rpm';
    else if (assetName.endsWith('.tar.gz') || assetName.endsWith('.tgz')) fmt = 'tar.gz';
    else if (assetName.endsWith('.exe')) fmt = 'exe';
    else if (assetName.endsWith('.msi')) fmt = 'msi';
    else if (assetName.endsWith('.msix')) fmt = 'msix';
    else if (assetName.endsWith('.appx')) fmt = 'appx';
    else if (assetName.endsWith('.zip')) fmt = 'zip';
    else if (assetName.endsWith('.7z')) fmt = '7z';
  }

  const isIOS = isIOSApp(app) || fmt === 'ipa';
  const isMac = !isIOS && (isMacApp(app) || fmt === 'dmg' || fmt === 'pkg');
  const isWin = isWindowsApp(app) || fmt === 'exe' || fmt === 'msi' || fmt === 'msix';
  const isLin = isLinuxApp(app) || fmt === 'deb' || fmt === 'appimage' || fmt === 'rpm' || fmt === 'tar.gz';

  if (fmt === 'ipa' || isIOS) return 'iOS Package (.ipa)';
  if (fmt === 'dmg') return 'macOS Disk Image (.dmg)';
  if (fmt === 'pkg') return 'macOS Installer Package (.pkg)';
  if (fmt === 'apk') return 'Android Package (.apk)';
  if (fmt === 'aab') return 'Android App Bundle (.aab)';
  if (fmt === 'aar') return 'Android Archive (.aar)';
  if (fmt === 'deb') return 'Debian / Ubuntu Package (.deb)';
  if (fmt === 'appimage') return 'AppImage Executable (.AppImage)';
  if (fmt === 'rpm') return 'RPM Package (.rpm)';
  if (fmt === 'tar.gz' || fmt === 'tgz') return 'Tarball Binary Archive (.tar.gz)';
  if (fmt === 'exe') return 'Windows Executable (.exe)';
  if (fmt === 'msi') return 'Windows Installer (.msi)';
  if (fmt === 'msix' || fmt === 'appx') return 'Modern Windows Package (.msix)';
  if (fmt === 'zip') {
    if (isMac) return 'macOS Package (.zip)';
    if (isWin) return 'Windows Archive (.zip)';
    if (isLin) return 'Linux Archive (.zip)';
    return 'Compressed Archive (.zip)';
  }

  if (rawFormat) {
    if (rawFormat.includes('(') || rawFormat.includes('.')) return rawFormat;
    return `${rawFormat.toUpperCase()} Package (.${rawFormat})`;
  }

  if (isIOS) return 'iOS Package (.ipa)';
  if (isMac) return 'macOS Package (.dmg)';
  if (isLin) return 'Linux Package (.AppImage / .deb)';
  if (isWin) return 'Windows Executable (.exe)';
  return 'Android Package (.apk)';
}

/**
 * Returns a clean, capitalized file type format string (e.g. 'DMG', 'PKG', 'EXE', 'MSI', 'AppImage', 'DEB', 'RPM', 'APK', 'ZIP')
 */
export function getAppFormatExtension(app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | null): string {
  if (!app) return '';
  if (app.platform === 'ios' || isIOSApp(app) || app.packageFormat === 'ipa') return 'IPA';
  if (app.platform === 'mac' || isMacApp(app) || app.packageFormat === 'dmg' || app.packageFormat === 'pkg') {
    if (app.packageFormat === 'pkg' || (app.assetName || app.downloadUrl || '').toLowerCase().includes('.pkg')) return 'PKG';
    return 'DMG';
  }
  if (app.platform === 'windows' || isWindowsApp(app) || app.packageFormat === 'exe' || app.packageFormat === 'msi') {
    if (app.packageFormat === 'msi' || (app.assetName || app.downloadUrl || '').toLowerCase().includes('.msi')) return 'MSI';
    return 'EXE';
  }
  if (app.platform === 'linux' || isLinuxApp(app) || app.packageFormat === 'deb' || app.packageFormat === 'appimage' || app.packageFormat === 'rpm') {
    if (app.packageFormat === 'deb' || (app.assetName || app.downloadUrl || '').toLowerCase().includes('.deb')) return 'DEB';
    if (app.packageFormat === 'rpm' || (app.assetName || app.downloadUrl || '').toLowerCase().includes('.rpm')) return 'RPM';
    if (app.packageFormat === 'tar.gz' || (app.assetName || app.downloadUrl || '').toLowerCase().includes('.tar.gz')) return 'TAR.GZ';
    return 'AppImage';
  }

  const rawFormat = (app.packageFormat || '').trim().replace(/^\./, '');
  const assetName = (app.assetName || app.downloadUrl || '').split('?')[0].toLowerCase();
  
  let fmt = rawFormat.toLowerCase();
  if (!fmt) {
    if (assetName.endsWith('.ipa')) fmt = 'ipa';
    else if (assetName.endsWith('.dmg')) fmt = 'dmg';
    else if (assetName.endsWith('.pkg')) fmt = 'pkg';
    else if (assetName.endsWith('.apk')) fmt = 'apk';
    else if (assetName.endsWith('.aab')) fmt = 'aab';
    else if (assetName.endsWith('.aar')) fmt = 'aar';
    else if (assetName.endsWith('.deb')) fmt = 'deb';
    else if (assetName.endsWith('.appimage')) fmt = 'appimage';
    else if (assetName.endsWith('.rpm')) fmt = 'rpm';
    else if (assetName.endsWith('.tar.gz') || assetName.endsWith('.tgz')) fmt = 'tar.gz';
    else if (assetName.endsWith('.exe')) fmt = 'exe';
    else if (assetName.endsWith('.msi')) fmt = 'msi';
    else if (assetName.endsWith('.msix')) fmt = 'msix';
    else if (assetName.endsWith('.appx')) fmt = 'appx';
    else if (assetName.endsWith('.zip')) fmt = 'zip';
    else if (assetName.endsWith('.7z')) fmt = '7z';
  }

  if (fmt === 'ipa') return 'IPA';
  if (fmt === 'appimage') return 'AppImage';
  if (fmt === 'tar.gz' || fmt === 'tgz') return 'TAR.GZ';
  if (fmt === 'msix') return 'MSIX';
  if (fmt === 'dmg') return 'DMG';
  if (fmt === 'pkg') return 'PKG';
  if (fmt === 'exe') return 'EXE';
  if (fmt === 'msi') return 'MSI';
  if (fmt === 'deb') return 'DEB';
  if (fmt === 'rpm') return 'RPM';
  if (fmt === 'apk') return 'APK';
  if (fmt === 'aab') return 'AAB';
  if (fmt === 'aar') return 'AAR';
  if (fmt === 'zip') return 'ZIP';
  if (fmt) return fmt.toUpperCase();

  // Platform fallback defaults
  if (isIOSApp(app) || app.platform === 'ios') return 'IPA';
  if (isMacApp(app) || app.platform === 'mac') return 'DMG';
  if (isWindowsApp(app) || app.platform === 'windows') return 'EXE';
  if (isLinuxApp(app) || app.platform === 'linux') return 'AppImage';
  return 'APK';
}

/**
 * Returns a human-friendly action label for download or install buttons that includes
 * the platform and specific file format type for ultimate user clarification
 * (e.g. 'Download IPA', 'Download Mac DMG', 'Download Mac PKG', 'Download Windows EXE', 'Download Linux AppImage', 'Install APK', 'Download APK')
 */
export function getAppActionFileLabel(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string } | null,
  targetPlatform?: string,
  options?: { isReDownload?: boolean; sizeSuffix?: string }
): string {
  const platform = targetPlatform || app?.platform;
  const isIOS = platform === 'ios' || isIOSApp(app) || app?.platform === 'ios' || app?.packageFormat === 'ipa';
  const isMac = !isIOS && (platform === 'mac' || isMacApp(app) || app?.platform === 'mac');
  const isWin = !isIOS && !isMac && (platform === 'windows' || isWindowsApp(app) || app?.platform === 'windows');
  const isLin = !isIOS && !isMac && !isWin && (platform === 'linux' || isLinuxApp(app) || app?.platform === 'linux');
  const ext = getAppFormatExtension(app);
  const suffix = options?.sizeSuffix || '';

  if (isIOS) {
    return `Download IPA${suffix}`;
  }
  if (isMac) {
    return `Download Mac ${ext || 'DMG'}${suffix}`;
  }
  if (isWin) {
    return `Download Windows ${ext || 'EXE'}${suffix}`;
  }
  if (isLin) {
    return `Download Linux ${ext || 'AppImage'}${suffix}`;
  }

  return `Download ${ext || 'APK'}${suffix}`;
}

/**
 * Computes the primary action button label with explicit file type clarification
 * based on the user's detected client OS and the app's target platform.
 */
export function getAppPrimaryActionLabel(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string; size?: string } | null,
  options?: { includeSize?: boolean; sizeString?: string; compact?: boolean; targetPlatform?: string }
): string {
  const sizeSuffix = options?.includeSize && options?.sizeString ? ` (${options.sizeString})` : '';

  // Compact button labels (for cards or mini banners)
  if (options?.compact) {
    return 'Download';
  }

  return getAppActionFileLabel(app, options?.targetPlatform, { sizeSuffix });
}

/**
 * Returns dynamic download progress status text ('Downloading iOS App...' vs 'Downloading Mac App...' vs 'Downloading App...' vs 'Downloading APK...')
 */
export function getDownloadingStatusLabel(app?: { platform?: string; assetName?: string; packageFormat?: string } | null): string {
  if (isIOSApp(app)) {
    return 'Downloading iOS App...';
  }
  if (isMacApp(app)) {
    return 'Downloading Mac App...';
  }
  if (isLinuxApp(app)) {
    return 'Downloading Linux App...';
  }
  if (isWindowsApp(app)) {
    return 'Downloading Windows App...';
  }
  return 'Downloading APK...';
}

/**
 * Returns dynamic package verification text ('Verifying iOS package...' vs 'Verifying Mac package...' vs 'Verifying Windows App...' vs 'Verifying APK...')
 */
export function getVerifyingStatusLabel(app?: { platform?: string; assetName?: string; packageFormat?: string } | null): string {
  if (isIOSApp(app)) {
    return 'Verifying iOS package...';
  }
  if (isMacApp(app)) {
    return 'Verifying macOS package...';
  }
  if (isLinuxApp(app)) {
    return 'Verifying Linux package...';
  }
  if (isWindowsApp(app)) {
    return 'Verifying Windows package...';
  }
  return 'Verifying APK...';
}

/**
 * Returns dynamic compatibility notice or badge text for the app header.
 */
export function getPlatformCompatibilityNotice(app?: { platform?: string; assetName?: string; targetOs?: string; minAndroid?: string; minLinux?: string } | null): {
  isCompatible: boolean;
  clientOS: string;
  targetPlatform: string;
  noticeText: string;
} {
  const osInfo = getClientOSInfo();
  const isIOS = isIOSApp(app);
  const isMac = !isIOS && isMacApp(app);
  const isWinApp = isWindowsApp(app);
  const isLinApp = isLinuxApp(app);
  const targetPlatform = isIOS ? 'iOS' : isMac ? 'macOS' : isLinApp ? 'Linux' : isWinApp ? 'Windows' : 'Android';

  let isCompatible = true;
  let noticeText = '';

  if (osInfo.isIOS) {
    if (isIOS) {
      isCompatible = true;
      noticeText = `Compatible with your iOS device (${app?.targetOs || 'iOS 15.0 or later'})`;
    } else if (isMac) {
      isCompatible = false;
      noticeText = 'Apple macOS application (Requires Mac with Apple Silicon or Intel CPU)';
    } else if (isWinApp) {
      isCompatible = false;
      noticeText = 'Windows PC executable (Requires Windows PC to run)';
    } else if (isLinApp) {
      isCompatible = false;
      noticeText = 'Linux package (Requires Linux environment to run)';
    } else {
      isCompatible = false;
      noticeText = 'Android APK package (Requires Android device to run)';
    }
  } else if (osInfo.isMacOS) {
    if (isMac) {
      isCompatible = true;
      noticeText = `Compatible with your Mac (${app?.targetOs || 'macOS 12.0 Monterey or later'})`;
    } else if (isIOS) {
      isCompatible = false;
      noticeText = 'iOS application package (Requires iPhone, iPad, or AltStore/SideStore)';
    } else if (isWinApp) {
      isCompatible = false;
      noticeText = 'Windows PC executable (Requires CrossOver, Parallels, or Windows PC)';
    } else if (isLinApp) {
      isCompatible = false;
      noticeText = 'Linux package (Requires Linux container or virtual machine)';
    } else {
      isCompatible = false;
      noticeText = 'Android APK package (Requires Android emulator or side-loader)';
    }
  } else if (osInfo.isLinux) {
    if (isLinApp) {
      isCompatible = true;
      noticeText = `Compatible with your Linux system (${app?.targetOs || 'Debian / Ubuntu / Arch / Fedora'})`;
    } else if (isIOS) {
      isCompatible = false;
      noticeText = 'iOS application package (Requires iPhone, iPad, or AltStore/SideStore)';
    } else if (isMac) {
      isCompatible = false;
      noticeText = 'Apple macOS application (Requires Mac with Apple Silicon or Intel CPU)';
    } else if (isWinApp) {
      isCompatible = false;
      noticeText = 'Windows PC executable (Requires WINE or Windows environment)';
    } else {
      isCompatible = false;
      noticeText = 'Android APK package (Requires Android emulator or Waydroid)';
    }
  } else if (osInfo.isWindows) {
    if (isLinApp) {
      isCompatible = false;
      noticeText = 'Linux package (Requires WSL or Linux environment)';
    } else if (isIOS) {
      isCompatible = false;
      noticeText = 'iOS application package (Requires iPhone, iPad, or AltStore/SideStore)';
    } else if (isMac) {
      isCompatible = false;
      noticeText = 'Apple macOS application (Requires Mac with Apple Silicon or Intel CPU)';
    } else if (!isWinApp) {
      isCompatible = false;
      noticeText = 'Android APK package (Requires Android device or emulator to run)';
    } else {
      isCompatible = true;
      noticeText = `Compatible with your ${osInfo.osName} device (${app?.targetOs || 'Windows 10, 11'})`;
    }
  } else if (osInfo.isAndroid) {
    if (isIOS) {
      isCompatible = false;
      noticeText = 'iOS application package (Requires iPhone, iPad, or iOS device)';
    } else if (isMac) {
      isCompatible = false;
      noticeText = 'Apple macOS application (Requires a Mac to run)';
    } else if (isLinApp) {
      isCompatible = false;
      noticeText = 'Linux package (Requires a Linux system to run)';
    } else if (isWinApp) {
      isCompatible = false;
      noticeText = 'Windows PC executable (Requires a Windows PC to run)';
    } else {
      isCompatible = true;
      noticeText = `Compatible with your ${osInfo.osName} device (${app?.minAndroid || 'Android 8.0+'})`;
    }
  } else {
    noticeText = isIOS ? 'iOS Application' : isMac ? 'macOS Application' : isLinApp ? 'Linux Application' : isWinApp ? 'Windows Application' : 'Android Application';
  }

  return {
    isCompatible,
    clientOS: osInfo.osName,
    targetPlatform,
    noticeText,
  };
}

/**
 * Checks whether an app is runnable on a given target OS (or detected client OS).
 * Web apps and PWAs are universal and run on all platforms.
 */
export function isAppCompatibleWithClient(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string; type?: string } | null,
  clientOS?: ClientOS
): boolean {
  if (!app) return false;
  const currentOS = clientOS || detectClientOS();

  // Universal Web / PWA apps run on any modern operating system
  if (
    app.type === 'webapp' || 
    app.platform === 'web' || 
    app.platform === 'multiplatform' || 
    app.packageFormat === 'web' || 
    app.packageFormat === 'pwa'
  ) {
    return true;
  }

  if (currentOS === 'ios') {
    return isIOSApp(app);
  }
  if (currentOS === 'macos') {
    return isMacApp(app);
  }
  if (currentOS === 'android') {
    return isAndroidApp(app);
  }
  if (currentOS === 'windows') {
    return isWindowsApp(app);
  }
  if (currentOS === 'linux') {
    return isLinuxApp(app);
  }

  // Fallback for other: allow web apps and native if unspecified
  return !isWindowsApp(app) && !isLinuxApp(app);
}

/**
 * Computes an integer compatibility score for device-aware sorting.
 * 100 = Native match (e.g. Android APK on Android, iOS IPA on iOS, macOS DMG on Mac)
 * 85  = Universal Web/PWA
 * 20  = Cross-platform package for other system
 */
export function getAppDeviceCompatibilityScore(
  app?: { platform?: string; assetName?: string; packageFormat?: string; downloadUrl?: string; type?: string } | null,
  clientOS?: ClientOS
): number {
  if (!app) return 0;
  const currentOS = clientOS || detectClientOS();

  const isIOS = isIOSApp(app);
  const isMac = !isIOS && isMacApp(app);
  const isWin = isWindowsApp(app);
  const isLin = isLinuxApp(app);
  const isAnd = isAndroidApp(app);
  const isWeb = app.type === 'webapp' || app.platform === 'web' || app.platform === 'multiplatform' || app.packageFormat === 'web' || app.packageFormat === 'pwa';

  if (currentOS === 'ios') {
    if (isIOS) return 100;
    if (isWeb) return 85;
    return 10;
  }

  if (currentOS === 'macos') {
    if (isMac) return 100;
    if (isWeb) return 85;
    return 10;
  }

  if (currentOS === 'android') {
    if (isAnd) return 100;
    if (isWeb) return 85;
    return 10; // Windows exe or Linux deb on Android
  }

  if (currentOS === 'windows') {
    if (isWin) return 100;
    if (isWeb) return 85;
    return 10; // Android apk or Linux deb on Windows
  }

  if (currentOS === 'linux') {
    if (isLin) return 100;
    if (isWeb) return 85;
    return 10; // Windows exe or Android apk on Linux
  }

  return isWeb ? 85 : 50;
}

/**
 * Sorts or partitions apps so that apps compatible with the user's current device appear first,
 * preventing mobile Android users from being flooded with Windows .exe or Linux packages.
 */
export function sortAppsByDeviceCompatibility<T = any>(
  apps: T[],
  clientOS?: ClientOS
): T[] {
  if (!Array.isArray(apps) || apps.length <= 1) return apps;
  const targetOS = clientOS || detectClientOS();

  return [...apps].sort((a, b) => {
    const scoreA = getAppDeviceCompatibilityScore(a as any, targetOS);
    const scoreB = getAppDeviceCompatibilityScore(b as any, targetOS);
    return scoreB - scoreA;
  });
}
