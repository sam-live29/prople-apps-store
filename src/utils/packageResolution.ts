/**
 * Package Resolution Utility
 * 
 * Provides strict platform-specific asset selection, bloat package filtering,
 * and format detection for Android, Linux, Mac, and Windows.
 */

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size?: number;
  browser_download_url?: string;
}

/**
 * Identifies bloat, secondary, checksum, or non-runnable artifacts in GitHub release assets.
 * Filters out debug symbols, source code archives, checksums, signatures, dev headers,
 * and .aar developer libraries (which are Android Archive libraries, NOT installable apps).
 */
export function isBloatOrSecondaryAsset(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.toLowerCase().trim();

  // Checksums, signatures, certificates
  if (
    lower.endsWith('.sha256') ||
    lower.endsWith('.sha512') ||
    lower.endsWith('.sha1') ||
    lower.endsWith('.md5') ||
    lower.endsWith('.asc') ||
    lower.endsWith('.sig') ||
    lower.endsWith('.cert') ||
    lower.endsWith('.crt') ||
    lower.endsWith('.pem')
  ) {
    return true;
  }

  // Documents and metadata
  if (
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.pom') ||
    lower.endsWith('.json') ||
    lower.endsWith('.xml')
  ) {
    return true;
  }

  // Android Archive (AAR) is a Gradle developer library, NEVER an end-user installable app
  if (lower.endsWith('.aar')) {
    return true;
  }

  // Source code archives
  if (
    lower.endsWith('-sources.jar') ||
    lower.endsWith('-javadoc.jar') ||
    lower.endsWith('-source.zip') ||
    lower.endsWith('-sources.zip') ||
    lower.endsWith('-src.zip') ||
    lower.endsWith('-src.tar.gz') ||
    lower.includes('source code') ||
    lower.includes('source-code') ||
    lower === 'source.zip' ||
    lower === 'source.tar.gz'
  ) {
    return true;
  }

  // Debug symbols, developer headers, and debug build packages
  if (
    lower.includes('-debug-symbols') ||
    lower.includes('-symbols.zip') ||
    lower.includes('-pdb.zip') ||
    lower.includes('-dbg.deb') ||
    lower.includes('-dbgsym') ||
    lower.includes('-devel.rpm') ||
    lower.includes('-dev.deb') ||
    lower.includes('-headers.tar') ||
    lower.includes('-unaligned.apk')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a given filename or URL represents an executable binary package.
 */
export function isBinaryPackage(filenameOrUrl: string): boolean {
  if (!filenameOrUrl) return false;
  const clean = filenameOrUrl.split('?')[0].toLowerCase();
  const name = clean.split('/').pop() || '';

  // Reject bloat packages immediately
  if (isBloatOrSecondaryAsset(name)) return false;

  return (
    name.endsWith('.apk') ||
    name.endsWith('.aab') ||
    name.endsWith('.exe') ||
    name.endsWith('.msi') ||
    name.endsWith('.msix') ||
    name.endsWith('.msixbundle') ||
    name.endsWith('.appx') ||
    name.endsWith('.appxbundle') ||
    name.endsWith('.appimage') ||
    name.endsWith('.deb') ||
    name.endsWith('.rpm') ||
    name.endsWith('.tar.gz') ||
    name.endsWith('.tgz') ||
    name.endsWith('.tar.xz') ||
    name.endsWith('.txz') ||
    name.endsWith('.tar.bz2') ||
    name.endsWith('.tbz2') ||
    name.endsWith('.tar.zst') ||
    name.endsWith('.tzst') ||
    name.endsWith('.pkg.tar.zst') ||
    name.endsWith('.pkg.tar.xz') ||
    name.endsWith('.7z') ||
    name.endsWith('.zip') ||
    name.endsWith('.rar') ||
    name.endsWith('.snap') ||
    name.endsWith('.flatpak') ||
    name.endsWith('.flatpakref') ||
    name.endsWith('.run') ||
    name.endsWith('.dmg') ||
    name.endsWith('.pkg') ||
    name.endsWith('.ipa') ||
    name.endsWith('.jar') ||
    ((name.includes('linux') || name.includes('amd64') || name.includes('x86_64') || name.includes('arm64')) && !name.includes('.'))
  );
}

/**
 * Resolves the primary/main application package from release assets based on target platform.
 * Strictly guarantees:
 * - Linux apps receive .AppImage, .deb, .rpm, or Linux tarball (NEVER .apk or .aar)
 * - Windows apps receive .exe, .msi, or Windows zip (NEVER .apk or .aar)
 * - Android apps receive .apk (NEVER .aar or Linux/Windows binaries)
 * - Bloat and non-runnable artifacts are filtered out
 */
export function selectMainPackageAsset(
  rawAssets: any[],
  platform?: 'android' | 'linux' | 'windows' | 'mac' | string
): { name: string; downloadUrl: string; size: number } | null {
  if (!Array.isArray(rawAssets) || rawAssets.length === 0) return null;

  // 1. Filter out malformed items
  const validAssets = rawAssets.filter(a => {
    if (!a || typeof a !== 'object') return false;
    const name = a.name || '';
    const url = a.browser_download_url || a.downloadUrl || '';
    return typeof name === 'string' && name.trim().length > 0 && typeof url === 'string' && url.trim().length > 0;
  });

  if (validAssets.length === 0) return null;

  // 2. Filter out bloat assets and packages under 1 MB
  const nonBloat = validAssets.filter(a => !isBloatOrSecondaryAsset(a.name) && !(typeof a.size === 'number' && a.size > 0 && a.size < 1024 * 1024));
  const pool = nonBloat.length > 0 ? nonBloat : validAssets.filter(a => !isBloatOrSecondaryAsset(a.name));

  const targetPlat = (platform || '').toLowerCase().trim();

  // --- LINUX SELECTION ---
  if (targetPlat === 'linux') {
    // 1. AppImage (Standalone portable binary for all Linux distros)
    const appImage = pool.find(a => a.name.toLowerCase().endsWith('.appimage'));
    if (appImage) return { name: appImage.name, downloadUrl: appImage.browser_download_url || appImage.downloadUrl, size: appImage.size || 0 };

    // 2. Debian / Ubuntu package (.deb)
    const deb = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.deb') && !n.includes('-dev') && !n.includes('-dbg');
    });
    if (deb) return { name: deb.name, downloadUrl: deb.browser_download_url || deb.downloadUrl, size: deb.size || 0 };

    // 3. RedHat / Fedora package (.rpm)
    const rpm = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.rpm') && !n.includes('-devel') && !n.includes('-src');
    });
    if (rpm) return { name: rpm.name, downloadUrl: rpm.browser_download_url || rpm.downloadUrl, size: rpm.size || 0 };

    // 4. Linux compiled tarball (.tar.gz, .tgz, .tar.xz) with linux or arch in name
    const linuxTar = pool.find(a => {
      const n = a.name.toLowerCase();
      return (n.endsWith('.tar.gz') || n.endsWith('.tgz') || n.endsWith('.tar.xz')) &&
             (n.includes('linux') || n.includes('amd64') || n.includes('x86_64') || n.includes('x64'));
    });
    if (linuxTar) return { name: linuxTar.name, downloadUrl: linuxTar.browser_download_url || linuxTar.downloadUrl, size: linuxTar.size || 0 };

    // 5. Standalone Linux binary (e.g. TeleGhost-linux-amd64)
    const linuxBin = pool.find(a => {
      const n = a.name.toLowerCase();
      return (n.includes('linux') || n.includes('amd64') || n.includes('x86_64')) &&
             !n.endsWith('.exe') && !n.endsWith('.apk') && !n.endsWith('.aar') && !n.endsWith('.msi') && !n.endsWith('.zip');
    });
    if (linuxBin) return { name: linuxBin.name, downloadUrl: linuxBin.browser_download_url || linuxBin.downloadUrl, size: linuxBin.size || 0 };

    // 6. Generic tar.gz if explicitly packaged for Linux
    const genericTar = pool.find(a => {
      const n = a.name.toLowerCase();
      return (n.endsWith('.tar.gz') || n.endsWith('.tgz')) && (n.includes('linux') || n.includes('amd64') || n.includes('x86_64'));
    });
    if (genericTar) return { name: genericTar.name, downloadUrl: genericTar.browser_download_url || genericTar.downloadUrl, size: genericTar.size || 0 };

    // Strict zero-fallback: Never return Windows, Mac, or other OS binaries when Linux is requested
    return null;
  }

  // --- WINDOWS SELECTION ---
  if (targetPlat === 'windows') {
    // 1. Windows Installer Setup (.exe)
    const setupExe = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.exe') && (n.includes('setup') || n.includes('installer') || n.includes('win64') || n.includes('x64'));
    });
    if (setupExe) return { name: setupExe.name, downloadUrl: setupExe.browser_download_url || setupExe.downloadUrl, size: setupExe.size || 0 };

    // 2. Any Windows .exe
    const anyExe = pool.find(a => a.name.toLowerCase().endsWith('.exe'));
    if (anyExe) return { name: anyExe.name, downloadUrl: anyExe.browser_download_url || anyExe.downloadUrl, size: anyExe.size || 0 };

    // 3. Windows MSI / MSIX / AppX Installer
    const msi = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.msi') || n.endsWith('.msix') || n.endsWith('.msixbundle') || n.endsWith('.appx') || n.endsWith('.appxbundle');
    });
    if (msi) return { name: msi.name, downloadUrl: msi.browser_download_url || msi.downloadUrl, size: msi.size || 0 };

    // 4. Windows Portable 7z / ZIP / RAR (explicitly for Windows)
    const winArchive = pool.find(a => {
      const n = a.name.toLowerCase();
      const isArch = n.endsWith('.7z') || n.endsWith('.zip') || n.endsWith('.rar');
      const isWinTarget = n.includes('win') || n.includes('windows') || n.includes('portable') || n.includes('x64') || n.includes('x86') || n.includes('amd64');
      return isArch && isWinTarget && !n.includes('linux') && !n.includes('mac') && !n.includes('darwin');
    });
    if (winArchive) return { name: winArchive.name, downloadUrl: winArchive.browser_download_url || winArchive.downloadUrl, size: winArchive.size || 0 };

    // Strict zero-fallback: Never return Linux, Mac, or other OS binaries when Windows is requested
    return null;
  }

  // --- MAC / MACOS SELECTION ---
  if (targetPlat === 'mac' || targetPlat === 'macos' || targetPlat === 'darwin') {
    // 1. Apple Disk Image (.dmg) - Universal or ARM64 or x64
    const universalDmg = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.dmg') && (n.includes('universal') || n.includes('arm64') || n.includes('aarch64') || n.includes('apple') || !n.includes('x86'));
    });
    if (universalDmg) return { name: universalDmg.name, downloadUrl: universalDmg.browser_download_url || universalDmg.downloadUrl, size: universalDmg.size || 0 };

    // 2. Any Apple Disk Image (.dmg)
    const anyDmg = pool.find(a => a.name.toLowerCase().endsWith('.dmg'));
    if (anyDmg) return { name: anyDmg.name, downloadUrl: anyDmg.browser_download_url || anyDmg.downloadUrl, size: anyDmg.size || 0 };

    // 3. Apple Installer Package (.pkg)
    const pkg = pool.find(a => a.name.toLowerCase().endsWith('.pkg'));
    if (pkg) return { name: pkg.name, downloadUrl: pkg.browser_download_url || pkg.downloadUrl, size: pkg.size || 0 };

    // 4. macOS Standalone ZIP (.app.zip, mac.zip, darwin.zip)
    const macZip = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.zip') && (n.includes('mac') || n.includes('darwin') || n.includes('osx') || n.includes('apple')) && !n.includes('linux') && !n.includes('win');
    });
    if (macZip) return { name: macZip.name, downloadUrl: macZip.browser_download_url || macZip.downloadUrl, size: macZip.size || 0 };

    // 5. macOS Tarball
    const macTar = pool.find(a => {
      const n = a.name.toLowerCase();
      return (n.endsWith('.tar.gz') || n.endsWith('.tgz')) && (n.includes('mac') || n.includes('darwin') || n.includes('osx'));
    });
    if (macTar) return { name: macTar.name, downloadUrl: macTar.browser_download_url || macTar.downloadUrl, size: macTar.size || 0 };

    // Strict zero-fallback: Never return Linux, Windows, or other OS binaries when Mac is requested
    return null;
  }

  // --- ANDROID SELECTION ---
  if (targetPlat === 'android') {
    // 1. Preferred Release/Universal APK
    const releaseApk = pool.find(a => {
      const n = a.name.toLowerCase();
      return n.endsWith('.apk') && (n.includes('release') || n.includes('universal') || n.includes('arm64') || !n.includes('debug'));
    });
    if (releaseApk) return { name: releaseApk.name, downloadUrl: releaseApk.browser_download_url || releaseApk.downloadUrl, size: releaseApk.size || 0 };

    // 2. Any APK
    const anyApk = pool.find(a => a.name.toLowerCase().endsWith('.apk'));
    if (anyApk) return { name: anyApk.name, downloadUrl: anyApk.browser_download_url || anyApk.downloadUrl, size: anyApk.size || 0 };

    // 3. Android App Bundle (.aab)
    const aab = pool.find(a => a.name.toLowerCase().endsWith('.aab'));
    if (aab) return { name: aab.name, downloadUrl: aab.browser_download_url || aab.downloadUrl, size: aab.size || 0 };

    // Strict zero-fallback: Never return Linux, Windows, or Mac binaries when Android APK is requested
    return null;
  }

  // --- IOS SELECTION ---
  if (targetPlat === 'ios' || targetPlat === 'iphone' || targetPlat === 'ipad') {
    // 1. Preferred iOS package (.ipa)
    const ipa = pool.find(a => a.name.toLowerCase().endsWith('.ipa'));
    if (ipa) return { name: ipa.name, downloadUrl: ipa.browser_download_url || ipa.downloadUrl, size: ipa.size || 0 };

    // Strict zero-fallback: Never return Android, Linux, or Windows binaries when iOS is requested
    return null;
  }

  // --- AUTO-DETECT / DEFAULT SELECTION ---
  // When platform is not specified, prioritize release APK, iOS IPA, Linux AppImage/DEB/RPM, Windows EXE/MSI, macOS DMG/PKG
  const priorityOrder = [
    // Android Release APK
    (a: any) => a.name.toLowerCase().endsWith('.apk') && !a.name.toLowerCase().includes('debug'),
    // iOS App Package (.ipa)
    (a: any) => a.name.toLowerCase().endsWith('.ipa'),
    // Linux AppImage
    (a: any) => a.name.toLowerCase().endsWith('.appimage'),
    // Debian Package
    (a: any) => a.name.toLowerCase().endsWith('.deb') && !a.name.toLowerCase().includes('-dev'),
    // RedHat RPM
    (a: any) => a.name.toLowerCase().endsWith('.rpm') && !a.name.toLowerCase().includes('-devel'),
    // Linux Tarball
    (a: any) => (a.name.toLowerCase().endsWith('.tar.gz') || a.name.toLowerCase().endsWith('.tgz') || a.name.toLowerCase().endsWith('.tar.xz')) && a.name.toLowerCase().includes('linux'),
    // Windows Setup EXE
    (a: any) => a.name.toLowerCase().endsWith('.exe') && (a.name.toLowerCase().includes('setup') || a.name.toLowerCase().includes('installer')),
    // Apple Disk Image DMG
    (a: any) => a.name.toLowerCase().endsWith('.dmg'),
    // Apple Installer PKG
    (a: any) => a.name.toLowerCase().endsWith('.pkg'),
    // General Windows EXE
    (a: any) => a.name.toLowerCase().endsWith('.exe'),
    // Windows MSI
    (a: any) => a.name.toLowerCase().endsWith('.msi') || a.name.toLowerCase().endsWith('.msix'),
    // Any APK
    (a: any) => a.name.toLowerCase().endsWith('.apk'),
    // Portable ZIP
    (a: any) => a.name.toLowerCase().endsWith('.zip') && !a.name.toLowerCase().includes('source')
  ];

  for (const matchFn of priorityOrder) {
    const matched = pool.find(matchFn);
    if (matched) {
      return {
        name: matched.name,
        downloadUrl: matched.browser_download_url || matched.downloadUrl,
        size: matched.size || 0
      };
    }
  }

  // Default to first non-bloat asset ONLY if it is a verified executable binary package
  const first = pool[0];
  if (first && isBinaryPackage(first.name)) {
    return {
      name: first.name,
      downloadUrl: first.browser_download_url || first.downloadUrl,
      size: first.size || 0
    };
  }

  // ZERO FALLBACK: Never return non-binary files (docs, scripts, html, licenses) as packages
  return null;
}
