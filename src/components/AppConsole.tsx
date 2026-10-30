import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, 
  ArrowLeft,
  Plus, 
  Download, 
  UploadCloud, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Layers, 
  Package, 
  Trash2, 
  Eye, 
  Edit3, 
  FileEdit,
  ArrowRight,
  RefreshCw,
  Clock,
  HardDrive,
  Share2,
  FileCode,
  Tag,
  Search,
  X,
  MoreVertical,
  Copy,
  Mail,
  FileText,
  Lock,
  LogIn,
  Image as ImageIcon,
  Check,
  Info,
  EyeOff,
  Zap,
  KeyRound,
  Shield,
  LayoutTemplate,
  Send,
  ChevronDown,
  Gamepad2,
  ShoppingCart,
  PenTool,
  Car,
  Flower2,
  Book,
  Briefcase,
  MessageSquare,
  GraduationCap,
  Clapperboard,
  Wrench,
  FileCheck,
  Award,
  Sparkles,
  GitBranch,
  Github,
  Loader2,
  UserCheck,
  UserPlus,
  Camera,
  MapPin,
  Mic,
  Phone,
  HelpCircle,
  Activity,
  Megaphone
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useInstall, getDirectDownloadUrl, triggerBrowserApkDownload, isBinaryFileName } from '../context/InstallContext';
import { useAuth, isDeveloperEmail, isAdminEmail } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { appDetailsMock, searchSuggestedApps, appCategories } from '../data';
import { AppDetails, GitHubReleaseAsset, SafetyHighlight, AppPermissionGroup } from '../types';
import { extractPermissionGroups, parseBulletPoints, flattenPermissionGroups } from '../utils/permissionUtils';
import { getSafetyHighlightIcon } from '../utils/safetyIcons';
import { doesAppMatchCategory, parseAppTimestampMs } from '../utils/productionFeedAlgorithm';
import StoreCircleLoader from './StoreCircleLoader';
import ConfirmationDialog from './ConfirmationDialog';
import BrandLogo from './BrandLogo';
import TermsPage from './TermsPage';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import { DeveloperDonationModal } from './DeveloperDonationModal';
import { PermissionGroundInput } from './PermissionGroundInput';
import { 
  PlayStoreCameraIcon, 
  PlayStoreLocationIcon, 
  PlayStoreMicrophoneIcon, 
  PlayStoreTelephoneIcon, 
  PlayStoreStorageIcon, 
  PlayStoreOtherIcon,
  getPlayStorePermissionIcon
} from './PlayStorePermissionIcons';
import { AdminModerationService } from '../services/adminModerationService';
import { fetchGitHubReleaseMetadata, formatPackageSize, formatDownloadCount, parseDownloadCount, extractGitHubRepoOwner } from '../utils/appMetricsAlgorithm';
import { extractYouTubeId } from '../utils/mediaUtils';
import { auth } from '../firebase';
import { getPublishQuotaStatus, recordPublishEvent, getUpdateQuotaStatus, recordUpdateEvent } from '../services/publishQuotaService';
import { usePreserveScroll } from '../services/scrollManager';
import AppMediaUploader from './MediaUpload/AppMediaUploader';
import { safeFetchJson } from '../utils/safeFetch';
import PackageFormatIcon from './PackageFormatIcon';
import { checkPublisherNameAvailability, claimPublisherName } from '../services/publisherNameService';
import { computeDeterministicSha256, extractSha256FromText } from '../utils/securityUtils';

export function inferPlatformAndFormat(urlOrFilename: string): {
  platform: 'android' | 'windows' | 'linux' | 'mac' | 'ios';
  packageFormat: 'apk' | 'aar' | 'aab' | 'exe' | 'msi' | 'zip' | '7z' | 'rar' | 'msix' | 'appx' | 'deb' | 'AppImage' | 'rpm' | 'tar.gz' | 'tar.xz' | 'tar.zst' | 'snap' | 'flatpak' | 'bin' | 'run' | 'dmg' | 'pkg' | 'jar' | 'ipa';
  targetOs: string;
  minRequirement: string;
} {
  const clean = (urlOrFilename || '').trim();
  const lower = clean.split('?')[0].toLowerCase();
  const fileName = lower.split('/').pop() || '';

  // 0. iOS packages (.ipa) or iOS keywords
  if (
    fileName.endsWith('.ipa') ||
    lower.includes('ios_arm64') ||
    lower.includes('ios-arm64') ||
    lower.includes('-ios.') ||
    lower.includes('_ios.') ||
    lower.includes('.ios.')
  ) {
    return {
      platform: 'ios',
      packageFormat: 'ipa',
      targetOs: 'iOS 14.0 or later',
      minRequirement: 'iOS 14.0 or later'
    };
  }

  // 1. Keyword analysis across full path and file name
  const isWinKeyword = (
    lower.includes('windows') ||
    lower.includes('_win_') ||
    lower.includes('-win_') ||
    lower.includes('_win-') ||
    lower.includes('-win-') ||
    lower.includes('_win.') ||
    lower.includes('-win.') ||
    lower.includes('.win.') ||
    lower.includes('.win') ||
    lower.includes('win_x64') ||
    lower.includes('win-x64') ||
    lower.includes('win_x86') ||
    lower.includes('win-x86') ||
    lower.includes('win_arm64') ||
    lower.includes('win-arm64') ||
    lower.includes('win32') ||
    lower.includes('win64') ||
    lower.includes('pc-windows') ||
    lower.includes('win-portable')
  );

  const isLinuxKeyword = (
    lower.includes('linux') ||
    lower.includes('ubuntu') ||
    lower.includes('debian') ||
    lower.includes('fedora') ||
    lower.includes('archlinux') ||
    lower.includes('appimage') ||
    lower.includes('flatpak') ||
    lower.includes('snapcraft')
  );

  const isMacKeyword = (
    (lower.includes('darwin') || lower.includes('macos') || lower.includes('osx') || lower.includes('apple-silicon')) &&
    !isLinuxKeyword
  );

  const isIOSKeyword = (
    (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad') || lower.includes('ipados')) &&
    !isLinuxKeyword && !isMacKeyword && !isWinKeyword
  );

  // 2. Android packages (.apk, .aar, .aab)
  if (fileName.endsWith('.apk') || fileName.endsWith('.aar') || fileName.endsWith('.aab')) {
    const fmt = fileName.endsWith('.aar') ? 'aar' : fileName.endsWith('.aab') ? 'aab' : 'apk';
    return {
      platform: 'android',
      packageFormat: fmt as any,
      targetOs: 'Android 8.0 and up',
      minRequirement: 'Android 8.0 and up'
    };
  }

  // 3. macOS packages (.dmg, .pkg, .app.zip) - strictly when NOT Arch Linux .pkg.tar...
  if (
    (fileName.endsWith('.dmg') || (fileName.endsWith('.pkg') && !fileName.includes('.pkg.tar.')) || fileName.endsWith('.app.zip')) ||
    (isMacKeyword && (fileName.endsWith('.zip') || fileName.endsWith('.7z') || fileName.endsWith('.tar.gz')))
  ) {
    const fmt = fileName.endsWith('.pkg') ? 'pkg' : 'dmg';
    return {
      platform: 'mac',
      packageFormat: fmt as any,
      targetOs: 'macOS 12.0 Monterey or later',
      minRequirement: 'macOS 12.0 Monterey or later'
    };
  }

  // 4. Windows native installer executables (.exe, .msi, .msix, .appx, .msixbundle, .appxbundle)
  if (
    fileName.endsWith('.exe') ||
    fileName.endsWith('.msi') ||
    fileName.endsWith('.msix') ||
    fileName.endsWith('.msixbundle') ||
    fileName.endsWith('.appx') ||
    fileName.endsWith('.appxbundle')
  ) {
    const fmt = fileName.endsWith('.msi') ? 'msi' : (fileName.endsWith('.msix') || fileName.endsWith('.msixbundle')) ? 'msix' : (fileName.endsWith('.appx') || fileName.endsWith('.appxbundle')) ? 'appx' : 'exe';
    return {
      platform: 'windows',
      packageFormat: fmt as any,
      targetOs: 'Windows 10, 11 (64-bit)',
      minRequirement: 'Windows 10, 11 (64-bit)'
    };
  }

  // 5. Linux packages (.deb, .appimage, .rpm, tarballs, .snap, .flatpak, standalone linux binaries)
  if (
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
    fileName.endsWith('.flatpak') ||
    fileName.endsWith('.flatpakref') ||
    fileName.endsWith('.run') ||
    (isLinuxKeyword && (fileName.endsWith('.zip') || fileName.endsWith('.7z'))) ||
    ((fileName.includes('amd64') || fileName.includes('x86_64') || fileName.includes('arm64') || fileName.includes('aarch64')) &&
      !isWinKeyword && !fileName.endsWith('.exe') && !fileName.endsWith('.msi') && !fileName.endsWith('.apk') && !fileName.endsWith('.dmg') && !fileName.endsWith('.pkg'))
  ) {
    let fmt: any = 'bin';
    if (fileName.endsWith('.deb')) fmt = 'deb';
    else if (fileName.endsWith('.rpm')) fmt = 'rpm';
    else if (fileName.endsWith('.appimage')) fmt = 'AppImage';
    else if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')) fmt = 'tar.gz';
    else if (fileName.endsWith('.tar.xz') || fileName.endsWith('.txz')) fmt = 'tar.xz';
    else if (fileName.endsWith('.tar.zst') || fileName.endsWith('.tzst') || fileName.endsWith('.pkg.tar.zst')) fmt = 'tar.zst';
    else if (fileName.endsWith('.snap')) fmt = 'snap';
    else if (fileName.endsWith('.flatpak') || fileName.endsWith('.flatpakref')) fmt = 'flatpak';
    else if (fileName.endsWith('.run')) fmt = 'run';
    else if (fileName.endsWith('.7z')) fmt = '7z';
    else if (fileName.endsWith('.zip')) fmt = 'zip';

    return {
      platform: 'linux',
      packageFormat: fmt,
      targetOs: 'Linux (Debian, Ubuntu, Fedora, Arch)',
      minRequirement: 'Linux (Debian, Ubuntu, Fedora, Arch)'
    };
  }

  // 6. 7-Zip Archive (.7z) - specifically handles Steam++_v3.1.0_win_x64.7z and any Windows or general .7z
  if (fileName.endsWith('.7z')) {
    if (isLinuxKeyword) {
      return {
        platform: 'linux',
        packageFormat: '7z',
        targetOs: 'Linux (Debian, Ubuntu, Fedora, Arch)',
        minRequirement: 'Linux (Debian, Ubuntu, Fedora, Arch)'
      };
    }
    if (isMacKeyword) {
      return {
        platform: 'mac',
        packageFormat: '7z',
        targetOs: 'macOS 12.0 Monterey or later',
        minRequirement: 'macOS 12.0 Monterey or later'
      };
    }
    // Windows / Desktop portable 7z
    return {
      platform: 'windows',
      packageFormat: '7z',
      targetOs: 'Windows 10, 11 (64-bit)',
      minRequirement: 'Windows 10, 11 (64-bit)'
    };
  }

  // 7. WinRAR Archive (.rar)
  if (fileName.endsWith('.rar')) {
    return {
      platform: 'windows',
      packageFormat: 'rar',
      targetOs: 'Windows 10, 11 (64-bit)',
      minRequirement: 'Windows 10, 11 (64-bit)'
    };
  }

  // 8. ZIP archive
  if (fileName.endsWith('.zip')) {
    if (isLinuxKeyword) {
      return {
        platform: 'linux',
        packageFormat: 'zip',
        targetOs: 'Linux (Debian, Ubuntu, Fedora, Arch)',
        minRequirement: 'Linux (Debian, Ubuntu, Fedora, Arch)'
      };
    }
    if (isMacKeyword) {
      return {
        platform: 'mac',
        packageFormat: 'zip',
        targetOs: 'macOS 12.0 Monterey or later',
        minRequirement: 'macOS 12.0 Monterey or later'
      };
    }
    return {
      platform: 'windows',
      packageFormat: 'zip',
      targetOs: 'Windows 10, 11 (64-bit)',
      minRequirement: 'Windows 10, 11 (64-bit)'
    };
  }

  // 9. Java Runnable (.jar)
  if (fileName.endsWith('.jar')) {
    return {
      platform: 'windows',
      packageFormat: 'jar',
      targetOs: 'Cross-platform Java JRE 17+',
      minRequirement: 'Java Runtime Environment (JRE) 17+'
    };
  }

  // 10. Keyword fallback if no matched extension
  if (isWinKeyword) {
    return {
      platform: 'windows',
      packageFormat: 'exe',
      targetOs: 'Windows 10, 11 (64-bit)',
      minRequirement: 'Windows 10, 11 (64-bit)'
    };
  }
  if (isLinuxKeyword) {
    return {
      platform: 'linux',
      packageFormat: 'AppImage',
      targetOs: 'Linux (Debian, Ubuntu, Fedora, Arch)',
      minRequirement: 'Linux (Debian, Ubuntu, Fedora, Arch)'
    };
  }
  if (isMacKeyword) {
    return {
      platform: 'mac',
      packageFormat: 'dmg',
      targetOs: 'macOS 12.0 Monterey or later',
      minRequirement: 'macOS 12.0 Monterey or later'
    };
  }
  if (isIOSKeyword) {
    return {
      platform: 'ios',
      packageFormat: 'ipa',
      targetOs: 'iOS 14.0 or later',
      minRequirement: 'iOS 14.0 or later'
    };
  }

  // 11. Final fallback for Android if explicitly android keyword or default
  return {
    platform: 'android',
    packageFormat: 'apk',
    targetOs: 'Android 8.0 and up',
    minRequirement: 'Android 8.0 and up'
  };
}

export function formatPackageTypeName(
  format?: string,
  platform?: string,
  assetNameOrUrl?: string
): string {
  const cleanName = (assetNameOrUrl || '').toLowerCase().split('?')[0];
  const rawFormat = (format || '').toLowerCase().trim();

  if (rawFormat === 'ipa' || cleanName.endsWith('.ipa') || platform === 'ios') return 'iOS IPA Package';
  if (rawFormat === 'apk' || cleanName.endsWith('.apk')) return 'Android APK';
  if (rawFormat === 'aar' || cleanName.endsWith('.aar')) return 'Android AAR Library';
  if (rawFormat === 'aab' || cleanName.endsWith('.aab')) return 'Android App Bundle (AAB)';
  if (rawFormat === 'exe' || cleanName.endsWith('.exe')) return 'Windows Executable (.exe)';
  if (rawFormat === 'msi' || cleanName.endsWith('.msi')) return 'Windows MSI Installer';
  if (rawFormat === 'msix' || cleanName.endsWith('.msix') || cleanName.endsWith('.msixbundle')) return 'Windows MSIX Package';
  if (rawFormat === 'appx' || cleanName.endsWith('.appx') || cleanName.endsWith('.appxbundle')) return 'Windows AppX Package';
  if (rawFormat === '7z' || cleanName.endsWith('.7z')) {
    if (platform === 'linux' || cleanName.includes('linux')) return 'Linux 7-Zip Archive (.7z)';
    if (platform === 'mac' || cleanName.includes('mac')) return 'macOS 7-Zip Archive (.7z)';
    return 'Windows 7-Zip Archive (.7z)';
  }
  if (rawFormat === 'rar' || cleanName.endsWith('.rar')) return 'WinRAR Archive (.rar)';
  if (rawFormat === 'deb' || cleanName.endsWith('.deb')) return 'Debian / Ubuntu Package (.deb)';
  if (rawFormat === 'appimage' || cleanName.endsWith('.appimage')) return 'Linux AppImage';
  if (rawFormat === 'rpm' || cleanName.endsWith('.rpm')) return 'RedHat / Fedora RPM';
  if (rawFormat === 'tar.gz' || cleanName.endsWith('.tar.gz') || cleanName.endsWith('.tgz')) return 'Linux Tarball (.tar.gz)';
  if (rawFormat === 'tar.xz' || cleanName.endsWith('.tar.xz') || cleanName.endsWith('.txz')) return 'Linux XZ Tarball (.tar.xz)';
  if (rawFormat === 'tar.zst' || cleanName.endsWith('.tar.zst') || cleanName.endsWith('.tzst') || cleanName.endsWith('.pkg.tar.zst')) return 'Linux Zstandard Package';
  if (rawFormat === 'snap' || cleanName.endsWith('.snap')) return 'Ubuntu Snap Package (.snap)';
  if (rawFormat === 'flatpak' || cleanName.endsWith('.flatpak') || cleanName.endsWith('.flatpakref')) return 'Flatpak Package (.flatpak)';
  if (rawFormat === 'run' || cleanName.endsWith('.run')) return 'Linux Self-Extracting Installer (.run)';
  if (rawFormat === 'dmg' || cleanName.endsWith('.dmg')) return 'macOS DMG Installer';
  if (rawFormat === 'pkg' || cleanName.endsWith('.pkg')) return 'macOS PKG Installer';
  if (rawFormat === 'jar' || cleanName.endsWith('.jar')) return 'Java Runnable (.jar)';
  if (rawFormat === 'bin' || cleanName.includes('linux') || cleanName.includes('amd64') || cleanName.includes('x86_64')) return 'Linux Standalone Binary';
  if (rawFormat === 'zip' || cleanName.endsWith('.zip')) {
    if (platform === 'windows' || cleanName.includes('win')) return 'Windows Portable ZIP';
    if (platform === 'linux' || cleanName.includes('linux')) return 'Linux ZIP Archive';
    if (platform === 'mac' || cleanName.includes('mac')) return 'macOS ZIP Archive';
    return 'ZIP Archive Package';
  }

  if (platform === 'ios') return 'iOS IPA Package';
  if (platform === 'windows') return 'Windows Package';
  if (platform === 'linux') return 'Linux Package';
  if (platform === 'mac') return 'macOS Package';
  if (platform === 'android') return 'Android Package';
  return 'Application Package';
}

export function isDraftMeaningful(draft: any): boolean {
  if (!draft || typeof draft !== 'object') return false;
  if (draft.step && draft.step > 1) return true;
  if (draft.name && String(draft.name).trim()) return true;
  if (draft.downloadUrl && String(draft.downloadUrl).trim()) return true;
  if (draft.githubUrl && String(draft.githubUrl).trim()) return true;
  if (draft.tagline && String(draft.tagline).trim()) return true;
  if (draft.description && String(draft.description).trim()) return true;
  if (draft.iconUrl && String(draft.iconUrl).trim()) return true;
  if (draft.changelog && String(draft.changelog).trim()) return true;
  return false;
}

export function getSavedNewAppDraft(devId?: string): any | null {
  try {
    const candidates = [
      devId ? `prople_draft_new_app_${devId}` : null,
      'prople_draft_new_app_guest',
      'prople_publish_app_draft'
    ].filter(Boolean) as string[];

    for (const key of candidates) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !parsed.editingAppId) {
            if (isDraftMeaningful(parsed)) {
              return { ...parsed, editingAppId: null };
            } else {
              // Stale empty draft found: purge it
              localStorage.removeItem(key);
            }
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }

    // Also scan any other leftover prople_draft_new_app_ keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('prople_draft_new_app_')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (isDraftMeaningful(parsed)) {
              return { ...parsed, editingAppId: null };
            } else {
              localStorage.removeItem(k);
            }
          } catch {
            localStorage.removeItem(k);
          }
        }
      }
    }
  } catch {}
  return null;
}

export function deleteSavedNewAppDraft(devId?: string): void {
  try {
    if (devId) {
      localStorage.removeItem(`prople_draft_new_app_${devId}`);
    }
    localStorage.removeItem('prople_draft_new_app_guest');

    // Thoroughly sweep all prople_draft_new_app_ keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('prople_draft_new_app_') || k === 'prople_publish_app_draft_new')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear legacy draft key if not editing an existing app
    const legacyRaw = localStorage.getItem('prople_publish_app_draft');
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        if (!legacy?.editingAppId) {
          localStorage.removeItem('prople_publish_app_draft');
        }
      } catch {
        localStorage.removeItem('prople_publish_app_draft');
      }
    }

    localStorage.removeItem('prople_publish_form_session');
    localStorage.removeItem('prople_publish_form_open');
    sessionStorage.removeItem('prople_publish_in_edit_session');
  } catch {}
}

export function getSavedUpdateDraft(appId: string): any | null {
  if (!appId) return null;
  try {
    const key = `prople_draft_update_app_${appId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (isDraftMeaningful(parsed)) {
          return { ...parsed, editingAppId: appId };
        } else {
          localStorage.removeItem(key);
        }
      }
    }
    // Legacy draft fallback if editingAppId strictly matches this app
    const legacyRaw = localStorage.getItem('prople_publish_app_draft');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && typeof legacy === 'object' && legacy.editingAppId === appId) {
        if (isDraftMeaningful(legacy)) {
          return { ...legacy, editingAppId: appId };
        } else {
          localStorage.removeItem('prople_publish_app_draft');
        }
      }
    }
  } catch {}
  return null;
}

export function deleteSavedUpdateDraft(appId: string): void {
  if (!appId) return;
  try {
    const key = `prople_draft_update_app_${appId}`;
    localStorage.removeItem(key);
    const legacyRaw = localStorage.getItem('prople_publish_app_draft');
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.editingAppId === appId) {
          localStorage.removeItem('prople_publish_app_draft');
        }
      } catch {}
    }
    localStorage.removeItem('prople_publish_form_session');
    localStorage.removeItem('prople_publish_form_open');
    sessionStorage.removeItem('prople_publish_in_edit_session');
  } catch {}
}

export function getSavedActiveSession(devId?: string): { type: 'new' | 'update'; appId?: string } | null {
  try {
    // A form session is strictly active only if the form modal was left open in this browser
    if (localStorage.getItem('prople_publish_form_open') !== 'true') {
      return null;
    }
    const raw = localStorage.getItem('prople_publish_form_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.type === 'new' || (parsed.type === 'update' && parsed.appId))) {
        return parsed;
      }
    }
    // Fallback: legacy draft key check
    const legacyDraft = localStorage.getItem('prople_publish_app_draft');
    if (legacyDraft) {
      const d = JSON.parse(legacyDraft);
      if (d && d.editingAppId) {
        return { type: 'update', appId: d.editingAppId };
      } else if (d) {
        return { type: 'new' };
      }
    }
  } catch {}
  return null;
}

interface AppConsoleProps {
  onClose: () => void;
  onOpenAppDetail?: (id: string) => void;
}

export default function AppConsole({ onClose, onOpenAppDetail }: AppConsoleProps) {
  const { showToast } = useToast();
  const { openPrivacyPolicy, openTermsOfService, openAuthPage, registerBackHandler } = useNavigation();
  const { banners, addBanner, updateBanner, appsList, publishApp, deleteApp, isLoadingApps, hasInitialSyncCompleted } = useStoreConfig();
  const { addNotification } = useInstall();
  const { user, isLoading: isAuthLoading, isPublisher, isPublisherOfApp, loginWithGoogle, togglePublisherStatus, updateUserProfile, isAdmin } = useAuth();
  
  const currentDevId = (user?.uid || auth.currentUser?.uid || (user?.email ? user.email.toLowerCase().trim() : 'guest')).trim();

  // Restore any active draft immediately if the publishing form was open on reload
  const initialSession = useMemo(() => {
    return getSavedActiveSession(currentDevId);
  }, [currentDevId]);

  const initialDraft = useMemo(() => {
    if (!initialSession) return null;
    if (initialSession.type === 'update' && initialSession.appId) {
      return getSavedUpdateDraft(initialSession.appId);
    }
    if (initialSession.type === 'new') {
      return getSavedNewAppDraft(currentDevId);
    }
    return null;
  }, [initialSession, currentDevId]);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [devTermsAgreed, setDevTermsAgreed] = useState(false);
  const [devTermsError, setDevTermsError] = useState('');
  const [showDevTermsReader, setShowDevTermsReader] = useState(false);
  const [showDevPrivacyReader, setShowDevPrivacyReader] = useState(false);
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  // Only auto-reopen if developer actively reloaded the tab during an edit session
  const [isPublishOpen, setIsPublishOpen] = useState<boolean>(() => {
    try {
      const activeInTab = sessionStorage.getItem('prople_publish_in_edit_session') === 'true';
      return Boolean(activeInTab && initialDraft);
    } catch {
      return false;
    }
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(() => {
    if (initialSession?.type === 'update' && initialSession.appId) {
      return initialSession.appId;
    }
    return null;
  });
  const [initialAppSnapshot, setInitialAppSnapshot] = useState<string | null>(() => initialDraft?.initialAppSnapshot || null);

  // Dedicated scroll refs for smooth scrolling & position persistence
  const consoleScrollRef = useRef<HTMLDivElement | null>(null);
  usePreserveScroll('developer-console-apps', consoleScrollRef);
  const publishScrollRef = useRef<HTMLDivElement | null>(null);
  const stepTabsRef = useRef<HTMLDivElement | null>(null);
  const stepButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});
  const targetSectionIdRef = useRef<string | null>(null);

  // Draft tracker states to dynamically show draft badges & banners in the console
  const [savedNewAppDraft, setSavedNewAppDraft] = useState<any | null>(() => getSavedNewAppDraft(currentDevId));
  const [updateDraftsVersion, setUpdateDraftsVersion] = useState(0);

  // Publishing exhaustion quota status for new apps (3 apps / 15-minute window)
  const [publishQuota, setPublishQuota] = useState(() => getPublishQuotaStatus(currentDevId));
  // App updates quota status (frequent updates allowed: 5 updates / 1 hour window)
  const [updateQuota, setUpdateQuota] = useState(() => getUpdateQuotaStatus(currentDevId, undefined));

  useEffect(() => {
    const uid = user?.uid || auth.currentUser?.uid || (user?.email ? user.email.toLowerCase().trim() : 'guest');
    setPublishQuota(getPublishQuotaStatus(uid));
    setUpdateQuota(getUpdateQuotaStatus(uid, editingAppId || undefined));
  }, [user?.uid, user?.email, editingAppId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const uid = user?.uid || auth.currentUser?.uid || (user?.email ? user.email.toLowerCase().trim() : 'guest');
      setPublishQuota(getPublishQuotaStatus(uid));
      setUpdateQuota(getUpdateQuotaStatus(uid, editingAppId || undefined));
    }, 2000);
    return () => clearInterval(timer);
  }, [user?.uid, user?.email, editingAppId]);

  // Straightforward, un-complicated ownership verification:
  // Whichever account published an app, that account (and that account only) sees and manages that app.
  // Every publisher is strictly isolated by their exact account email.
  const isUserOwnerOfApp = React.useCallback((app: AppDetails | any): boolean => {
    if (!app || !user) return false;
    const currentUid = (user.uid || auth.currentUser?.uid || '').trim();
    const currentEmail = (user.email || auth.currentUser?.email || '').toLowerCase().trim();

    const appOwnerUid = ((app as any).owner || app.developerId || (app as any).creatorUid || '').trim();
    const appDevEmail = (app.developerEmail || '').toLowerCase().trim();
    const appOwnerEmail = ((app as any).ownerEmail || '').toLowerCase().trim();
    const appPubEmail = (app.publisherEmail || '').toLowerCase().trim();
    const appDevInfoEmail = (app.developerInfo?.email || '').toLowerCase().trim();

    const appPrimaryEmail = appDevEmail || appOwnerEmail || appPubEmail || appDevInfoEmail;

    // Strict Rule 1: If the app specifies a developer or owner email,
    // it MUST match the current user's email EXACTLY. No cross-email sharing!
    if (currentEmail && appPrimaryEmail) {
      if (appPrimaryEmail === currentEmail) return true;
      return false;
    }

    // Strict Rule 2: If the app has no email recorded, match by exact UID
    if (currentUid && currentUid !== 'guest' && currentUid !== 'developer' && currentUid !== 'dev-publisher') {
      if (appOwnerUid && appOwnerUid === currentUid) {
        return true;
      }
    }

    // Strict Rule 3: Tracked in user's verified publishedAppIds array
    if (user.publishedAppIds && Array.isArray(user.publishedAppIds) && user.publishedAppIds.includes(app.id)) {
      if (currentEmail && appPrimaryEmail && appPrimaryEmail !== currentEmail) {
        return false;
      }
      return true;
    }

    return false;
  }, [user]);

  // Helper to determine if current logged-in user can manage (strict ownership verification: console is private property)
  const canUserManageApp = React.useCallback((app: AppDetails | any): boolean => {
    if (!app || !user) return false;
    return isUserOwnerOfApp(app);
  }, [isUserOwnerOfApp, user]);

  const currentEditingApp = React.useMemo(() => {
    if (!editingAppId) return null;
    return appsList.find(a => a.id === editingAppId) || null;
  }, [editingAppId, appsList]);

  const isOwnerAuthorized = React.useMemo(() => {
    if (!currentEditingApp) return true;
    return canUserManageApp(currentEditingApp);
  }, [currentEditingApp, canUserManageApp]);

  // User's own published apps
  const myApps = React.useMemo(() => {
    return appsList.filter(app => isUserOwnerOfApp(app));
  }, [appsList, isUserOwnerOfApp]);

  // Console strictly displays the authenticated developer's apps
  const displayableApps = React.useMemo(() => {
    return myApps;
  }, [myApps]);

  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuAppId, setOpenMenuAppId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    transformOrigin: string;
  } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const updateMenuPosition = useCallback((buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    // If element is scrolled completely out of view, close it
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpenMenuAppId(null);
      setMenuCoords(null);
      menuTriggerRef.current = null;
      return;
    }

    const estimatedMenuHeight = 250;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Flip upwards dynamically if space below is limited and space above is larger
    const openUpwards = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const rightOffset = Math.max(10, window.innerWidth - rect.right);

    if (openUpwards) {
      setMenuCoords({
        bottom: window.innerHeight - rect.top + 6,
        right: rightOffset,
        transformOrigin: 'bottom right',
      });
    } else {
      setMenuCoords({
        top: rect.bottom + 6,
        right: rightOffset,
        transformOrigin: 'top right',
      });
    }
  }, []);

  const handleToggleMenu = useCallback((appId: string, buttonEl: HTMLButtonElement) => {
    if (openMenuAppId === appId) {
      setOpenMenuAppId(null);
      setMenuCoords(null);
      menuTriggerRef.current = null;
    } else {
      menuTriggerRef.current = buttonEl;
      updateMenuPosition(buttonEl);
      setOpenMenuAppId(appId);
    }
  }, [openMenuAppId, updateMenuPosition]);

  // Dismiss open action menu on scroll immediately to eliminate layout thrashing and maintain 60fps scrolling
  useEffect(() => {
    if (!openMenuAppId) return;

    const handleScrollOrResize = (e: Event) => {
      if (e.type === 'scroll') {
        setOpenMenuAppId(null);
        setMenuCoords(null);
        menuTriggerRef.current = null;
        return;
      }
      if (menuTriggerRef.current) {
        updateMenuPosition(menuTriggerRef.current);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenuAppId, updateMenuPosition]);

  const [appToDelete, setAppToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Developer Donation Modal State (Triggered at milestone tiers: 2, 10, 20, 30, 40...)
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [currentDonationMilestone, setCurrentDonationMilestone] = useState<number | null>(null);

  // Helper functions for developer donation milestone tracking (2, then 10, 20, 30, 40...)
  const getShownDonationMilestones = useCallback((): number[] => {
    try {
      const raw = localStorage.getItem('prople_developer_donation_milestones');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(Number);
      }
      // Backward compatibility with legacy boolean flag
      if (localStorage.getItem('prople_developer_donation_popup_shown') === 'true') {
        return [2];
      }
    } catch {
      // ignore
    }
    return [];
  }, []);

  const getEligibleDonationMilestone = useCallback((count: number, shownMilestones: number[]): number | null => {
    if (count < 2) return null;
    // Progression milestones: 2, then 10, 20, 30, 40, 50, ...
    let currentMilestone = 0;
    if (count >= 10) {
      currentMilestone = Math.floor(count / 10) * 10;
    } else if (count >= 2) {
      currentMilestone = 2;
    }

    if (currentMilestone > 0 && !shownMilestones.includes(currentMilestone)) {
      return currentMilestone;
    }
    return null;
  }, []);

  const recordDonationMilestoneShown = useCallback((milestone: number) => {
    try {
      const current = getShownDonationMilestones();
      const toAdd = [2];
      for (let m = 10; m <= milestone; m += 10) {
        toAdd.push(m);
      }
      const updated = Array.from(new Set([...current, ...toAdd]));
      localStorage.setItem('prople_developer_donation_milestones', JSON.stringify(updated));
      localStorage.setItem('prople_developer_donation_popup_shown', 'true');
    } catch {
      // ignore
    }
  }, [getShownDonationMilestones]);

  useEffect(() => {
    try {
      const shown = getShownDonationMilestones();
      const eligible = getEligibleDonationMilestone(myApps.length, shown);
      if (eligible !== null) {
        recordDonationMilestoneShown(eligible);
        setCurrentDonationMilestone(eligible);
        setShowDonationModal(true);
      }
    } catch {
      // ignore
    }
  }, [myApps.length, getShownDonationMilestones, getEligibleDonationMilestone, recordDonationMilestoneShown]);

  // Close cancel/discard modal on Escape
  useEffect(() => {
    if (!showCancelModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCancelModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCancelModal]);

  // Close developer onboarding terms/privacy reader modal on Escape
  useEffect(() => {
    if (!showDevTermsReader && !showDevPrivacyReader) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDevTermsReader(false);
        setShowDevPrivacyReader(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDevTermsReader, showDevPrivacyReader]);

  // Top Charts Filters & Categories State
  const [selectedTopFilter, setSelectedTopFilter] = useState<'All apps' | 'Top rated' | 'Trending' | 'New releases'>('All apps');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [showTopFilter, setShowTopFilter] = useState(false);
  const [showCategoriesFilter, setShowCategoriesFilter] = useState(false);

  const topFilters: Array<'All apps' | 'Top rated' | 'Trending' | 'New releases'> = ['All apps', 'Top rated', 'Trending', 'New releases'];

  const categoriesList = [
    { name: 'All categories', icon: null },
    { name: 'Productivity', icon: Briefcase },
    { name: 'Tools', icon: Wrench },
    { name: 'Games', icon: Gamepad2 },
    { name: 'Ecommerce', icon: ShoppingCart },
    { name: 'Communication', icon: MessageSquare },
    { name: 'Entertainment', icon: Clapperboard },
    { name: 'Education', icon: GraduationCap },
    { name: 'Art & Design', icon: PenTool },
    { name: 'Books & Reference', icon: Book },
    { name: 'Auto & Vehicles', icon: Car },
    { name: 'Beauty', icon: Flower2 },
    { name: 'Watch faces', icon: Clock },
  ];

  // Publish Form Steps: 1: Source -> 2: Basic Info & Branding -> 3: Binary & APK -> 4: Media & About -> 5: Data Safety & Support -> 6: Review & Publish
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(() => {
    const s = initialDraft?.step;
    return (s && s >= 1 && s <= 6) ? s : 1;
  });

  // Robustly scroll the publish container directly to the targeted section element
  const performScrollToTarget = useCallback((targetId: string): boolean => {
    const el = document.getElementById(targetId);
    const container = publishScrollRef.current;
    if (!el) return false;

    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeOffset = elRect.top - containerRect.top + container.scrollTop;
      const desiredTop = Math.max(0, relativeOffset - 32);

      container.scrollTo({
        top: desiredTop,
        behavior: 'instant' as ScrollBehavior
      });
    }

    try {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.focus({ preventScroll: true });
        // Highlight only the input section's own border directly without double container offset rings
        el.classList.add('!border-blue-500', 'transition-colors');
        setTimeout(() => {
          el.classList.remove('!border-blue-500');
        }, 2500);
      } else {
        el.classList.add('!border-blue-500', 'transition-colors');
        setTimeout(() => {
          el.classList.remove('!border-blue-500');
        }, 2500);
      }
    } catch {
      // Focus quirks ignored
    }

    return true;
  }, []);

  // Navigate user to a specific step and scroll directly to its target section / field
  const navigateToStepAndSection = useCallback((targetStep: 1 | 2 | 3 | 4 | 5 | 6, targetId?: string) => {
    if (!targetId) {
      setStep(targetStep);
      return;
    }

    if (step === targetStep) {
      // Already on the requested step: execute direct scroll immediately
      requestAnimationFrame(() => {
        if (!performScrollToTarget(targetId)) {
          setTimeout(() => performScrollToTarget(targetId), 50);
        }
      });
      return;
    }

    // Step must change first
    targetSectionIdRef.current = targetId;
    setStep(targetStep);
  }, [step, performScrollToTarget]);

  // Smoothly scroll step wizard or navigate directly to incomplete section whenever step changes
  useEffect(() => {
    if (targetSectionIdRef.current) {
      const targetId = targetSectionIdRef.current;
      targetSectionIdRef.current = null;

      let attempts = 0;
      const attemptScroll = () => {
        const success = performScrollToTarget(targetId);
        if (!success && attempts < 8) {
          attempts++;
          setTimeout(attemptScroll, 50);
        }
      };

      requestAnimationFrame(() => {
        setTimeout(attemptScroll, 40);
      });
    }
  }, [step, performScrollToTarget]);

  // Auto-scroll the top step navigation bar on step changes (mobile and tablet only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobileOrTablet = window.innerWidth < 1024;
    const container = stepTabsRef.current;
    const targetBtn = stepButtonRefs.current[step];

    if (isMobileOrTablet && container && targetBtn) {
      if (container.scrollWidth > container.clientWidth) {
        const btnLeft = targetBtn.offsetLeft;
        const btnWidth = targetBtn.offsetWidth;
        const containerWidth = container.clientWidth;
        const targetScrollLeft = btnLeft - (containerWidth / 2) + (btnWidth / 2);

        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'instant' as ScrollBehavior
        });
      }
    }
  }, [step]);
  const [githubUrl, setGithubUrl] = useState(() => initialDraft?.githubUrl || '');
  const [releaseUrlError, setReleaseUrlError] = useState<string | null>(null);
  const [isFetchingRelease, setIsFetchingRelease] = useState(false);
  
  // Section 1: Basic Info & Branding
  const [name, setName] = useState(() => initialDraft?.name || '');
  const currentGoogleName = user?.publisherName || user?.displayName || 'Verified Publisher';
  const currentGoogleEmail = user?.email || 'support@prople.co.in';
  const [developerName, setDeveloperName] = useState(() => initialDraft?.developerName || currentGoogleName);
  const [githubRepoOwner, setGithubRepoOwner] = useState(() => initialDraft?.githubRepoOwner || '');
  const [category, setCategory] = useState(() => initialDraft?.category || 'Productivity');
  const [tagline, setTagline] = useState(() => initialDraft?.tagline || '');
  const [contentRating, setContentRating] = useState(() => initialDraft?.contentRating || 'Rated for 3+');
  const [price] = useState('Free');
  const [containsAds, setContainsAds] = useState(() => Boolean(initialDraft?.containsAds));
  const [inAppPurchases, setInAppPurchases] = useState(() => Boolean(initialDraft?.inAppPurchases));
  const [tags, setTags] = useState(() => initialDraft?.tags || '');
  const [interactiveElements, setInteractiveElements] = useState<string[]>(() => initialDraft?.interactiveElements || []);

  // Publisher Name conflict detection and session-scoped toast notification
  const activePublisherName = (user?.publisherName || user?.displayName || developerName || '').trim();
  const [isPublisherNameConflict, setIsPublisherNameConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [showChangePublisherModal, setShowChangePublisherModal] = useState(false);
  const [newCandidatePublisherName, setNewCandidatePublisherName] = useState('');
  const [candidateValidationMsg, setCandidateValidationMsg] = useState('');
  const [isCandidateChecking, setIsCandidateChecking] = useState(false);
  const [isCandidateAvailable, setIsCandidateAvailable] = useState(true);
  const [isSavingPublisherName, setIsSavingPublisherName] = useState(false);

  // Authoritative database check for publisher name uniqueness
  useEffect(() => {
    if (!activePublisherName || activePublisherName.length < 2) return;
    let isMounted = true;

    const verifyName = async () => {
      try {
        const res = await checkPublisherNameAvailability(activePublisherName, {
          currentUserId: user?.uid,
          currentUserEmail: user?.email,
          currentUserName: user?.publisherName,
          allApps: appsList
        });

        if (!isMounted) return;

        if (!res.available && res.isTaken) {
          setIsPublisherNameConflict(true);
          const msg = 'Your publisher name is already taken. Please change your publisher name to activate publishing.';
          setConflictMessage(msg);

          // Session-scoped toast: show just once per browser session
          const sessionToastKey = `prople_pub_name_conflict_session_${(user?.uid || user?.email || 'guest')}`;
          if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(sessionToastKey)) {
            sessionStorage.setItem(sessionToastKey, '1');
            showToast(msg, { type: 'error', duration: 6000 });
          }
        } else {
          setIsPublisherNameConflict(false);
          setConflictMessage('');
        }
      } catch (err) {
        console.warn('[AppConsole] Publisher name verification error:', err);
      }
    };

    verifyName();

    return () => {
      isMounted = false;
    };
  }, [activePublisherName, user?.uid, user?.email, user?.publisherName, appsList, showToast]);

  // Real-time debounced validation for candidate new publisher name
  useEffect(() => {
    const trimmed = newCandidatePublisherName.trim();
    if (!trimmed) {
      setCandidateValidationMsg('');
      setIsCandidateAvailable(false);
      setIsCandidateChecking(false);
      return;
    }
    if (trimmed.length < 2) {
      setCandidateValidationMsg('Publisher name must be at least 2 characters.');
      setIsCandidateAvailable(false);
      setIsCandidateChecking(false);
      return;
    }
    if (trimmed.toLowerCase() === activePublisherName.toLowerCase() && !isPublisherNameConflict) {
      setCandidateValidationMsg('This is your current publisher name.');
      setIsCandidateAvailable(true);
      setIsCandidateChecking(false);
      return;
    }

    setIsCandidateChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkPublisherNameAvailability(trimmed, {
          currentUserId: user?.uid,
          currentUserEmail: user?.email,
          allApps: appsList
        });
        setIsCandidateAvailable(res.available && !res.isTaken);
        setCandidateValidationMsg(res.message);
      } catch {
        setIsCandidateAvailable(true);
        setCandidateValidationMsg('Publisher name is available.');
      } finally {
        setIsCandidateChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [newCandidatePublisherName, activePublisherName, isPublisherNameConflict, user?.uid, user?.email, appsList]);

  const handleSaveNewPublisherName = async () => {
    const cleanName = newCandidatePublisherName.trim();
    if (!cleanName || cleanName.length < 2) {
      showToast('Please enter a valid publisher name (at least 2 characters).', { type: 'error' });
      return;
    }
    if (!isCandidateAvailable) {
      showToast(candidateValidationMsg || 'This publisher name is already taken. Please choose another name.', { type: 'error' });
      return;
    }

    setIsSavingPublisherName(true);
    try {
      if (user?.uid && user?.email) {
        const claimRes = await claimPublisherName(cleanName, user.uid, user.email);
        if (!claimRes.success) {
          showToast(claimRes.message || 'Failed to claim publisher name.', { type: 'error' });
          setIsSavingPublisherName(false);
          return;
        }
      }

      await updateUserProfile({
        publisherName: cleanName,
        displayName: cleanName,
        isPublisher: true
      });

      setDeveloperName(cleanName);
      setIsPublisherNameConflict(false);
      setConflictMessage('');
      setShowChangePublisherModal(false);
      showToast(`Publisher name updated to "${cleanName}"! You can now publish applications.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update publisher name.', { type: 'error' });
    } finally {
      setIsSavingPublisherName(false);
    }
  };

  const handleAttemptNext = () => {
    if (isPublisherNameConflict) {
      showToast(conflictMessage || 'Your publisher name is already taken. Please change your publisher name to continue publishing.', { type: 'error', duration: 5000 });
      setNewCandidatePublisherName(activePublisherName);
      setShowChangePublisherModal(true);
      return;
    }
    setStep((s) => Math.min(6, s + 1) as any);
  };

  const handleAttemptStepTab = (targetStep: number) => {
    if (isPublisherNameConflict) {
      showToast(conflictMessage || 'Your publisher name is already taken. Please change your publisher name to continue publishing.', { type: 'error', duration: 5000 });
      setNewCandidatePublisherName(activePublisherName);
      setShowChangePublisherModal(true);
      return;
    }
    setStep(targetStep as any);
  };

  const handleAttemptPublish = () => {
    if (isPublisherNameConflict) {
      showToast(conflictMessage || 'Your publisher name is already taken. Please change your publisher name to continue publishing.', { type: 'error', duration: 5000 });
      setNewCandidatePublisherName(activePublisherName);
      setShowChangePublisherModal(true);
      return;
    }

    if (editingAppId && !isOwnerAuthorized) {
      showToast('Unauthorized: You can only publish updates for apps owned by your account.', { type: 'error' });
      return;
    }

    if (editingAppId && updateQuota.isExhausted) {
      showToast(`Please wait ${updateQuota.nextAvailableTimeFormatted} before publishing another update for this app.`, { type: 'info', duration: 4000 });
      return;
    }

    if (!editingAppId && publishQuota.isExhausted) {
      showToast(`Please wait ${publishQuota.nextAvailableTimeFormatted} before releasing another app.`, { type: 'info', duration: 4000 });
      return;
    }

    handlePublishApp();
  };

  // Auto-sync developer profile info - inherited from editable publisher account profile
  useEffect(() => {
    if (user) {
      setDeveloperName(user.publisherName || user.displayName || 'Verified Publisher');
      if (user.email) setDeveloperEmail(user.email);
    }
  }, [user]);

  // Section 2: Binary & Platform Package
  const [platform, setPlatform] = useState<'android' | 'windows' | 'linux' | 'mac' | 'ios' | 'multiplatform'>(() => initialDraft?.platform || 'android');
  const [packageFormat, setPackageFormat] = useState<'apk' | 'aar' | 'aab' | 'exe' | 'msi' | 'zip' | '7z' | 'rar' | 'msix' | 'appx' | 'deb' | 'AppImage' | 'rpm' | 'tar.gz' | 'tar.xz' | 'tar.zst' | 'snap' | 'flatpak' | 'bin' | 'run' | 'dmg' | 'pkg' | 'jar' | 'ipa'>(() => initialDraft?.packageFormat || 'apk');
  const [targetOs, setTargetOs] = useState(() => initialDraft?.targetOs || 'Android 8.0 and up');
  const [supportedArchitectures, setSupportedArchitectures] = useState<string[]>(() => initialDraft?.supportedArchitectures || ['Universal']);
  const [supportedArchitecturesInput, setSupportedArchitecturesInput] = useState(() => (initialDraft?.supportedArchitectures ? initialDraft.supportedArchitectures.join(', ') : 'Universal'));
  const [minRam, setMinRam] = useState(() => initialDraft?.minRam || '');
  const [version, setVersion] = useState(() => initialDraft?.version || '');
  const [versionName, setVersionName] = useState(() => initialDraft?.versionName || '');
  const [versionCode, setVersionCode] = useState(() => initialDraft?.versionCode || '1');
  const [downloadUrl, setDownloadUrl] = useState(() => initialDraft?.downloadUrl || '');
  const [assetName, setAssetName] = useState(() => initialDraft?.assetName || '');
  const [assetSize, setAssetSize] = useState(() => initialDraft?.assetSize || '');
  const [detectedDownloadsCount, setDetectedDownloadsCount] = useState<number>(() => initialDraft?.detectedDownloadsCount || 0);
  const [sha256, setSha256] = useState(() => initialDraft?.sha256 || '');
  const [minAndroid, setMinAndroid] = useState(() => initialDraft?.minAndroid || 'Android 8.0 and up');
  const [releaseDate, setReleaseDate] = useState(() => initialDraft?.releaseDate || '');
  const [initialReleaseDate, setInitialReleaseDate] = useState(() => initialDraft?.initialReleaseDate || '');
  const [changelog, setChangelog] = useState(() => initialDraft?.changelog || '');
  const [isResolvingApk, setIsResolvingApk] = useState(false);
  const [isTestingDownload, setIsTestingDownload] = useState(false);

  // Automatically derive platform, package format, and OS requirements only when target changes and not manually set
  useEffect(() => {
    const target = (downloadUrl || assetName || '').trim();
    if (target && !editingAppId) {
      const detected = inferPlatformAndFormat(target);
      setPlatform(prev => prev || detected.platform);
      setPackageFormat(prev => prev || (detected.packageFormat as any));
      setMinAndroid(prev => {
        if (!prev || prev.includes('Android') || prev.includes('Windows') || prev.includes('Linux')) {
          return detected.minRequirement;
        }
        return prev;
      });
      setTargetOs(prev => prev || detected.targetOs);
    }
  }, [downloadUrl, assetName, editingAppId]);

  // Section 3: Media & "About This App"
  const [iconUrl, setIconUrl] = useState(() => initialDraft?.iconUrl || '');
  const [featureGraphicUrl, setFeatureGraphicUrl] = useState(() => initialDraft?.featureGraphicUrl || '');
  const [detailsBannerUrl, setDetailsBannerUrl] = useState(() => initialDraft?.detailsBannerUrl || '');
  const [heroBannerUrl, setHeroBannerUrl] = useState(() => initialDraft?.heroBannerUrl || '');
  const [featureOnSpotlight, setFeatureOnSpotlight] = useState(() => initialDraft?.featureOnSpotlight ?? true);
  const [spotlightBadge, setSpotlightBadge] = useState(() => initialDraft?.spotlightBadge || 'Featured');
  const [spotlightHeadline, setSpotlightHeadline] = useState(() => initialDraft?.spotlightHeadline || '');
  const [screenshotsList, setScreenshotsList] = useState<string[]>(() => initialDraft?.screenshotsList || []);
  const [tabletScreenshotsList, setTabletScreenshotsList] = useState<string[]>(() => initialDraft?.tabletScreenshotsList || []);
  const [desktopScreenshotsList, setDesktopScreenshotsList] = useState<string[]>(() => initialDraft?.desktopScreenshotsList || []);
  const [promoVideoUrl, setPromoVideoUrl] = useState(() => initialDraft?.promoVideoUrl || '');
  const [promoVideoError, setPromoVideoError] = useState(false);
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(() => initialDraft?.videoThumbnailUrl || '');
  const [description, setDescription] = useState(() => initialDraft?.description || '');

  const isValidHttpUrl = (str: string): boolean => {
    if (!str || !str.trim()) return false;
    try {
      const u = new URL(str.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Authorized Link Verification Engine for Legal Compliance
  const checkAuthorizedLink = (url: string): {
    isAuthorized: boolean;
    statusText: string;
    sourceType: 'store' | 'github' | 'official' | 'certified' | 'https' | 'unauthorized';
  } => {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      return {
        isAuthorized: false,
        statusText: 'Authorized link is required',
        sourceType: 'unauthorized'
      };
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') {
        return {
          isAuthorized: false,
          statusText: 'Unauthorized: Link must use secure HTTPS protocol',
          sourceType: 'unauthorized'
        };
      }

      const host = parsed.hostname.toLowerCase();

      // 1. Prople platform store legal links
      if (host === 'prople.store' || host.endsWith('.prople.store') || host === 'prople.dev' || host.endsWith('.prople.dev')) {
        return {
          isAuthorized: true,
          statusText: 'Authorized: Platform Store Legal Policy',
          sourceType: 'store'
        };
      }

      // 2. Upstream GitHub repository links
      if (host === 'github.com' || host === 'raw.githubusercontent.com') {
        const cleanOwner = (githubRepoOwner || '').trim().toLowerCase().replace(/^@/, '');
        if (cleanOwner && parsed.pathname.toLowerCase().startsWith(`/${cleanOwner}`)) {
          return {
            isAuthorized: true,
            statusText: `Authorized: GitHub Repository Document (@${githubRepoOwner})`,
            sourceType: 'github'
          };
        }
        return {
          isAuthorized: true,
          statusText: 'Authorized: GitHub Hosted Legal Document',
          sourceType: 'github'
        };
      }

      // 3. Official website domain match
      if (websiteUrl && websiteUrl.trim()) {
        try {
          const webParsed = new URL(websiteUrl.trim());
          if (webParsed.hostname.toLowerCase() === host) {
            return {
              isAuthorized: true,
              statusText: `Authorized: Official Publisher Domain (${host})`,
              sourceType: 'official'
            };
          }
        } catch {}
      }

      // 4. Certified legal & docs hosts
      const certifiedHosts = [
        'github.io', 'notion.site', 'gitbook.io', 'termsfeed.com',
        'iubenda.com', 'termly.io', 'getterms.app', 'privacypolicies.com',
        'sites.google.com', 'docs.google.com', 'gitlab.com'
      ];
      if (certifiedHosts.some(ch => host === ch || host.endsWith('.' + ch))) {
        return {
          isAuthorized: true,
          statusText: `Authorized: Certified Legal Host (${host})`,
          sourceType: 'certified'
        };
      }

      // 5. Standard valid public HTTPS domain
      if (host.includes('.') && !host.endsWith('.local') && !host.includes('localhost')) {
        return {
          isAuthorized: true,
          statusText: `Authorized: Secure HTTPS Web Document (${host})`,
          sourceType: 'https'
        };
      }

      return {
        isAuthorized: false,
        statusText: 'Unauthorized link host or domain format',
        sourceType: 'unauthorized'
      };
    } catch {
      return {
        isAuthorized: false,
        statusText: 'Invalid URL format (Must be valid https:// URL)',
        sourceType: 'unauthorized'
      };
    }
  };

  // Section 5: Developer, Legal & Publisher Support
  const [developerEmail, setDeveloperEmail] = useState(() => initialDraft?.developerEmail || user?.email || '');
  const [websiteUrl, setWebsiteUrl] = useState(() => initialDraft?.websiteUrl || '');
  const [githubRepoUrl, setGithubRepoUrl] = useState(() => initialDraft?.githubRepoUrl || '');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(() => initialDraft?.privacyPolicyUrl || '');
  const [termsAndConditionsUrl, setTermsAndConditionsUrl] = useState(() => initialDraft?.termsAndConditionsUrl || '');
  const [developerAddress, setDeveloperAddress] = useState(() => initialDraft?.developerAddress || '');

  // Auto-derive upstream GitHub repository owner whenever githubUrl, downloadUrl or githubRepoUrl changes
  useEffect(() => {
    const extracted = extractGitHubRepoOwner(githubUrl || downloadUrl || githubRepoUrl);
    if (extracted) {
      setGithubRepoOwner(extracted);
    }
  }, [githubUrl, downloadUrl, githubRepoUrl]);

  // Track state of publish button: 'idle' | 'warning' | 'publishing' | 'success'
  const [publishButtonState, setPublishButtonState] = useState<'idle' | 'warning' | 'publishing' | 'success'>('idle');

  // Comprehensive validator to detect all missing steps before publishing
  const getPublishingMissingSteps = useCallback((): { step: 1 | 2 | 3 | 4 | 5 | 6; title: string; message: string; targetId: string }[] => {
    const missing: { step: 1 | 2 | 3 | 4 | 5 | 6; title: string; message: string; targetId: string }[] = [];

    // Step 1: GitHub release & owner (GitHub Releases Only)
    const cleanSource = (githubUrl || githubRepoUrl || downloadUrl || '').trim();
    if (!cleanSource || cleanSource === '#') {
      missing.push({
        step: 1,
        title: 'Release Package URL',
        message: 'Step 1 is incomplete: A valid package download link or GitHub release URL is required for app publishing.',
        targetId: 'input-github-release-url'
      });
    }

    // Step 2: App Name & Category
    if (!name.trim()) {
      missing.push({
        step: 2,
        title: 'App Name',
        message: 'Step 2 is incomplete: Please enter an App Name.',
        targetId: 'input-app-name'
      });
    }

    // Step 3: Package Download Link, GitHub Origin & Version Number
    if (!downloadUrl.trim()) {
      missing.push({
        step: 3,
        title: 'Package Download Link',
        message: 'Step 3 is incomplete: GitHub release binary package download link is required.',
        targetId: 'input-download-url'
      });
    } else if (!downloadUrl.toLowerCase().includes('github.com') && !downloadUrl.toLowerCase().includes('githubusercontent.com')) {
      missing.push({
        step: 3,
        title: 'GitHub Release Binary Only',
        message: 'Step 3 is incomplete: Direct download URL must originate from an official GitHub Release asset.',
        targetId: 'input-download-url'
      });
    }

    if (!versionName.trim() && !version.trim()) {
      missing.push({
        step: 3,
        title: 'Version Number',
        message: 'Step 3 is incomplete: Package version number (e.g. 1.0.0) is required.',
        targetId: 'input-version-name'
      });
    }

    // Step 5: Mandatory Legal Policies (Authorized HTTPS links)
    const privAuth = checkAuthorizedLink(privacyPolicyUrl);
    if (!privAuth.isAuthorized) {
      missing.push({
        step: 5,
        title: 'Privacy Policy (Authorized Link)',
        message: `Step 5 is incomplete: ${privAuth.statusText || 'Authorized Privacy Policy link required.'}`,
        targetId: 'input-privacy-policy-url'
      });
    }
    const termsAuth = checkAuthorizedLink(termsAndConditionsUrl);
    if (!termsAuth.isAuthorized) {
      missing.push({
        step: 5,
        title: 'Terms & Conditions (Authorized Link)',
        message: `Step 5 is incomplete: ${termsAuth.statusText || 'Authorized Terms & Conditions link required.'}`,
        targetId: 'input-terms-conditions-url'
      });
    }

    return missing;
  }, [githubRepoOwner, githubUrl, githubRepoUrl, downloadUrl, versionName, version, name, privacyPolicyUrl, termsAndConditionsUrl]);

  // Steps can be freely skipped; navigation is never blocked
  const validateStepRequirements = (_currentStepNum: number, _targetStepNum: number): boolean => {
    return true;
  };

  // Section 4: Data Safety & Highlights
  const [dataSafetySummary, setDataSafetySummary] = useState(() => initialDraft?.dataSafetySummary || '');
  const [dataSafetyOverview, setDataSafetyOverview] = useState(() => initialDraft?.dataSafetyOverview || '');
  const [safetyHighlights, setSafetyHighlights] = useState<SafetyHighlight[]>(() => initialDraft?.safetyHighlights || []);

  const [dataShared, setDataShared] = useState(() => initialDraft?.dataShared || '');
  const [sharesDataWithThirdParties, setSharesDataWithThirdParties] = useState(() => Boolean(initialDraft?.sharesDataWithThirdParties));
  const [dataSharedDetails, setDataSharedDetails] = useState(() => initialDraft?.dataSharedDetails || '');
  const [customDataCollected, setCustomDataCollected] = useState(() => initialDraft?.customDataCollected || '');
  
  const [permissionsRequired, setPermissionsRequired] = useState<string[]>(() => initialDraft?.permissionsRequired || []);
  const [permissionsText, setPermissionsText] = useState<string>(() => (initialDraft?.permissionsRequired ? (Array.isArray(initialDraft.permissionsRequired) ? initialDraft.permissionsRequired.join('\n') : String(initialDraft.permissionsRequired)) : ''));
  const [permCamera, setPermCamera] = useState(() => initialDraft?.permCamera || '');
  const [permLocation, setPermLocation] = useState(() => initialDraft?.permLocation || '');
  const [permMicrophone, setPermMicrophone] = useState(() => initialDraft?.permMicrophone || '');
  const [permTelephone, setPermTelephone] = useState(() => initialDraft?.permTelephone || '');
  const [permStorage, setPermStorage] = useState(() => initialDraft?.permStorage || '');
  const [permOther, setPermOther] = useState(() => initialDraft?.permOther || '');

  // Official Android Permission Catalog
  const ALL_PERMISSION_CATALOG = useMemo(() => [
    { id: 'camera', name: 'Camera', placeholder: 'e.g. take pictures and videos, scan QR codes (Enter or comma)' },
    { id: 'location', name: 'Location', placeholder: 'e.g. access precise location only in the foreground (Enter or comma)' },
    { id: 'microphone', name: 'Microphone', placeholder: 'e.g. record audio, voice communication (Enter or comma)' },
    { id: 'telephone', name: 'Telephone', placeholder: 'e.g. directly call phone numbers, read phone status (Enter or comma)' },
    { id: 'storage', name: 'Storage', placeholder: 'e.g. read the contents of shared storage (Enter or comma)' },
    { id: 'contacts', name: 'Contacts', placeholder: 'e.g. read contacts, find accounts on device (Enter or comma)' },
    { id: 'sms', name: 'SMS', placeholder: 'e.g. send and receive SMS messages (Enter or comma)' },
    { id: 'calendar', name: 'Calendar', placeholder: 'e.g. read and add calendar events (Enter or comma)' },
    { id: 'notifications', name: 'Notifications', placeholder: 'e.g. post notifications and alerts (Enter or comma)' },
    { id: 'bluetooth', name: 'Nearby devices', placeholder: 'e.g. find and connect to nearby Bluetooth devices (Enter or comma)' },
    { id: 'sensors', name: 'Body sensors', placeholder: 'e.g. heart rate and step counter sensors (Enter or comma)' },
    { id: 'other', name: 'Other', placeholder: 'e.g. Advertising ID, run foreground service, notifications (Enter or comma)' },
  ], []);

  const [activePermissionIds, setActivePermissionIds] = useState<string[]>(() => {
    if (initialDraft?.permissionsRequired && Array.isArray(initialDraft.permissionsRequired) && initialDraft.permissionsRequired.length > 0) {
      return ['camera'];
    }
    return ['camera'];
  });
  const [customPermissionCategories, setCustomPermissionCategories] = useState<{ id: string; name: string }[]>([]);
  const [extraPermissionValues, setExtraPermissionValues] = useState<Record<string, string>>({});
  const [showAddPermissionModal, setShowAddPermissionModal] = useState(false);
  const [categoryToRemove, setCategoryToRemove] = useState<{ id: string; name: string } | null>(null);
  const [customGroupInputName, setCustomGroupInputName] = useState('');


  const getPermissionValue = useCallback((id: string): string => {
    switch (id) {
      case 'camera': return permCamera;
      case 'location': return permLocation;
      case 'microphone': return permMicrophone;
      case 'telephone': return permTelephone;
      case 'storage': return permStorage;
      case 'other': return permOther;
      default: return extraPermissionValues[id] || '';
    }
  }, [permCamera, permLocation, permMicrophone, permTelephone, permStorage, permOther, extraPermissionValues]);

  const updateDynamicPermission = useCallback((id: string, val: string) => {
    switch (id) {
      case 'camera': setPermCamera(val); break;
      case 'location': setPermLocation(val); break;
      case 'microphone': setPermMicrophone(val); break;
      case 'telephone': setPermTelephone(val); break;
      case 'storage': setPermStorage(val); break;
      case 'other': setPermOther(val); break;
      default:
        setExtraPermissionValues(prev => ({ ...prev, [id]: val }));
        break;
    }
  }, []);

  const handleRemovePermissionCategory = useCallback((id: string) => {
    setActivePermissionIds(prev => prev.filter(x => x !== id));
    updateDynamicPermission(id, '');
  }, [updateDynamicPermission]);

  const handleAddPermissionCategory = useCallback((catId: string) => {
    if (!activePermissionIds.includes(catId)) {
      setActivePermissionIds(prev => [...prev, catId]);
    }
    setShowAddPermissionModal(false);
  }, [activePermissionIds]);

  const handleAddCustomGroup = useCallback(() => {
    const trimmed = customGroupInputName.trim();
    if (!trimmed) return;
    const customId = `custom_${Date.now()}`;
    setCustomPermissionCategories(prev => [...prev, { id: customId, name: trimmed }]);
    setActivePermissionIds(prev => [...prev, customId]);
    setCustomGroupInputName('');
    setShowAddPermissionModal(false);
  }, [customGroupInputName]);

  const updatePermissionCategory = useCallback((
    category: 'camera' | 'location' | 'microphone' | 'telephone' | 'storage' | 'other',
    val: string
  ) => {
    updateDynamicPermission(category, val);
  }, [updateDynamicPermission]);

  const [dataDeletionPolicy, setDataDeletionPolicy] = useState(() => initialDraft?.dataDeletionPolicy || 'Users can request permanent data deletion or clear application cache locally at any time.');

  const createSnapshotString = useCallback((data: any) => {
    return JSON.stringify({
      name: (data.name || '').trim(),
      category: (data.category || '').trim(),
      tagline: (data.tagline || '').trim(),
      contentRating: (data.contentRating || '').trim(),
      containsAds: Boolean(data.containsAds),
      inAppPurchases: Boolean(data.inAppPurchases),
      interactiveElements: data.interactiveElements || [],
      tags: (data.tags || '').trim(),
      platform: (data.platform || '').trim(),
      packageFormat: (data.packageFormat || '').trim(),
      targetOs: (data.targetOs || '').trim(),
      supportedArchitectures: data.supportedArchitectures || [],
      minRam: (data.minRam || '').trim(),
      version: (data.version || '').trim(),
      versionName: (data.versionName || '').trim(),
      versionCode: (data.versionCode || '').trim(),
      downloadUrl: (data.downloadUrl || '').trim(),
      assetName: (data.assetName || '').trim(),
      assetSize: (data.assetSize || '').trim(),
      sha256: (data.sha256 || '').trim(),
      minAndroid: (data.minAndroid || '').trim(),
      changelog: (data.changelog || '').trim(),
      iconUrl: (data.iconUrl || '').trim(),
      featureGraphicUrl: (data.featureGraphicUrl || '').trim(),
      featureOnSpotlight: Boolean(data.featureOnSpotlight),
      spotlightBadge: (data.spotlightBadge || '').trim(),
      spotlightHeadline: (data.spotlightHeadline || '').trim(),
      screenshotsList: data.screenshotsList || [],
      tabletScreenshotsList: data.tabletScreenshotsList || [],
      desktopScreenshotsList: data.desktopScreenshotsList || [],
      promoVideoUrl: (data.promoVideoUrl || '').trim(),
      videoThumbnailUrl: (data.videoThumbnailUrl || '').trim(),
      description: (data.description || '').trim(),
      dataSafetySummary: (data.dataSafetySummary || '').trim(),
      dataSafetyOverview: (data.dataSafetyOverview || '').trim(),
      safetyHighlights: data.safetyHighlights || [],
      dataShared: (data.dataShared || '').trim(),
      sharesDataWithThirdParties: Boolean(data.sharesDataWithThirdParties),
      dataSharedDetails: (data.dataSharedDetails || '').trim(),
      customDataCollected: (data.customDataCollected || '').trim(),
      permissionsRequired: data.permissionsRequired || [],
      permCamera: (data.permCamera || '').trim(),
      permLocation: (data.permLocation || '').trim(),
      permMicrophone: (data.permMicrophone || '').trim(),
      permTelephone: (data.permTelephone || '').trim(),
      permStorage: (data.permStorage || '').trim(),
      permOther: (data.permOther || '').trim(),
      dataDeletionPolicy: (data.dataDeletionPolicy || '').trim(),
      developerEmail: (data.developerEmail || '').trim(),
      websiteUrl: (data.websiteUrl || '').trim(),
      githubRepoUrl: (data.githubRepoUrl || '').trim(),
      privacyPolicyUrl: (data.privacyPolicyUrl || '').trim(),
      termsAndConditionsUrl: (data.termsAndConditionsUrl || '').trim(),
      developerAddress: (data.developerAddress || '').trim(),
      githubUrl: (data.githubUrl || '').trim(),
    });
  }, []);

  const resetAllFormState = useCallback(() => {
    setEditingAppId(null);
    setInitialAppSnapshot(null);
    setStep(1);
    setName('');
    setDeveloperName(currentGoogleName);
    setDeveloperEmail(currentGoogleEmail);
    setGithubRepoOwner('');
    setCategory('Productivity');
    setTagline('');
    setContentRating('Rated for 3+');
    setContainsAds(false);
    setInAppPurchases(false);
    setInteractiveElements([]);
    setTags('Open Source, Productivity, Utilities');
    setPlatform('android');
    setPackageFormat('apk');
    setTargetOs('Android 8.0 and up');
    setSupportedArchitectures(['Universal']);
    setSupportedArchitecturesInput('Universal');
    setMinRam('');
    setVersion('');
    setVersionName('');
    setVersionCode('1');
    setDownloadUrl('');
    setAssetName('');
    setAssetSize('');
    setDetectedDownloadsCount(0);
    setSha256('');
    setMinAndroid('Android 8.0 and up');
    const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setReleaseDate(todayFormatted);
    setInitialReleaseDate(todayFormatted);
    setChangelog('');
    setIconUrl('');
    setFeatureGraphicUrl('');
    setDetailsBannerUrl('');
    setHeroBannerUrl('');
    setFeatureOnSpotlight(true);
    setSpotlightBadge('Featured');
    setSpotlightHeadline('');
    setScreenshotsList([]);
    setTabletScreenshotsList([]);
    setDesktopScreenshotsList([]);
    setPromoVideoUrl('');
    setVideoThumbnailUrl('');
    setDescription('');
    setDataSafetySummary('');
    setDataSafetyOverview('');
    setSafetyHighlights([]);
    setDataShared('No data shared with third parties.');
    setSharesDataWithThirdParties(false);
    setDataSharedDetails('');
    setCustomDataCollected('');
    setPermissionsRequired([]);
    setPermissionsText('');
    setPermCamera('');
    setPermLocation('');
    setPermMicrophone('');
    setPermTelephone('');
    setPermStorage('');
    setPermOther('');
    setActivePermissionIds(['camera']);
    setCustomPermissionCategories([]);
    setExtraPermissionValues({});
    setDataDeletionPolicy('Users can request permanent data deletion or clear application cache locally at any time.');
    setGithubUrl('');
    setWebsiteUrl('');
    setGithubRepoUrl('');
    setPrivacyPolicyUrl('');
    setTermsAndConditionsUrl('');
    setDeveloperAddress('');
    setReleaseUrlError(null);
    setPublishButtonState('idle');
    setShowCancelModal(false);
  }, [currentGoogleName, currentGoogleEmail]);

  const applyDraftToForm = useCallback((d: any, targetEditingAppId: string | null) => {
    setEditingAppId(targetEditingAppId);
    setInitialAppSnapshot(d.initialAppSnapshot || null);
    setName(d.name || '');
    setDeveloperName(d.developerName || currentGoogleName);
    if (d.developerEmail) setDeveloperEmail(d.developerEmail);
    if (d.githubRepoOwner) setGithubRepoOwner(d.githubRepoOwner);
    setCategory(d.category || 'Productivity');
    setTagline(d.tagline || '');
    setContentRating(d.contentRating || 'Rated for 3+');
    setContainsAds(Boolean(d.containsAds));
    setInAppPurchases(Boolean(d.inAppPurchases));
    setInteractiveElements(d.interactiveElements || []);
    setTags(d.tags || 'Open Source, Productivity, Utilities');
    if (d.platform) setPlatform(d.platform);
    if (d.packageFormat) setPackageFormat(d.packageFormat);
    if (d.targetOs) setTargetOs(d.targetOs);
    if (d.supportedArchitectures) setSupportedArchitectures(d.supportedArchitectures);
    if (d.supportedArchitecturesInput) setSupportedArchitecturesInput(d.supportedArchitecturesInput);
    if (d.minRam) setMinRam(d.minRam);
    setVersion(d.version || '');
    setVersionName(d.versionName || (d.version ? d.version.replace(/^v/i, '') : ''));
    setVersionCode(d.versionCode || '1');
    setDownloadUrl(d.downloadUrl || '');
    setAssetName(d.assetName || '');
    setAssetSize(d.assetSize || '');
    setDetectedDownloadsCount(d.detectedDownloadsCount || 0);
    setSha256(d.sha256 || (d.assetName || d.downloadUrl ? computeDeterministicSha256(`${d.name || 'draft'}:${d.versionName || 'v1'}:${d.assetName || d.downloadUrl || ''}`) : ''));
    setMinAndroid(d.minAndroid || 'Android 8.0 and up');
    setReleaseDate(d.releaseDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    setInitialReleaseDate(d.initialReleaseDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    setChangelog((d.changelog || '').slice(0, 200));
    setIconUrl(d.iconUrl || '');
    setFeatureGraphicUrl(d.featureGraphicUrl || '');
    setDetailsBannerUrl(d.detailsBannerUrl || '');
    setHeroBannerUrl(d.heroBannerUrl || '');
    setFeatureOnSpotlight(d.featureOnSpotlight ?? true);
    setSpotlightBadge(d.spotlightBadge || 'Featured');
    setSpotlightHeadline(d.spotlightHeadline || '');
    setScreenshotsList(d.screenshotsList || []);
    setTabletScreenshotsList(d.tabletScreenshotsList || []);
    setDesktopScreenshotsList(d.desktopScreenshotsList || []);
    setPromoVideoUrl(d.promoVideoUrl || '');
    setVideoThumbnailUrl(d.videoThumbnailUrl || '');
    setDescription(d.description || '');
    if (d.dataSafetySummary) setDataSafetySummary(d.dataSafetySummary);
    if (d.dataSafetyOverview) setDataSafetyOverview(d.dataSafetyOverview);
    if (d.safetyHighlights) setSafetyHighlights(d.safetyHighlights);
    if (d.dataShared) setDataShared(d.dataShared);
    if (d.sharesDataWithThirdParties !== undefined) setSharesDataWithThirdParties(Boolean(d.sharesDataWithThirdParties));
    if (d.dataSharedDetails) setDataSharedDetails(d.dataSharedDetails);
    if (d.customDataCollected) setCustomDataCollected(d.customDataCollected);
    if (d.permissionsRequired) {
      setPermissionsRequired(d.permissionsRequired);
      setPermissionsText(Array.isArray(d.permissionsRequired) ? d.permissionsRequired.join('\n') : String(d.permissionsRequired));
    }
    if (d.permCamera) setPermCamera(d.permCamera);
    if (d.permLocation) setPermLocation(d.permLocation);
    if (d.permMicrophone) setPermMicrophone(d.permMicrophone);
    if (d.permTelephone) setPermTelephone(d.permTelephone);
    if (d.permStorage) setPermStorage(d.permStorage);
    if (d.permOther) setPermOther(d.permOther);
    if (d.dataDeletionPolicy) setDataDeletionPolicy(d.dataDeletionPolicy);
    setGithubUrl(d.githubUrl || '');
    setWebsiteUrl(d.websiteUrl || '');
    setGithubRepoUrl(d.githubRepoUrl || '');
    setPrivacyPolicyUrl(d.privacyPolicyUrl || '');
    setTermsAndConditionsUrl(d.termsAndConditionsUrl || '');
    setDeveloperAddress(d.developerAddress && d.developerAddress !== 'Venture Community Labs, 100 Innovation Way' ? d.developerAddress : '');
    setStep(d.step && d.step >= 1 && d.step <= 6 ? d.step : 1);
  }, [currentGoogleName]);

  const populateFormFromApp = useCallback((app: AppDetails) => {
    setEditingAppId(app.id);
    setName(app.name || '');
    setDeveloperName(currentGoogleName);
    setDeveloperEmail(currentGoogleEmail);
    setGithubRepoOwner(app.githubRepoOwner || app.developerInfo?.githubRepoOwner || extractGitHubRepoOwner(app.githubReleaseUrl || app.githubRepo || app.downloadUrl) || '');
    setCategory(app.category || 'Productivity');
    setTagline(app.tagline || '');
    setContentRating(app.contentRating || 'Rated for 3+');
    setContainsAds(Boolean(app.containsAds));
    setInAppPurchases(Boolean(app.inAppPurchases));
    setInteractiveElements(app.interactiveElements || []);
    setTags(app.tags ? app.tags.join(', ') : 'Open Source, Productivity, Utilities');
    const detected = inferPlatformAndFormat((app.downloadUrl || app.assetName || '').trim());
    const effectivePlatform = app.platform || detected.platform || 'android';
    const effectivePackageFormat = app.packageFormat || (detected.packageFormat as any) || 'apk';
    const effectiveTargetOs = app.targetOs || app.minAndroid || (effectivePlatform === 'mac' ? 'macOS 12.0 or later' : effectivePlatform === 'linux' ? 'Linux (Debian, Ubuntu, Fedora, Arch)' : effectivePlatform === 'windows' ? 'Windows 10, 11 (64-bit)' : detected.targetOs || 'Android 8.0 and up');
    const effectiveMinAndroid = app.minAndroid || (effectivePlatform === 'mac' || effectivePlatform === 'linux' || effectivePlatform === 'windows' ? detected.minRequirement : 'Android 8.0 and up');
    setPlatform(effectivePlatform);
    setPackageFormat(effectivePackageFormat);
    setTargetOs(effectiveTargetOs);
    const archs = app.supportedArchitectures && app.supportedArchitectures.length > 0 ? app.supportedArchitectures : ['Universal'];
    setSupportedArchitectures(archs);
    setSupportedArchitecturesInput(archs.join(', '));
    setMinRam(app.minRam || '');
    setVersion(app.releaseTag || (app.versionName ? `v${app.versionName}` : ''));
    setVersionName(app.versionName || (app.releaseTag ? app.releaseTag.replace(/^v/i, '') : ''));
    setVersionCode(app.versionCode ? String(app.versionCode) : '1');
    setDownloadUrl(app.downloadUrl || '');
    setAssetName(app.assetName || '');
    setAssetSize(app.size || 'Varies with device');
    setDetectedDownloadsCount(app.downloadsCount ?? 0);
    const effectiveSha = app.sha256 || computeDeterministicSha256(`${app.id || app.name}:${app.releaseTag || app.versionName || 'v1'}:${app.assetName || ''}`);
    setSha256(effectiveSha);
    setMinAndroid(effectiveMinAndroid);
    setReleaseDate(app.releaseDate || 'Recently');
    setInitialReleaseDate(app.initialReleaseDate || app.releaseDate || 'Recently');
    setChangelog(app.releaseNotes || '');
    setIconUrl(app.iconUrl || '');
    setFeatureGraphicUrl(app.featureGraphicUrl || '');
    setDetailsBannerUrl(app.detailsBannerUrl || '');
    setHeroBannerUrl(app.heroBannerUrl || '');
    const existingBanner = banners.find(b => b.appId === app.id);
    if (existingBanner) {
      setFeatureOnSpotlight(existingBanner.isActive);
      setSpotlightBadge(existingBanner.titleBadge || 'Featured');
      setSpotlightHeadline(existingBanner.headline || '');
    } else {
      setFeatureOnSpotlight(Boolean(app.featureGraphicUrl));
      setSpotlightBadge('Featured');
      setSpotlightHeadline(app.tagline || '');
    }
    setScreenshotsList(app.screenshots || []);
    setTabletScreenshotsList(app.tabletScreenshots || []);
    setDesktopScreenshotsList(app.desktopScreenshots || []);
    setPromoVideoUrl(app.promoVideoUrl || '');
    setVideoThumbnailUrl(app.videoThumbnailUrl || '');
    setDescription(app.aboutText || '');
    
    // Load Data Safety
    const ds = app.dataSafety;
    setDataSafetySummary(ds?.summaryText || '');
    setDataSafetyOverview(ds?.overview || '');
    setSafetyHighlights(Array.isArray(ds?.highlights) ? ds.highlights : []);
    setDataShared(ds?.dataShared || 'No data shared with third parties.');
    setSharesDataWithThirdParties(Boolean(ds?.sharesDataWithThirdParties || (ds?.dataShared && !ds.dataShared.toLowerCase().includes('no data shared'))));
    setDataSharedDetails(ds?.dataSharedDetails || '');
    const loadedDataCollected = Array.isArray(ds?.dataCollected) 
      ? ds.dataCollected.join('\n') 
      : (typeof ds?.dataCollected === 'string' ? ds.dataCollected : '');
    setCustomDataCollected(loadedDataCollected);
    const loadedPermissions = ds?.permissions || (app as any)?.permissions || [];
    setPermissionsRequired(loadedPermissions);
    setPermissionsText(Array.isArray(loadedPermissions) ? loadedPermissions.join('\n') : String(loadedPermissions));

    const loadedGroups = extractPermissionGroups(app);
    const activeIds: string[] = [];
    const customCats: { id: string; name: string }[] = [];
    const extras: Record<string, string> = {};

    let loadedCam = '';
    let loadedLoc = '';
    let loadedMic = '';
    let loadedTel = '';
    let loadedSto = '';
    let loadedOth = '';

    loadedGroups.forEach(g => {
      activeIds.push(g.id);
      const joined = g.items.join('\n');
      if (g.id === 'camera') loadedCam = joined;
      else if (g.id === 'location') loadedLoc = joined;
      else if (g.id === 'microphone') loadedMic = joined;
      else if (g.id === 'telephone') loadedTel = joined;
      else if (g.id === 'storage') loadedSto = joined;
      else if (g.id === 'other') loadedOth = joined;
      else {
        extras[g.id] = joined;
        if (!ALL_PERMISSION_CATALOG.some(c => c.id === g.id)) {
          customCats.push({ id: g.id, name: g.name });
        }
      }
    });

    setPermCamera(loadedCam);
    setPermLocation(loadedLoc);
    setPermMicrophone(loadedMic);
    setPermTelephone(loadedTel);
    setPermStorage(loadedSto);
    setPermOther(loadedOth);

    if (activeIds.length === 0) {
      setActivePermissionIds(['camera']);
    } else {
      setActivePermissionIds(activeIds);
    }
    setCustomPermissionCategories(customCats);
    setExtraPermissionValues(extras);

    setDataDeletionPolicy(ds?.deletionPolicy || '');
    setDeveloperEmail(app.developerInfo?.email || user?.email || '');
    setWebsiteUrl(app.developerInfo?.website || '');
    setGithubRepoUrl(app.developerInfo?.github || app.githubRepo || '');
    setPrivacyPolicyUrl(app.developerInfo?.privacyPolicy || app.privacyPolicy || '');
    setTermsAndConditionsUrl(app.developerInfo?.termsAndConditions || app.developerInfo?.termsOfService || app.termsAndConditions || app.termsOfService || '');
    const existingAddress = app.developerInfo?.address || (app as any).address || '';
    const initialAddress = (
      existingAddress === 'Venture Community Labs, 100 Innovation Way' ||
      existingAddress.includes('Verified Google Account Publisher') ||
      existingAddress.includes('Verified Developer')
        ? ''
        : existingAddress
    );
    setDeveloperAddress(initialAddress);
    setGithubUrl(app.githubReleaseUrl || app.githubRepo || '');
    setStep(2);

    const initialSnap = createSnapshotString({
      name: app.name || '',
      category: app.category || 'Productivity',
      tagline: app.tagline || '',
      contentRating: app.contentRating || 'Rated for 3+',
      containsAds: Boolean(app.containsAds),
      inAppPurchases: Boolean(app.inAppPurchases),
      interactiveElements: app.interactiveElements || [],
      tags: app.tags ? app.tags.join(', ') : 'Open Source, Productivity, Utilities',
      platform: effectivePlatform,
      packageFormat: effectivePackageFormat,
      targetOs: effectiveTargetOs,
      supportedArchitectures: archs,
      minRam: app.minRam || '',
      version: app.releaseTag || (app.versionName ? `v${app.versionName}` : ''),
      versionName: app.versionName || (app.releaseTag ? app.releaseTag.replace(/^v/i, '') : ''),
      versionCode: app.versionCode ? String(app.versionCode) : '1',
      downloadUrl: app.downloadUrl || '',
      assetName: app.assetName || '',
      assetSize: app.size || 'Varies with device',
      sha256: effectiveSha,
      minAndroid: effectiveMinAndroid,
      changelog: app.releaseNotes || '',
      iconUrl: app.iconUrl || '',
      featureGraphicUrl: app.featureGraphicUrl || '',
      detailsBannerUrl: app.detailsBannerUrl || '',
      heroBannerUrl: app.heroBannerUrl || '',
      featureOnSpotlight: existingBanner ? existingBanner.isActive : Boolean(app.featureGraphicUrl),
      spotlightBadge: existingBanner ? (existingBanner.titleBadge || 'Featured') : 'Featured',
      spotlightHeadline: existingBanner ? (existingBanner.headline || '') : (app.tagline || ''),
      screenshotsList: app.screenshots || [],
      tabletScreenshotsList: app.tabletScreenshots || [],
      desktopScreenshotsList: app.desktopScreenshots || [],
      promoVideoUrl: app.promoVideoUrl || '',
      videoThumbnailUrl: app.videoThumbnailUrl || '',
      description: app.aboutText || '',
      dataSafetySummary: ds?.summaryText || '',
      dataSafetyOverview: ds?.overview || '',
      safetyHighlights: Array.isArray(ds?.highlights) ? ds.highlights : [],
      dataShared: ds?.dataShared || 'No data shared with third parties.',
      sharesDataWithThirdParties: Boolean(ds?.sharesDataWithThirdParties || (ds?.dataShared && !ds.dataShared.toLowerCase().includes('no data shared'))),
      dataSharedDetails: ds?.dataSharedDetails || '',
      customDataCollected: loadedDataCollected,
      permissionsRequired: loadedPermissions,
      permCamera: loadedCam,
      permLocation: loadedLoc,
      permMicrophone: loadedMic,
      permTelephone: loadedTel,
      permStorage: loadedSto,
      permOther: loadedOth,
      dataDeletionPolicy: ds?.deletionPolicy || 'Users can request permanent data deletion or clear application cache locally at any time.',
      developerEmail: app.developerInfo?.email || user?.email || '',
      websiteUrl: app.developerInfo?.website || '',
      githubRepoUrl: app.developerInfo?.github || app.githubRepo || '',
      privacyPolicyUrl: app.developerInfo?.privacyPolicy || app.privacyPolicy || '',
      termsAndConditionsUrl: app.developerInfo?.termsAndConditions || app.developerInfo?.termsOfService || app.termsAndConditions || app.termsOfService || '',
      developerAddress: initialAddress,
      githubUrl: app.githubReleaseUrl || app.githubRepo || '',
    });
    setInitialAppSnapshot(initialSnap);
  }, [currentGoogleName, currentGoogleEmail, banners, user, ALL_PERMISSION_CATALOG, createSnapshotString]);

  const currentFormSnapshot = useMemo(() => {
    return createSnapshotString({
      name,
      category,
      tagline,
      contentRating,
      containsAds,
      inAppPurchases,
      interactiveElements,
      tags,
      platform,
      packageFormat,
      targetOs,
      supportedArchitectures,
      minRam,
      version,
      versionName,
      versionCode,
      downloadUrl,
      assetName,
      assetSize,
      sha256,
      minAndroid,
      changelog,
      iconUrl,
      featureGraphicUrl,
      detailsBannerUrl,
      heroBannerUrl,
      featureOnSpotlight,
      spotlightBadge,
      spotlightHeadline,
      screenshotsList,
      tabletScreenshotsList,
      desktopScreenshotsList,
      promoVideoUrl,
      videoThumbnailUrl,
      description,
      dataSafetySummary,
      dataSafetyOverview,
      safetyHighlights,
      dataShared,
      sharesDataWithThirdParties,
      dataSharedDetails,
      customDataCollected,
      permissionsRequired,
      permCamera,
      permLocation,
      permMicrophone,
      permTelephone,
      permStorage,
      permOther,
      dataDeletionPolicy,
      developerEmail,
      websiteUrl,
      githubRepoUrl,
      privacyPolicyUrl,
      termsAndConditionsUrl,
      developerAddress,
      githubUrl,
    });
  }, [
    createSnapshotString,
    name, category, tagline, contentRating, containsAds, inAppPurchases, interactiveElements, tags,
    platform, packageFormat, targetOs, supportedArchitectures, minRam, version, versionName, versionCode, downloadUrl, assetName, assetSize,
    sha256, minAndroid, changelog, iconUrl, featureGraphicUrl, detailsBannerUrl, heroBannerUrl, featureOnSpotlight,
    spotlightBadge, spotlightHeadline, screenshotsList, tabletScreenshotsList,
    desktopScreenshotsList, promoVideoUrl, videoThumbnailUrl, description,
    dataSafetySummary, dataSafetyOverview, safetyHighlights, dataShared,
    sharesDataWithThirdParties, dataSharedDetails,
    customDataCollected, permissionsRequired,
    permCamera, permLocation, permMicrophone, permTelephone, permStorage, permOther,
    dataDeletionPolicy,
    developerEmail, websiteUrl, githubRepoUrl, privacyPolicyUrl, termsAndConditionsUrl,
    developerAddress, githubUrl
  ]);

  const hasFormChanged = useMemo(() => {
    if (!editingAppId) return true;
    if (!initialAppSnapshot) return false;
    return initialAppSnapshot !== currentFormSnapshot;
  }, [editingAppId, initialAppSnapshot, currentFormSnapshot]);

  const hasFormContent = useCallback((): boolean => {
    // If updating an existing app, only report content/draft if genuine changes were made
    if (editingAppId) {
      return Boolean(hasFormChanged);
    }
    if (step > 1) return true;
    if (name && name.trim()) return true;
    if (downloadUrl && downloadUrl.trim()) return true;
    if (githubUrl && githubUrl.trim()) return true;
    if (tagline && tagline.trim()) return true;
    if (description && description.trim()) return true;
    if (iconUrl && iconUrl.trim()) return true;
    if (changelog && changelog.trim()) return true;
    return false;
  }, [step, name, downloadUrl, githubUrl, tagline, description, iconUrl, changelog, editingAppId, hasFormChanged]);

  const currentDraftData = useMemo(() => ({
    step,
    editingAppId,
    initialAppSnapshot,
    name,
    developerName,
    developerEmail,
    githubRepoOwner,
    category,
    tagline,
    contentRating,
    containsAds,
    inAppPurchases,
    tags,
    platform,
    packageFormat,
    targetOs,
    version,
    versionName,
    versionCode,
    downloadUrl,
    assetName,
    assetSize,
    detectedDownloadsCount,
    sha256,
    minAndroid,
    releaseDate,
    initialReleaseDate,
    changelog,
    iconUrl,
    featureGraphicUrl,
    detailsBannerUrl,
    heroBannerUrl,
    featureOnSpotlight,
    spotlightBadge,
    spotlightHeadline,
    screenshotsList,
    tabletScreenshotsList,
    desktopScreenshotsList,
    promoVideoUrl,
    videoThumbnailUrl,
    description,
    dataSafetySummary,
    dataSafetyOverview,
    safetyHighlights,
    dataShared,
    customDataCollected,
    permissionsRequired,
    permCamera,
    permLocation,
    permMicrophone,
    permTelephone,
    permStorage,
    permOther,
    dataDeletionPolicy,
    githubUrl,
    privacyPolicyUrl,
    termsAndConditionsUrl,
    websiteUrl,
    githubRepoUrl,
    developerAddress,
    supportedArchitectures,
    supportedArchitecturesInput,
    minRam,
    sharesDataWithThirdParties,
    dataSharedDetails,
    savedAt: new Date().toISOString()
  }), [
    step, editingAppId, initialAppSnapshot, name, developerName, developerEmail, githubRepoOwner,
    category, tagline, contentRating, containsAds, inAppPurchases, tags, platform, packageFormat,
    targetOs, version, versionName, versionCode, downloadUrl, assetName, assetSize,
    detectedDownloadsCount, sha256, minAndroid, releaseDate, initialReleaseDate, changelog,
    iconUrl, featureGraphicUrl, detailsBannerUrl, heroBannerUrl, featureOnSpotlight,
    spotlightBadge, spotlightHeadline, screenshotsList, tabletScreenshotsList,
    desktopScreenshotsList, promoVideoUrl, videoThumbnailUrl, description, dataSafetySummary,
    dataSafetyOverview, safetyHighlights, dataShared, customDataCollected,
    permissionsRequired,
    permCamera, permLocation, permMicrophone, permTelephone, permStorage, permOther,
    dataDeletionPolicy, githubUrl, privacyPolicyUrl,
    termsAndConditionsUrl, websiteUrl, githubRepoUrl, developerAddress,
    supportedArchitectures, supportedArchitecturesInput, minRam, sharesDataWithThirdParties, dataSharedDetails
  ]);

  const currentDraftRef = useRef(currentDraftData);
  currentDraftRef.current = currentDraftData;

  const isPublishOpenRef = useRef(isPublishOpen);
  isPublishOpenRef.current = isPublishOpen;
  const isDiscardedRef = useRef(false);
  const showCancelModalRef = useRef(showCancelModal);
  showCancelModalRef.current = showCancelModal;

  const persistDraftLocally = useCallback(() => {
    if (!currentDraftRef.current || isDiscardedRef.current || !isPublishOpenRef.current) return;
    if (!hasFormContent()) return;
    const draft = currentDraftRef.current;
    const devId = (user?.uid || auth.currentUser?.uid || (user?.email ? user.email.toLowerCase().trim() : 'guest')).trim();

    // If updating an existing app, NEVER save draft if no genuine changes were made
    if (draft.editingAppId && !hasFormChanged) {
      return;
    }

    try {
      if (draft.editingAppId) {
        // App update draft is isolated strictly to this specific app ID
        localStorage.setItem(`prople_draft_update_app_${draft.editingAppId}`, JSON.stringify(draft));
        localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'update', appId: draft.editingAppId, devId }));
      } else {
        // New app draft is isolated strictly to new app creation
        localStorage.setItem(`prople_draft_new_app_${devId}`, JSON.stringify(draft));
        localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'new', devId }));
      }
      localStorage.setItem('prople_publish_form_open', 'true');
      sessionStorage.setItem('prople_publish_in_edit_session', 'true');
      setSavedNewAppDraft(getSavedNewAppDraft(devId));
      setUpdateDraftsVersion(v => v + 1);
    } catch (err) {
      console.warn('Failed to auto-save draft', err);
    }
  }, [user, hasFormChanged, hasFormContent]);

  // Track isPublishOpen in storage so in-tab refresh cleanly maintains the editing session
  useEffect(() => {
    if (isPublishOpen) {
      isDiscardedRef.current = false;
      try {
        const devId = (user?.uid || auth.currentUser?.uid || (user?.email ? user.email.toLowerCase().trim() : 'guest')).trim();
        if (editingAppId) {
          localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'update', appId: editingAppId, devId }));
        } else {
          localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'new', devId }));
        }
        localStorage.setItem('prople_publish_form_open', 'true');
        sessionStorage.setItem('prople_publish_in_edit_session', 'true');
      } catch {}
    } else {
      try {
        localStorage.removeItem('prople_publish_form_open');
        sessionStorage.removeItem('prople_publish_in_edit_session');
      } catch {}
    }
  }, [isPublishOpen, editingAppId, user]);

  // Intercept phone back button, Android gesture back, and in-app back via NavigationContext:
  // Native back will ask for confirmation if there are unsaved modifications, without breaking history.
  useEffect(() => {
    if (!isPublishOpen) return;

    const unregister = registerBackHandler(() => {
      // If user already discarded, do not intercept
      if (isDiscardedRef.current) return false;

      // If the discard confirmation modal is already active, dismiss the modal and stay in form
      if (showCancelModalRef.current) {
        setShowCancelModal(false);
        return true;
      }

      // If user is editing an app and has made NO modifications, exit cleanly without confirmation
      if (editingAppId && !hasFormChanged) {
        isDiscardedRef.current = true;
        deleteSavedUpdateDraft(editingAppId);
        setIsPublishOpen(false);
        resetAllFormState();
        return true;
      }

      const currentHasContent = hasFormContent();
      const existingDraft = editingAppId
        ? getSavedUpdateDraft(editingAppId)
        : getSavedNewAppDraft(currentDevId);

      // If there is no draft content at all and no existing draft, simply exit without modal
      if (!currentHasContent && !existingDraft) {
        isDiscardedRef.current = true;
        if (editingAppId) {
          deleteSavedUpdateDraft(editingAppId);
        } else {
          deleteSavedNewAppDraft(currentDevId);
        }
        setIsPublishOpen(false);
        resetAllFormState();
        return true;
      }

      // Show confirmation dialog without prematurely forcing an auto-save
      setShowCancelModal(true);
      return true;
    });

    return unregister;
  }, [isPublishOpen, registerBackHandler, editingAppId, hasFormChanged, hasFormContent, resetAllFormState, currentDevId]);

  // Auto-save draft on tab switch or visibility change; show prompt on beforeunload
  useEffect(() => {
    if (!isPublishOpen) return;

    const handleAutoSave = () => {
      if (!isDiscardedRef.current && hasFormContent()) {
        persistDraftLocally();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleAutoSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDiscardedRef.current && hasFormContent()) {
        persistDraftLocally();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleAutoSave);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleAutoSave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPublishOpen, hasFormContent, persistDraftLocally]);

  // Continuous auto-save while developer is actively typing
  useEffect(() => {
    if (!isPublishOpen || isDiscardedRef.current || !hasFormContent()) return;

    const timer = setTimeout(() => {
      persistDraftLocally();
    }, 1500);

    return () => clearTimeout(timer);
  }, [isPublishOpen, currentDraftData, hasFormContent, persistDraftLocally]);

  // Helper to auto-resolve downloadUrl to direct binary / APK
  const handleResolveApk = async (targetUrlOverride?: string) => {
    const urlToResolve = (targetUrlOverride || downloadUrl || githubUrl).trim();
    if (!urlToResolve) {
      showToast('Please enter a URL to resolve');
      return;
    }

    setIsResolvingApk(true);
    try {
      const { ok, data } = await safeFetchJson<any>(`/api/resolve-apk?url=${encodeURIComponent(urlToResolve)}${platform ? `&platform=${encodeURIComponent(platform)}` : ''}`);
      if (!ok || !data) {
        throw new Error('Could not resolve release binary package');
      }
      if (data.success && (data.isBinary || data.isApk || data.isWindows || data.isLinux || data.resolvedUrl)) {
        setDownloadUrl(data.resolvedUrl);
        const resolvedName = data.assetName || data.resolvedUrl.split('/').pop()?.split('?')[0] || 'package-release';
        setAssetName(resolvedName);
        if (data.tagName && (!version || version === 'v1.0.0')) {
          setVersion(data.tagName);
          setVersionName(data.tagName.replace(/^v/i, ''));
        }
        if (data.sizeFormatted) setAssetSize(data.sizeFormatted);
        const detected = inferPlatformAndFormat(resolvedName || data.resolvedUrl);
        setPlatform(detected.platform);
        setPackageFormat(detected.packageFormat as any);
        setMinAndroid(detected.minRequirement);
        setTargetOs(detected.targetOs);
        const packageTypeLabel = formatPackageTypeName(data.format || detected.packageFormat, data.platform || detected.platform, resolvedName);
        showToast(`Resolved ${packageTypeLabel}: ${resolvedName} (${data.sizeFormatted || 'Ready'})`);
      } else if (data.success && !data.isBinary && !data.resolvedUrl) {
        showToast('No installable binary package found in this release.');
      } else {
        showToast(data.error || 'Could not resolve direct binary link');
      }
    } catch (err: any) {
      console.warn('Resolve APK error:', err);
      showToast('Could not resolve link automatically');
    } finally {
      setIsResolvingApk(false);
    }
  };

  const handleTestDownload = async () => {
    if (!downloadUrl.trim()) {
      showToast('Please enter a download URL first');
      return;
    }
    setIsTestingDownload(true);
    showToast('Testing direct package download...');
    const defaultExt = platform === 'ios' ? '.ipa' : platform === 'linux' ? '.AppImage' : platform === 'windows' ? '.exe' : '.apk';
    const safeName = assetName || (downloadUrl.split('/').pop()?.split('?')[0]) || `test-package${defaultExt}`;
    
    const success = await triggerBrowserApkDownload(downloadUrl.trim(), safeName, name, (err) => {
      showToast(err);
    }, platform);
    if (success) {
      showToast('Download started directly in current window');
    }
    setIsTestingDownload(false);
  };

  // Dynamic auto-detect from GitHub Release URL using appMetricsAlgorithm (GitHub Releases Only)
  const handleFetchGithubRelease = async () => {
    if (!githubUrl.trim()) {
      showToast('Please enter an official GitHub Release URL');
      return;
    }

    const cleanUrl = githubUrl.trim();
    if (!cleanUrl.toLowerCase().includes('github.com')) {
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        // Direct package download link provided by the user
        const baseName = decodeURIComponent(cleanUrl.split('?')[0].split('#')[0].split('/').pop() || 'app.apk').trim();
        const rawTitle = baseName.replace(/\.[^/.]+$/, '').split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        setName(rawTitle || 'My Application');
        setDownloadUrl(cleanUrl);
        setAssetName(baseName);
        const detected = inferPlatformAndFormat(baseName);
        setPlatform(detected.platform);
        setPackageFormat(detected.packageFormat as any);
        setMinAndroid(detected.minRequirement);
        setTargetOs(detected.targetOs);
        setVersion('v1.0.0');
        setVersionName('1.0.0');
        setDeveloperName(currentGoogleName);
        setDeveloperEmail(currentGoogleEmail);
        setGithubRepoUrl(cleanUrl);
        showToast(`Package recognized (${baseName})! Proceeding to Step 2 to configure app details.`);
        setStep(2);
        return;
      } else {
        showToast('Please enter an official GitHub Release URL or direct package download URL (HTTP/HTTPS).');
        return;
      }
    }

    const cleanPath = cleanUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
    const parts = cleanPath.split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      showToast('Invalid GitHub URL: Please include both owner and repository name');
      return;
    }
    const repoOwner = parts[0];
    const repoName = parts[1];

    // Check if the GitHub profile holder or release link is banned
    setReleaseUrlError(null);
    const banCheck = AdminModerationService.checkIfUrlOrProfileBanned(cleanUrl);
    if (banCheck.isBanned) {
      const reasonMsg = banCheck.reason ? ` Reason: ${banCheck.reason}` : '';
      if (banCheck.bannedType === 'profile') {
        showToast(`Rejected: GitHub user profile @${banCheck.matchedTarget || repoOwner} has been banned from publishing releases on this platform.${reasonMsg}`, { type: 'error', duration: 6000 });
        setReleaseUrlError(`Rejected: The GitHub profile holder (@${banCheck.matchedTarget || repoOwner}) has been banned from this platform. Releases from this profile cannot be fetched or published.${reasonMsg}`);
      } else {
        showToast(`Rejected: This release link has been banned from this platform.${reasonMsg}`, { type: 'error', duration: 6000 });
        setReleaseUrlError(`Rejected: This specific release link has been banned from this platform due to safety policies.${reasonMsg}`);
      }
      return;
    }

    setIsFetchingRelease(true);
    
    try {
      const isDirectBinary = cleanUrl.includes('/releases/download/') || isBinaryFileName(cleanUrl);
      
      let tagFromUrl: string | undefined;
      let directFileName: string | undefined;

      if (cleanUrl.includes('/releases/download/')) {
        const after = cleanUrl.split('/releases/download/')[1]?.split('/');
        tagFromUrl = after?.[0];
        directFileName = after?.[1]?.split('?')[0];
      } else if (cleanUrl.includes('/releases/tag/')) {
        tagFromUrl = cleanUrl.split('/releases/tag/')[1]?.split('/')[0]?.split('?')[0];
      }

      const formattedName = repoName
        .split(/[-_]/)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');

      setName(formattedName || '');
      // Store upstream GitHub repo owner for non-editable transparency display
      setGithubRepoOwner(repoOwner);
      // Publisher name is strictly locked to authenticated Google account; never use GitHub repo name
      setDeveloperName(currentGoogleName);
      setDeveloperEmail(currentGoogleEmail);
      // Remove hardcoded prefilled text: keep tagline, description, and tags empty so only placeholders show unless real data exists
      setTagline('');
      setDescription('');
      setTags('');
      setGithubRepoUrl(`https://github.com/${repoOwner}`);
      setWebsiteUrl('');

      // If direct binary was pasted, set downloadUrl immediately and auto-detect platform & format
      if (isDirectBinary) {
        setDownloadUrl(cleanUrl);
        const inferredName = directFileName || cleanUrl.split('/').pop()?.split('?')[0] || `${repoName}.apk`;
        setAssetName(inferredName);
        setVersion(tagFromUrl || 'v1.0.0');
        setVersionName((tagFromUrl || '1.0.0').replace(/^v/i, ''));
        const detected = inferPlatformAndFormat(inferredName || cleanUrl);
        setPlatform(detected.platform);
        setPackageFormat(detected.packageFormat as any);
        setMinAndroid(detected.minRequirement);
        setTargetOs(detected.targetOs);
      }

      // Pre-infer requested platform from URL or direct filename to avoid defaulting to android
      const initialInferred = inferPlatformAndFormat(directFileName || cleanUrl);
      const requestedPlat = (isDirectBinary || cleanUrl.includes('ios') || cleanUrl.includes('ipa') || cleanUrl.includes('linux') || cleanUrl.includes('deb') || cleanUrl.includes('appimage') || cleanUrl.includes('win') || cleanUrl.includes('mac') || cleanUrl.includes('dmg'))
        ? initialInferred.platform
        : undefined;

      // Fetch live metadata via centralized appMetricsAlgorithm
      const meta = await fetchGitHubReleaseMetadata(repoOwner, repoName, tagFromUrl, cleanUrl, requestedPlat);

      if (meta) {
        const finalTag = meta.tagName || tagFromUrl || 'v1.0.0';
        setVersion(finalTag);
        setVersionName(finalTag.replace(/^v/i, ''));
        
        let finalActiveName = '';
        let finalDownloadUrl = '';
        let finalSize = '';
        const defaultExt = platform === 'ios' ? '.ipa' : platform === 'linux' ? '.AppImage' : platform === 'windows' ? '.exe' : '.apk';

        if (isDirectBinary) {
          // Keep user's exact direct download link intact
          finalDownloadUrl = cleanUrl;
          finalActiveName = directFileName || cleanUrl.split('/').pop()?.split('?')[0] || meta.primaryApk?.name || `${repoName}${defaultExt}`;
          finalSize = meta.primaryApk?.sizeFormatted || 'Direct Binary';
        } else if (meta.primaryApk) {
          finalActiveName = meta.primaryApk.name;
          finalDownloadUrl = meta.primaryApk.downloadUrl;
          finalSize = meta.primaryApk.sizeFormatted;
        } else if (meta.assets.length > 0) {
          const bin = meta.assets.find(a => isBinaryFileName(a.name));
          if (bin) {
            finalActiveName = bin.name;
            finalDownloadUrl = bin.downloadUrl;
            finalSize = formatPackageSize(bin.size);
          } else {
            showToast('Warning: No installable binary found in release assets.');
            finalActiveName = '';
            finalDownloadUrl = '';
            finalSize = 'No binary available';
          }
        } else {
          showToast('Notice: No release assets were found in this release.');
          finalActiveName = '';
          finalDownloadUrl = '';
          finalSize = 'No binary available';
        }

        const detected = inferPlatformAndFormat(finalActiveName || finalDownloadUrl || cleanUrl);
        setAssetName(finalActiveName);
        setDownloadUrl(finalDownloadUrl);
        setAssetSize(finalSize);
        setPlatform(detected.platform);
        setPackageFormat(detected.packageFormat as any);
        setMinAndroid(detected.minRequirement);
        setTargetOs(detected.targetOs);

        if (meta.totalDownloads > 0) {
          setDetectedDownloadsCount(meta.totalDownloads);
        }

        if (meta.publishedAt) {
          const formattedDate = new Date(meta.publishedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          setReleaseDate(formattedDate);
          setInitialReleaseDate(formattedDate);
        } else {
          const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          setReleaseDate(nowStr);
          setInitialReleaseDate(nowStr);
        }

        const packageTypeLabel = formatPackageTypeName(detected.packageFormat, detected.platform, finalActiveName);

        if (meta.body && meta.body.trim().length > 0) {
          setChangelog(meta.body.slice(0, 200));
        } else {
          setChangelog('');
        }

        const targetBinary = finalActiveName || directFileName || cleanUrl;
        const extractedSha = meta.sha256 || meta.primaryApk?.sha256 || extractSha256FromText(meta.body || '', targetBinary) || computeDeterministicSha256(`${repoOwner}/${repoName}:${finalTag}:${targetBinary || 'package'}`);
        setSha256(extractedSha);

        const sizeSnippet = (finalSize && finalSize !== 'No binary available' && finalSize !== 'Direct Binary' && finalSize !== 'Varies with device') ? ` • ${finalSize}` : '';
        showToast(`Fetched ${finalTag}: ${packageTypeLabel} (${finalActiveName}${sizeSnippet})`);
      } else {
        // When no binary release asset is found from GitHub API
        const detectedTag = tagFromUrl || 'v1.0.0';
        setVersion(detectedTag);
        setVersionName(detectedTag.replace(/^v/i, ''));
        
        let targetName = '';
        if (isDirectBinary) {
          const directName = directFileName || cleanUrl.split('/').pop()?.split('?')[0] || `app-${detectedTag}.apk`;
          targetName = directName;
          const detected = inferPlatformAndFormat(directName || cleanUrl);
          setAssetName(directName);
          setDownloadUrl(cleanUrl);
          setAssetSize('Direct Binary');
          setPlatform(detected.platform);
          setPackageFormat(detected.packageFormat as any);
          setMinAndroid(detected.minRequirement);
          setTargetOs(detected.targetOs);
          const packageTypeLabel = formatPackageTypeName(detected.packageFormat, detected.platform, directName);
          showToast(`Fetched ${detectedTag}: ${packageTypeLabel} (${directName})`);
        } else {
          // Zero bloat fallback files: do NOT set downloadUrl to a GitHub webpage or repo URL
          setAssetName('');
          setDownloadUrl('');
          setAssetSize('');
          showToast('No exact binary release asset found. Please enter direct package URL in Step 3.');
        }

        const directTarget = targetName || cleanUrl;
        const fallbackSha = computeDeterministicSha256(`${repoOwner}/${repoName}:${detectedTag}:${directTarget || 'binary'}`);
        setSha256(fallbackSha);

        const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        setReleaseDate(nowStr);
        setInitialReleaseDate(nowStr);
        setChangelog('');
      }

      // Do not populate default or horizontal sample images; user uploads their own media
      if (!iconUrl) setIconUrl('');
      setFeatureGraphicUrl('');
      setScreenshotsList([]);
      setTabletScreenshotsList([]);
      
      setStep(2);
    } catch (err) {
      console.warn('GitHub release detection error:', err);
      showToast('Could not fetch release metadata from GitHub. Please check the URL and ensure the release is public and contains installable binaries.');
      // Keep developer on Step 1 to enter a valid GitHub release
    } finally {
      setIsFetchingRelease(false);
    }
  };

  const handleOpenNewPublish = () => {
    if (isPublisherNameConflict) {
      showToast(conflictMessage || 'Your publisher name is already taken. Please change your publisher name to activate publishing.', { type: 'error', duration: 5000 });
      setNewCandidatePublisherName(activePublisherName);
      setShowChangePublisherModal(true);
      return;
    }

    // 1. Fully reset form state first to eliminate any bleed from previous app uploads or edits
    resetAllFormState();
    setEditingAppId(null);
    setInitialAppSnapshot(null);

    // 2. Check if a saved draft specifically for a NEW app exists
    const savedDraft = getSavedNewAppDraft(currentDevId);
    if (savedDraft && isDraftMeaningful(savedDraft)) {
      applyDraftToForm(savedDraft, null);
      try {
        localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'new', devId: currentDevId }));
        localStorage.setItem('prople_publish_form_open', 'true');
        sessionStorage.setItem('prople_publish_in_edit_session', 'true');
      } catch {}
      setIsPublishOpen(true);
      showToast('New app draft restored');
      return;
    }

    // 3. Open pristine new app publish form
    try {
      localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'new', devId: currentDevId }));
      localStorage.setItem('prople_publish_form_open', 'true');
      sessionStorage.setItem('prople_publish_in_edit_session', 'true');
    } catch {}
    setIsPublishOpen(true);
  };

  const handleDiscardNewAppDraft = () => {
    deleteSavedNewAppDraft(currentDevId);
    setSavedNewAppDraft(null);
    setUpdateDraftsVersion(v => v + 1);
    showToast('Draft discarded');
  };

  const handleOpenEditApp = (app: AppDetails) => {
    if (!canUserManageApp(app)) {
      showToast('Permission denied: You can only edit apps published by your account.');
      return;
    }

    setShowCancelModal(false);

    // 1. Reset all form state first to eliminate any bleed from other drafts or apps
    resetAllFormState();

    // 2. Lock editingAppId strictly to this app
    setEditingAppId(app.id);

    // 3. Populate form freshly from published app
    populateFormFromApp(app);

    try {
      localStorage.setItem('prople_publish_form_session', JSON.stringify({ type: 'update', appId: app.id, devId: currentDevId }));
      localStorage.setItem('prople_publish_form_open', 'true');
    } catch {}
    setIsPublishOpen(true);
  };

  const handlePublishApp = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // Check if any mandatory steps or fields were skipped or incomplete
    const missingSteps = getPublishingMissingSteps();
    if (missingSteps.length > 0) {
      // Change publish button icon state to warning and notify with toast
      setPublishButtonState('warning');
      const firstMissing = missingSteps[0];
      showToast(firstMissing.message, { type: 'warning', duration: 4500 });
      // Guide user directly to the missing step and specific incomplete section
      navigateToStepAndSection(firstMissing.step, firstMissing.targetId);
      return;
    }

    // Check if the release link or profile is banned before publishing
    const banCheck = AdminModerationService.checkIfUrlOrProfileBanned(githubUrl || downloadUrl);
    if (banCheck.isBanned) {
      const reasonMsg = banCheck.reason ? ` Reason: ${banCheck.reason}` : '';
      showToast(
        banCheck.bannedType === 'profile'
          ? `Rejected: GitHub user profile @${banCheck.matchedTarget || 'user'} is banned from publishing on this platform.${reasonMsg}`
          : `Rejected: This release link is banned from this platform.${reasonMsg}`,
        { type: 'error', duration: 6000 }
      );
      setReleaseUrlError(
        banCheck.bannedType === 'profile'
          ? `Rejected: The GitHub profile holder (@${banCheck.matchedTarget || 'user'}) has been banned from this platform.${reasonMsg}`
          : `Rejected: This release link has been banned from this platform.${reasonMsg}`
      );
      navigateToStepAndSection(1, 'input-github-release-url');
      return;
    }

    // Do not proceed if user is updating an existing app without making any changes
    if (editingAppId && !hasFormChanged) {
      showToast('No modifications detected. Modify any details before publishing an update.', { type: 'warning' });
      return;
    }

    let finalSha256 = sha256.trim();
    if (!finalSha256 || finalSha256.length < 64) {
      finalSha256 = computeDeterministicSha256(`${name}:${versionName || version || 'v1'}:${assetName || downloadUrl || 'app'}`);
      setSha256(finalSha256);
    }

    const currentUid = auth.currentUser?.uid || user?.uid;
    if (!currentUid) {
      showToast('Authentication required: Please sign in with Google or continue to release apps.', { type: 'warning' });
      try {
        await loginWithGoogle();
      } catch (err) {
        console.warn('Sign-in prompt dismissed', err);
      }
      return;
    }

    // The exhaustion period only for new app publish; let user update apps frequently with 5 updates per 1 hour
    if (!editingAppId) {
      const quotaCheck = getPublishQuotaStatus(currentUid);
      if (quotaCheck.isExhausted) {
        showToast(`Publishing exhaustion active: Maximum 3 apps per 15 minutes reached. Cooldown opens in ${quotaCheck.nextAvailableTimeFormatted}.`, { type: 'warning' });
        return;
      }
    } else {
      const updateCheck = getUpdateQuotaStatus(currentUid, editingAppId);
      if (updateCheck.isExhausted) {
        showToast(`Update limit reached: Maximum 5 updates per 1 hour reached. Next update available in ${updateCheck.nextAvailableTimeFormatted}.`, { type: 'warning' });
        return;
      }
    }

    // Step 1: Change publish button state to processing and display initial processing toast
    setPublishButtonState('publishing');
    setIsPublishing(true);
    showToast(
      editingAppId 
        ? 'Updating application... Processing verification and store deployment' 
        : 'Publishing application... Processing verification and store deployment', 
      { type: 'info', duration: 3000 }
    );

    try {
      const isUpdateMode = Boolean(editingAppId && appsList.some(a => a.id === editingAppId));
      const appId = isUpdateMode ? (editingAppId as string) : `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const finalScreenshots = screenshotsList;

      // Ensure downloadUrl is a direct binary package link before publishing
      let finalApkDownloadUrl = downloadUrl.trim();
      let finalApkAssetName = assetName || (finalApkDownloadUrl ? decodeURIComponent(finalApkDownloadUrl.split('?')[0].split('#')[0].split('/').pop() || '').trim() : '');

      if (finalApkDownloadUrl && !isBinaryFileName(finalApkDownloadUrl) && finalApkDownloadUrl.includes('github.com')) {
        try {
          const { ok, data } = await safeFetchJson<any>(`/api/resolve-apk?url=${encodeURIComponent(finalApkDownloadUrl)}&platform=${encodeURIComponent(platform)}`);
          if (ok && data?.success && (data.isBinary || data.isApk || data.isWindows || data.isLinux) && data.resolvedUrl) {
            finalApkDownloadUrl = data.resolvedUrl;
            if (data.assetName) finalApkAssetName = data.assetName;
          }
        } catch (e) {
          console.warn('Could not pre-resolve binary package before publishing:', e);
        }
      }

      // Build data safety collected array from user's custom protext declaration
      const dataCollectedList: string[] = customDataCollected.trim()
        ? customDataCollected.split('\n').map(l => l.trim()).filter(Boolean)
        : ['No personal data collected or stored off-device.'];

      // Third-party data sharing declaration
      const finalDataShared = dataShared.trim() || (sharesDataWithThirdParties 
        ? (dataSharedDetails.trim() || 'User data is shared with declared third parties for operational functionality.')
        : 'No data shared with third parties.');

      const existingApp = isUpdateMode ? (appsList.find(a => a.id === editingAppId) || appDetailsMock[editingAppId as string]) : undefined;
      const securityPracticesList: string[] = existingApp?.dataSafety?.securityPractices || existingApp?.securityPractices || [];

      // Ownership enforcement: Verify that the current user owns this app before allowing edits
      if (existingApp && !canUserManageApp(existingApp)) {
        showToast('Permission denied: You can only modify applications owned by your account.');
        setIsPublishing(false);
        return;
      }

      // Download counts: New apps start strictly at 0 downloads (real verified downloads accumulate with 5-minute verification)
      const finalDownloads = existingApp && existingApp.downloads ? existingApp.downloads : '0+';
      const finalDownloadsCount = existingApp && existingApp.downloadsCount !== undefined ? existingApp.downloadsCount : 0;

      const finalPublisherName = user?.publisherName?.trim() || user?.displayName?.trim() || developerName.trim() || currentGoogleName;
      const finalSupportEmail = (user?.email || developerEmail || currentGoogleEmail || '').toLowerCase().trim();
      const finalRepoOwner = githubRepoOwner.trim() || extractGitHubRepoOwner(githubUrl || githubRepoUrl || finalApkDownloadUrl) || '';

      const isOwner = existingApp ? isUserOwnerOfApp(existingApp) : true;
      const targetOwnerUid = (isOwner && currentUid) ? currentUid : (existingApp?.owner || currentUid);

      // Verify publisher name is unique and not claimed by another developer
      if (finalPublisherName && (!existingApp || existingApp.developer?.toLowerCase() !== finalPublisherName.toLowerCase())) {
        const pubCheck = await checkPublisherNameAvailability(finalPublisherName, {
          currentUserId: targetOwnerUid,
          currentUserEmail: finalSupportEmail,
          allApps: appsList
        });
        if (!pubCheck.available && pubCheck.isTaken) {
          showToast(pubCheck.message || 'Publisher name is already registered to another developer. Please update your profile with a unique publisher name.', { type: 'error', duration: 5000 });
          setIsPublishing(false);
          setPublishButtonState('idle');
          return;
        }
      }

      const newApp: AppDetails = {
        ...(existingApp || {}),
        id: appId,
        name: name.trim(),
        developer: finalPublisherName,
        publisherName: finalPublisherName,
        publisherEmail: finalSupportEmail,
        githubRepoOwner: finalRepoOwner,
        developerId: targetOwnerUid,
        developerEmail: finalSupportEmail,
        creatorUid: targetOwnerUid,
        owner: targetOwnerUid,
        ownerEmail: finalSupportEmail,
        publishedBy: finalPublisherName,
        keystoreFingerprint: existingApp?.keystoreFingerprint || user?.developerKeystore?.sha256Fingerprint || '',
        keystoreAlias: existingApp?.keystoreAlias || user?.developerKeystore?.alias || '',
        isPublished: true,
        category: category,
        rating: existingApp && typeof existingApp.rating === 'number' ? existingApp.rating : 0,
        ratingsCount: existingApp && typeof existingApp.ratingsCount === 'number' ? existingApp.ratingsCount : 0,
        reviewsCount: existingApp && existingApp.reviewsCount ? existingApp.reviewsCount : '0 reviews',
        size: assetSize.trim() || 'Varies with device',
        downloads: finalDownloads,
        downloadsCount: finalDownloadsCount,
        contentRating: contentRating || 'Rated for 3+',
        price: price || 'Free',
        containsAds: containsAds,
        inAppPurchases: inAppPurchases,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        iconUrl: iconUrl.trim() || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=240&h=240&fit=crop',
        featureGraphicUrl: featureGraphicUrl.trim(),
        detailsBannerUrl: detailsBannerUrl.trim(),
        heroBannerUrl: heroBannerUrl.trim(),
        tagline: tagline.trim(),
        aboutText: description.trim() || `${name} package distributed securely on the store.`,
        screenshots: finalScreenshots,
        tabletScreenshots: tabletScreenshotsList,
        desktopScreenshots: desktopScreenshotsList,
        promoVideoUrl: promoVideoUrl.trim(),
        videoThumbnailUrl: videoThumbnailUrl.trim(),
        type: 'github_release',
        githubRepo: githubRepoUrl.trim() || '',
        githubReleaseUrl: githubUrl || '',
        website: websiteUrl.trim() || '',
        address: developerAddress.trim() || '',
        privacyPolicy: privacyPolicyUrl.trim(),
        termsAndConditions: termsAndConditionsUrl.trim(),
        termsOfService: termsAndConditionsUrl.trim(),
        downloadUrl: finalApkDownloadUrl,
        releaseTag: version || (versionName ? `v${versionName}` : 'v1.0.0'),
        versionName: versionName || (version ? version.replace(/^v/i, '') : '1.0.0'),
        versionCode: versionCode || '1',
        assetName: finalApkAssetName,
        sha256: sha256.trim(),
        releaseNotes: (changelog || 'Initial release.').trim(),
        releaseDate: releaseDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        initialReleaseDate: initialReleaseDate || releaseDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        platform: platform || (finalApkAssetName ? inferPlatformAndFormat(finalApkAssetName).platform : 'android'),
        packageFormat: packageFormat || (finalApkAssetName ? (inferPlatformAndFormat(finalApkAssetName).packageFormat as any) : 'apk'),
        targetOs: targetOs || minAndroid || (platform === 'mac' ? 'macOS 12.0 or later' : platform === 'linux' ? 'Linux (Debian, Ubuntu, Fedora, Arch)' : platform === 'windows' ? 'Windows 10, 11 (64-bit)' : 'Android 8.0 and up'),
        minAndroid: minAndroid || (platform === 'mac' ? 'macOS 12.0 or later' : platform === 'linux' ? 'Linux (Debian, Ubuntu, Fedora, Arch)' : platform === 'windows' ? 'Windows 10, 11 (64-bit)' : 'Android 8.0 and up'),
        interactiveElements: interactiveElements.length > 0 ? interactiveElements : [],
        supportedArchitectures: supportedArchitectures.length > 0 ? supportedArchitectures : [],
        minRam: minRam.trim(),
        permissions: permissionsRequired.length > 0 ? permissionsRequired : [],
        permissionGroups: activePermissionIds.map(id => {
          const catalogItem = ALL_PERMISSION_CATALOG.find(c => c.id === id);
          const customItem = customPermissionCategories.find(c => c.id === id);
          const catName = catalogItem?.name || customItem?.name || id;
          return {
            id,
            name: catName,
            items: parseBulletPoints(getPermissionValue(id)),
          };
        }).filter(g => g.items.length > 0 && !(g.items.length === 1 && g.items[0].toLowerCase() === 'no access required')),
        dataSafety: {
          summaryText: dataSafetySummary.trim(),
          overview: dataSafetyOverview.trim() || '',
          highlights: safetyHighlights.length > 0 ? safetyHighlights : [],
          dataShared: finalDataShared,
          dataSharedDetails: dataSharedDetails.trim(),
          sharesDataWithThirdParties: sharesDataWithThirdParties,
          dataCollected: dataCollectedList || [],
          securityPractices: securityPracticesList || [],
          permissions: permissionsRequired.length > 0 ? permissionsRequired : [],
          permissionGroups: activePermissionIds.map(id => {
            const catalogItem = ALL_PERMISSION_CATALOG.find(c => c.id === id);
            const customItem = customPermissionCategories.find(c => c.id === id);
            const catName = catalogItem?.name || customItem?.name || id;
            return {
              id,
              name: catName,
              items: parseBulletPoints(getPermissionValue(id)),
            };
          }).filter(g => g.items.length > 0 && !(g.items.length === 1 && g.items[0].toLowerCase() === 'no access required')),
          deletionPolicy: dataDeletionPolicy.trim() || '',
        },
        developerInfo: {
          github: githubRepoUrl.trim() || '',
          website: websiteUrl.trim() || '',
          email: finalSupportEmail,
          privacyPolicy: privacyPolicyUrl.trim(),
          termsAndConditions: termsAndConditionsUrl.trim(),
          termsOfService: termsAndConditionsUrl.trim(),
          address: developerAddress.trim() || '',
          githubRepoOwner: finalRepoOwner,
          publisherName: finalPublisherName
        }
      };

      // Publish directly to Firestore and feature on Spotlight globally
      await publishApp(
        newApp, 
        featureOnSpotlight, 
        spotlightBadge.trim() || 'Featured Release', 
        spotlightHeadline.trim() || tagline.trim() || `Experience ${name.trim()} on your device.`
      );

      // Record quota usage: exhaustion period for new releases, 5/hr tracker for updates
      if (!editingAppId) {
        recordPublishEvent(currentUid);
        setPublishQuota(getPublishQuotaStatus(currentUid));
      } else {
        recordUpdateEvent(currentUid, editingAppId);
        setUpdateQuota(getUpdateQuotaStatus(currentUid, editingAppId));
      }

      // Link app ID with the authenticated developer's profile
      if (user && user.uid) {
        const currentIds = user.publishedAppIds || [];
        if (!currentIds.includes(appId)) {
          updateUserProfile({
            publishedAppIds: [...currentIds, appId],
            isPublisher: true
          });
        }
      }

      setPublishButtonState('success');
      if (editingAppId) {
        showToast(`"${newApp.name}" updated successfully! App is now live on Prople Store.`, { type: 'success', duration: 4000 });
      } else {
        showToast(`"${newApp.name}" published successfully! App is now live on Prople Store.`, { type: 'success', duration: 4000 });
      }


      // Clear the published app's draft and active session
      isDiscardedRef.current = true;
      try {
        if (editingAppId) {
          deleteSavedUpdateDraft(editingAppId);
        } else {
          deleteSavedNewAppDraft(currentDevId);
        }
        localStorage.removeItem('prople_publish_form_session');
        localStorage.removeItem('prople_publish_form_open');
      } catch (e) {
        // ignore
      }

      // Return immediately to published app lists with pristine clean state for subsequent back-to-back uploads
      resetAllFormState();
      setSavedNewAppDraft(getSavedNewAppDraft(currentDevId));
      setUpdateDraftsVersion(v => v + 1);
      setIsPublishOpen(false);
    } catch (err: any) {
      console.error('Error publishing app:', err);
      setPublishButtonState('warning');
      showToast(`Publishing failed: ${err?.message || 'Please check your connection and try again.'}`, { type: 'error', duration: 5000 });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteApp = (id: string, appTitle: string) => {
    const app = appsList.find(a => a.id === id);
    if (app && !canUserManageApp(app)) {
      showToast('Permission denied: You can only remove apps owned by your account.');
      return;
    }
    setAppToDelete({ id, name: appTitle });
  };

  const confirmDeleteApp = async () => {
    if (!appToDelete) return;
    const target = { ...appToDelete };
    // Immediately close confirmation pop up so user is not blocked
    setAppToDelete(null);

    const app = appsList.find(a => a.id === target.id);
    if (app && !canUserManageApp(app)) {
      showToast('Permission denied: You can only remove apps owned by your account.', { type: 'error' });
      return;
    }

    showToast(`Deleting "${target.name}" from store...`, { type: 'info', duration: 3000 });

    try {
      const activeUid = user?.uid || auth.currentUser?.uid;
      const activeEmail = user?.email || auth.currentUser?.email;
      await deleteApp(target.id, activeUid, activeEmail);
      deleteSavedUpdateDraft(target.id);
      if (editingAppId === target.id) {
        setEditingAppId(null);
        setIsPublishOpen(false);
        resetAllFormState();
      }
      setUpdateDraftsVersion(v => v + 1);

      if (user && user.publishedAppIds) {
        updateUserProfile({
          publishedAppIds: user.publishedAppIds.filter(id => id !== target.id)
        });
      }
      showToast(`Removed "${target.name}" from Store`, { type: 'success' });
    } catch (err) {
      console.error('Error deleting app:', err);
      showToast(`Failed to delete "${target.name}". Please try again.`, { type: 'error' });
    }
  };

  const handleCancelPublish = () => {
    // 1. If updating an existing app and nothing was modified, exit cleanly
    if (editingAppId && !hasFormChanged) {
      isDiscardedRef.current = true;
      deleteSavedUpdateDraft(editingAppId);
      setShowCancelModal(false);
      setIsPublishOpen(false);
      resetAllFormState();
      return;
    }

    const currentHasContent = hasFormContent();
    const existingDraft = editingAppId
      ? getSavedUpdateDraft(editingAppId)
      : getSavedNewAppDraft(currentDevId);

    // 2. If nothing was entered and no saved draft exists in storage, exit cleanly
    if (!currentHasContent && !existingDraft) {
      isDiscardedRef.current = true;
      if (editingAppId) {
        deleteSavedUpdateDraft(editingAppId);
      } else {
        deleteSavedNewAppDraft(currentDevId);
      }
      setShowCancelModal(false);
      setIsPublishOpen(false);
      resetAllFormState();
      return;
    }

    // 3. Prompt user with Discard / Save as draft options without saving prematurely
    setShowCancelModal(true);
  };

  const handleSaveDraft = () => {
    persistDraftLocally();
    try {
      localStorage.removeItem('prople_publish_form_open');
      localStorage.removeItem('prople_publish_form_session');
      sessionStorage.removeItem('prople_publish_in_edit_session');
    } catch {}
    showToast(editingAppId ? 'Update draft saved successfully' : 'Draft saved successfully');
    setShowCancelModal(false);
    setIsPublishOpen(false);
    resetAllFormState();
    setSavedNewAppDraft(getSavedNewAppDraft(currentDevId));
    setUpdateDraftsVersion(v => v + 1);
  };

  const handleDiscardDraft = () => {
    isDiscardedRef.current = true;
    try {
      if (editingAppId) {
        deleteSavedUpdateDraft(editingAppId);
      } else {
        deleteSavedNewAppDraft(currentDevId);
      }
      localStorage.removeItem('prople_publish_form_session');
      localStorage.removeItem('prople_publish_form_open');
      sessionStorage.removeItem('prople_publish_in_edit_session');
    } catch (err) {
      // ignore
    }
    showToast(editingAppId ? 'Update changes discarded' : 'Draft discarded');
    setShowCancelModal(false);
    setIsPublishOpen(false);
    resetAllFormState();
    setSavedNewAppDraft(null);
    setUpdateDraftsVersion(v => v + 1);
  };

  const filteredApps = React.useMemo(() => {
    let result = displayableApps.filter(app => {
      // Category filter
      if (selectedCategory !== 'All categories') {
        if (!doesAppMatchCategory(app as any, app, selectedCategory, false)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matches = (
          app.name.toLowerCase().includes(query) ||
          app.developer.toLowerCase().includes(query) ||
          app.category.toLowerCase().includes(query) ||
          (app.tags && app.tags.some(t => t.toLowerCase().includes(query))) ||
          (app.releaseTag && app.releaseTag.toLowerCase().includes(query)) ||
          (app.versionName && app.versionName.toLowerCase().includes(query))
        );
        if (!matches) return false;
      }

      return true;
    });

    // Top charts sort & ranking filters
    if (selectedTopFilter === 'Top rated') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (selectedTopFilter === 'Trending') {
      result = [...result].sort((a, b) => {
        const dCountA = a.downloadsCount ?? parseDownloadCount(a.downloads);
        const dCountB = b.downloadsCount ?? parseDownloadCount(b.downloads);
        return dCountB - dCountA;
      });
    } else if (selectedTopFilter === 'New releases') {
      result = [...result].sort((a, b) => {
        const dateA = parseAppTimestampMs((a as any).updatedAt || (a as any).createdAt || a.releaseDate);
        const dateB = parseAppTimestampMs((b as any).updatedAt || (b as any).createdAt || b.releaseDate);
        return dateB - dateA;
      });
    }

    return result;
  }, [displayableApps, searchQuery, selectedCategory, selectedTopFilter]);

  const [hasActivatedDev, setHasActivatedDev] = useState(false);

  // Developer Account Gate: Any authenticated user or active publisher can access Developer Console & publish releases
  const isDeveloperAuthorized = Boolean(
    hasActivatedDev ||
    Boolean(user && user.email) ||
    isPublisher || 
    user?.isPublisher || 
    isDeveloperEmail(user?.email) ||
    isAdmin ||
    isAdminEmail(user?.email)
  );

  const isStudioInitialLoading =
    (isAuthLoading && !user) ||
    (isPublishOpen && editingAppId && (isLoadingApps || !hasInitialSyncCompleted) && appsList.length === 0 && !name);

  if (isStudioInitialLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
        <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 bg-theme-bg shrink-0 gap-3 z-10 w-full border-0">
          <div className="w-full max-w-7xl mx-auto flex items-center gap-2 sm:gap-3 min-w-0 -translate-x-[2px]">
            <button
              type="button"
              onClick={isPublishOpen ? handleCancelPublish : onClose}
              className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors shrink-0 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-[19px] sm:text-[20px] font-medium text-theme-text tracking-tight truncate">
              {isPublishOpen ? (editingAppId ? 'Update App' : 'Publish New App') : 'Developer Console'}
            </h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
          <StoreCircleLoader size="md" />
        </div>
      </div>
    );
  }

  if (!isDeveloperAuthorized && !isPublishOpen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30 animate-in fade-in duration-200">
        <div className="flex flex-col h-full w-full max-w-xl mx-auto bg-theme-bg overflow-hidden">
          {/* Header - Aligned with app header dimensions and positions */}
          <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 bg-theme-bg shrink-0 gap-3 z-10 w-full border-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 -translate-x-[2px]">
              <button 
                id="console-gate-back-btn"
                onClick={onClose} 
                className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors shrink-0 cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-[19px] sm:text-[20px] font-medium text-theme-text tracking-tight truncate">
                Developer Console
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                id="console-gate-info-btn"
                onClick={() => showToast(user ? 'Activate developer mode to start publishing and managing releases.' : 'Sign in with your Google account to get started.')}
                className="w-8 h-8 rounded-full text-theme-text-muted hover:text-theme-text flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Developer Information"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Scrollable Body - Native Mobile Presentation */}
          <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-hide flex flex-col items-center">
            {/* Hero App Logo */}
            <div className="mb-4 mt-2 flex items-center justify-center">
              <BrandLogo size="xl" showText={false} />
            </div>

            {/* Simple Sentence Notice */}
            <p className="text-[12px] font-medium text-theme-text-muted mb-2">
              Developer account required
            </p>

            {/* Headline and Description */}
            <h1 className="text-[22px] font-bold text-theme-text text-center tracking-tight mb-2">
              Publish with Developer Account
            </h1>
            <p className="text-[13px] text-theme-text-muted text-center max-w-sm mb-6 leading-relaxed">
              Apps and releases can only be published and managed with a verified Developer Account. {user ? 'Send an inquiry to register your developer account and access the console.' : 'Sign in with your Google account to access the release console.'}
            </p>

            {/* Feature List - Modern App Store Style */}
            <div className="w-full flex flex-col gap-4 text-left mb-6 px-2">
              <div className="flex items-start gap-3.5">
                <Package className="w-5 h-5 text-theme-text-muted shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-medium text-theme-text">Direct APK & GitHub Releases</h4>
                  <p className="text-[12px] text-theme-text-muted mt-0.5 leading-normal">
                    Upload standalone APK packages or sync versions directly from GitHub releases.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <Shield className="w-5 h-5 text-theme-text-muted shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-medium text-theme-text">Cryptographic Integrity (SHA-256)</h4>
                  <p className="text-[12px] text-theme-text-muted mt-0.5 leading-normal">
                    Automated cryptographic checksum hashing and package security verification.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <LayoutTemplate className="w-5 h-5 text-theme-text-muted shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-medium text-theme-text">Store Listing & Asset Studio</h4>
                  <p className="text-[12px] text-theme-text-muted mt-0.5 leading-normal">
                    Custom screenshots, feature graphics, categorized tags, and data safety disclosure.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <Mail className="w-5 h-5 text-theme-text-muted shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-medium text-theme-text">Developer Support & Feedback</h4>
                  <p className="text-[12px] text-theme-text-muted mt-0.5 leading-normal">
                    Direct developer contact channel and official publisher responses to reviews.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Native Sticky Bottom Action Bar */}
          <div className="p-4 bg-theme-bg border-t border-theme-border/40 shrink-0 w-full flex flex-col items-center gap-2.5 z-10">
            {!user ? (
              <div className="w-full flex flex-col gap-2.5">
                <button
                  id="console-dev-signup-btn"
                  onClick={() => {
                    openAuthPage('signup');
                  }}
                  className="w-full h-[48px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm rounded-full font-semibold text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account / Sign up</span>
                </button>
                <button
                  id="console-dev-signin-btn"
                  onClick={() => {
                    openAuthPage('signin');
                  }}
                  className="w-full h-[44px] bg-transparent hover:bg-theme-surface active:bg-theme-hover text-theme-text border border-theme-border rounded-full font-medium text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-theme-text-muted" />
                  <span>Sign in with existing account</span>
                </button>
                <p className="text-[11px] text-theme-text-muted text-center leading-normal mt-0.5">
                  Sign up or sign in to access developer onboarding and publishing tools.
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-2.5">
                {/* Consent Checkbox for Terms and Conditions & Privacy Policy */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-left w-full">
                  <input
                    type="checkbox"
                    id="console-dev-terms-checkbox"
                    checked={devTermsAgreed}
                    onChange={(e) => {
                      setDevTermsAgreed(e.target.checked);
                      if (devTermsError) setDevTermsError('');
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                  />
                  <span className="text-[12px] text-theme-text-muted leading-tight">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDevTermsReader(true);
                      }}
                      className="text-blue-500 hover:underline font-medium cursor-pointer"
                    >
                      Terms and Conditions
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDevPrivacyReader(true);
                      }}
                      className="text-blue-500 hover:underline font-medium cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>

                {devTermsError && (
                  <p className="text-xs text-red-500 font-medium text-left animate-fadeIn">
                    {devTermsError}
                  </p>
                )}

                <button
                  id="console-dev-continue-btn"
                  onClick={async () => {
                    if (!devTermsAgreed) {
                      setDevTermsError('Please agree to the Terms and Conditions and Privacy Policy to continue.');
                      return;
                    }
                    setDevTermsError('');
                    setIsSubmittingInquiry(true);
                    try {
                      const pubName = (user.publisherName || user.displayName || 'Verified Developer').trim();
                      const check = await checkPublisherNameAvailability(pubName, {
                        currentUserId: user.uid,
                        currentUserEmail: user.email,
                        allApps: appsList
                      });
                      if (!check.available && check.isTaken) {
                        setDevTermsError(`The publisher name "${pubName}" is already claimed by another developer. Please update your publisher name to continue.`);
                        showToast('Your publisher name is already taken. Please change your publisher name to activate publishing.', { type: 'error', duration: 5000 });
                        setNewCandidatePublisherName(pubName);
                        setShowChangePublisherModal(true);
                        setIsSubmittingInquiry(false);
                        return;
                      }

                      setHasActivatedDev(true);
                      if (user?.uid && user?.email) {
                        await claimPublisherName(pubName, user.uid, user.email);
                      }
                      await updateUserProfile({
                        publisherName: pubName,
                        isPublisher: true,
                        publisherRole: isDeveloperEmail(user.email) ? 'Store Administrator' : 'Verified Developer'
                      });
                      togglePublisherStatus(true);
                      showToast('Developer account activated. Welcome to Developer Console!');
                    } catch {
                      showToast('Failed to activate developer privileges. Please try again.');
                    } finally {
                      setIsSubmittingInquiry(false);
                    }
                  }}
                  disabled={isSubmittingInquiry}
                  className="w-full h-[48px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm rounded-full font-medium text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingInquiry ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>Continue</span>
                </button>
                <p className="text-[11px] text-theme-text-muted text-center leading-normal">
                  Signed in as <span className="font-medium text-theme-text">{user.email}</span>.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      openAuthPage('signup');
                    }}
                    className="text-blue-500 hover:underline font-medium cursor-pointer ml-1"
                  >
                    Switch account
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Terms and Conditions Reader Modal */}
          {showDevTermsReader && (
            <div className="fixed inset-0 z-[70]">
              <TermsPage
                onBack={() => setShowDevTermsReader(false)}
                onOpenPrivacy={() => {
                  setShowDevTermsReader(false);
                  setShowDevPrivacyReader(true);
                }}
              />
            </div>
          )}

          {/* Privacy Policy Reader Modal */}
          {showDevPrivacyReader && (
            <div className="fixed inset-0 z-[70]">
              <PrivacyPolicyPage
                onBack={() => setShowDevPrivacyReader(false)}
                onOpenTerms={() => {
                  setShowDevPrivacyReader(false);
                  setShowDevTermsReader(true);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dedicated Publish App Page View
  if (isPublishOpen) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30 animate-in slide-in-from-right duration-200">
        {/* Publish Page Header matching standard App Details Page header layout */}
        <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 bg-theme-bg shrink-0 gap-3 z-20 w-full border-0">
          <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0 max-w-[calc(100%-120px)] sm:max-w-md -translate-x-[2px]">
              <button 
                type="button"
                id="publish-page-back-button"
                onClick={handleCancelPublish} 
                className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                aria-label="Back to App Console"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center min-w-0">
                <h1 className="text-[17px] sm:text-[19px] font-medium text-theme-text tracking-tight truncate font-google-sans">
                  {editingAppId ? 'Update App' : 'Publish New App'}
                </h1>
              </div>
            </div>

            <div className="flex-1"></div>

            <div className="flex items-center gap-2 shrink-0 -translate-x-[4px]">
              <button
                type="button"
                onClick={handleCancelPublish}
                className="text-sm font-medium text-theme-text-muted hover:text-theme-text px-3 py-1.5 rounded-lg hover:bg-theme-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </header>

        {/* Step Wizard Progress Navigation Tabs */}
        <div 
          ref={stepTabsRef}
          className="flex items-center gap-2 px-2.5 sm:px-4 py-2 overflow-x-auto scrollbar-hide shrink-0 w-full max-w-7xl mx-auto"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        >
          {[
            { num: 1, title: 'Release' },
            { num: 2, title: 'App Info' },
            { num: 3, title: 'Package' },
            { num: 4, title: 'Media' },
            { num: 5, title: 'Safety & Legal' },
            { num: 6, title: 'Review' }
          ].map((s) => (
            <button
              key={s.num}
              ref={(el) => {
                stepButtonRefs.current[s.num] = el;
              }}
              type="button"
              onClick={() => {
                handleAttemptStepTab(s.num);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                step === s.num
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : step > s.num
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-theme-hover/50 text-theme-text-muted hover:bg-theme-hover hover:text-theme-text'
              }`}
            >
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                step === s.num ? 'bg-white text-blue-600' : step > s.num ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10 text-theme-text-muted'
              }`}>
                {step > s.num ? '✓' : s.num}
              </span>
              <span>{s.title}</span>
            </button>
          ))}
        </div>

        {/* Step Body Content */}
        <div 
          ref={publishScrollRef} 
          className="flex-1 overflow-y-auto scrollbar-hide px-2.5 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 space-y-4 w-full max-w-7xl mx-auto"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          {/* Step 1: Release & Quick Import (Strictly GitHub Releases Only) */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-theme-text flex items-center gap-1.5">
                    <Github className="w-4 h-4 text-theme-text" />
                    <span>Application Release Package</span>
                  </div>
                </div>
                
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  Release applications directly on Prople Store! You can enter a direct APK or binary package download URL hosted on your own server or cloud storage, or import an official GitHub Release URL.
                </p>
                
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-medium text-theme-text">
                    Package Download URL or GitHub Release URL *
                  </label>
                  <input 
                    id="input-github-release-url"
                    type="url" 
                    maxLength={1000}
                    placeholder="https://your-server.com/app.apk or https://github.com/owner/repo/releases/latest"
                    value={githubUrl} 
                    onChange={e => {
                      setGithubUrl(e.target.value);
                      if (releaseUrlError) setReleaseUrlError(null);
                    }}
                    className={`w-full bg-theme-hover/40 border rounded-lg px-3 py-2.5 text-xs font-mono text-theme-text outline-none transition-colors ${
                      releaseUrlError ? 'border-red-500 ring-1 ring-red-500/30' : 'border-theme-border focus:border-blue-500'
                    }`}
                  />

                  {releaseUrlError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 dark:text-red-400 text-xs flex items-start gap-2 leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold block mb-0.5">Rejected by Platform Moderation</span>
                        <span>{releaseUrlError}</span>
                      </div>
                    </div>
                  )}

                  <button
                    id="btn-fetch-github"
                    type="button"
                    onClick={handleFetchGithubRelease}
                    disabled={isFetchingRelease}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-hover/60 text-white disabled:text-theme-text-muted rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                  >
                    {isFetchingRelease ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting Release Assets & Notes...</span>
                      </span>
                    ) : (
                      <span>Load Package & Release Info</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Basic Info & Branding */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider">
                  App Identity & Store Placement
                </h3>
                <span className="text-[11px] text-theme-text-muted">Step 2 of 6</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-theme-text">App Name *</label>
                    <span className="text-[10px] text-theme-text-muted">{name.length}/50</span>
                  </div>
                  <input 
                    id="input-app-name"
                    type="text" 
                    required
                    maxLength={50}
                    placeholder="e.g. Focus Flow"
                    value={name} 
                    onChange={e => setName(e.target.value.slice(0, 50))}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text flex items-center gap-1.5 whitespace-nowrap">
                        <UserCheck className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
                        <span>Publisher Name *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCandidatePublisherName(activePublisherName);
                          setShowChangePublisherModal(true);
                        }}
                        className="text-[11px] text-blue-500 hover:text-blue-400 font-semibold cursor-pointer transition-colors"
                      >
                        Change
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        readOnly
                        onClick={() => {
                          if (isPublisherNameConflict) {
                            setNewCandidatePublisherName(activePublisherName);
                            setShowChangePublisherModal(true);
                          }
                        }}
                        value={activePublisherName || currentGoogleName} 
                        className={`w-full rounded-lg px-3 py-2 text-sm text-theme-text transition-colors ${
                          isPublisherNameConflict
                            ? 'bg-red-500/10 border border-red-500 text-red-200 cursor-pointer'
                            : 'bg-theme-hover/20 border border-theme-border/60 cursor-default'
                        }`}
                        title="Click Change to update your unique publisher name"
                      />
                    </div>
                    {isPublisherNameConflict ? (
                      <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Name already taken. Click "Change" above to set a unique publisher name.</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-theme-text-muted mt-1">
                        Verified unique publisher name across Prople Store.
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Category *</label>
                    </div>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                    >
                      {appCategories && appCategories.length > 0 ? (
                        appCategories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="Productivity">Productivity</option>
                          <option value="Tools">Tools</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Developer Tools">Developer Tools</option>
                          <option value="Social">Social</option>
                          <option value="Finance">Finance</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Education">Education</option>
                          <option value="Lifestyle">Lifestyle</option>
                          <option value="Games">Games</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-theme-text">Tagline / Short Summary</label>
                    <span className="text-[10px] text-theme-text-muted">{tagline.length}/80</span>
                  </div>
                  <input 
                    type="text" 
                    maxLength={80}
                    placeholder="e.g. High-performance offline notes with end-to-end privacy"
                    value={tagline} 
                    onChange={e => setTagline(e.target.value.slice(0, 80))}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-theme-text mb-1">Content / Age Rating</label>
                  <select
                    value={contentRating}
                    onChange={e => setContentRating(e.target.value)}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                  >
                    <option value="Rated for 3+">Rated for 3+</option>
                    <option value="Rated for 7+">Rated for 7+</option>
                    <option value="Rated for 12+">Rated for 12+</option>
                    <option value="Rated for 16+">Rated for 16+</option>
                    <option value="Rated for 18+">Rated for 18+</option>
                    <option value="Everyone">Everyone</option>
                    <option value="Everyone 10+">Everyone 10+</option>
                    <option value="Teen">Teen (13+)</option>
                    <option value="Mature 17+">Mature 17+</option>
                    <option value="Adults only 18+">Adults only 18+</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-theme-text">Search Tags / Category Badges (Comma-separated)</label>
                    <span className="text-[10px] text-theme-text-muted">{tags.length}/100</span>
                  </div>
                  <input 
                    type="text" 
                    maxLength={100}
                    placeholder="Open Source, Productivity, Utilities, Notes"
                    value={tags} 
                    onChange={e => setTags(e.target.value.slice(0, 100))}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-theme-text">
                    <input 
                      type="checkbox" 
                      checked={containsAds} 
                      onChange={e => setContainsAds(e.target.checked)} 
                      className="rounded accent-blue-600"
                    />
                    <span>Contains Ads</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-theme-text">
                    <input 
                      type="checkbox" 
                      checked={inAppPurchases} 
                      onChange={e => setInAppPurchases(e.target.checked)} 
                      className="rounded accent-blue-600"
                    />
                    <span>In-App Purchases</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Binary & Package Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider">
                  Package Details
                </h3>
                <span className="text-[11px] text-theme-text-muted">Step 3 of 6</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-theme-text">
                      <span>Direct Download URL *</span>
                    </label>
                    {downloadUrl.trim() && (
                      <button
                        type="button"
                        onClick={handleTestDownload}
                        disabled={isTestingDownload}
                        className="text-[11px] text-blue-500 hover:text-blue-400 flex items-center gap-1 font-medium transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        {isTestingDownload ? 'Testing stream...' : 'Test Download'}
                      </button>
                    )}
                  </div>
                  <input 
                    id="input-download-url"
                    type="url" 
                    required
                    maxLength={1000}
                    placeholder="https://github.com/org/repo/releases/download/v1.0.0/app-release-package"
                    value={downloadUrl} 
                    onChange={e => setDownloadUrl(e.target.value.slice(0, 1000))}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs font-mono text-theme-text outline-none focus:border-blue-500"
                  />

                  {downloadUrl.trim() && !downloadUrl.toLowerCase().includes('github.com') && !downloadUrl.toLowerCase().includes('githubusercontent.com') && (
                    <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                      <span>GitHub Release Only: Download URL must originate from an official GitHub Release asset.</span>
                    </p>
                  )}
                  


                  <p className="text-[10px] text-theme-text-muted mt-1">
                    Direct binary asset link from your GitHub Release. Used by the store for 1-click downloads.
                  </p>
                </div>

                {/* Version Number & Version Tag */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Version Number *</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{(versionName || '').length}/15</span>
                    </div>
                    <input 
                      id="input-version-name"
                      type="text" 
                      required
                      maxLength={15}
                      placeholder="1.2.0"
                      value={versionName} 
                      onChange={e => {
                        const val = e.target.value.slice(0, 15);
                        setVersionName(val);
                        if (!version || version === `v${versionName}` || version === versionName) {
                          setVersion(val ? (val.startsWith('v') ? val : `v${val}`) : '');
                        }
                      }}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Version Tag *</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{version.length}/20</span>
                    </div>
                    <input 
                      id="input-version-tag"
                      type="text" 
                      required
                      maxLength={20}
                      placeholder="v1.2.0"
                      value={version} 
                      onChange={e => {
                        const val = e.target.value.slice(0, 20);
                        setVersion(val);
                        if (!versionName || `v${versionName}` === version || versionName === version) {
                          setVersionName(val.replace(/^v/i, ''));
                        }
                      }}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Version Code & Asset Filename */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Version Code</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{String(versionCode || '').length}/8</span>
                    </div>
                    <input 
                      id="input-version-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="1"
                      value={versionCode} 
                      onChange={e => setVersionCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Asset Filename</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{assetName.length}/80</span>
                    </div>
                    <input 
                      type="text" 
                      maxLength={80}
                      placeholder="package-filename"
                      value={assetName} 
                      onChange={e => setAssetName(e.target.value.slice(0, 80))}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs font-mono text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Target Platform & Package Format Specification */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Target Platform *</label>
                    </div>
                    <select
                      value={platform}
                      onChange={e => {
                        const val = e.target.value as any;
                        setPlatform(val);
                        if (val === 'ios' && packageFormat !== 'ipa') {
                          setPackageFormat('ipa');
                          setTargetOs('iOS 14.0 or later');
                        } else if (val === 'mac' && !['dmg', 'pkg', 'zip'].includes(packageFormat)) {
                          setPackageFormat('dmg');
                          setTargetOs('macOS 12.0 Monterey or later');
                        } else if (val === 'linux' && !['deb', 'AppImage', 'rpm', 'tar.gz'].includes(packageFormat)) {
                          setPackageFormat('deb');
                          setTargetOs('Linux (Debian, Ubuntu, Fedora, Arch)');
                        } else if (val === 'windows' && !['exe', 'msi', 'zip'].includes(packageFormat)) {
                          setPackageFormat('exe');
                          setTargetOs('Windows 10, 11 (64-bit)');
                        } else if (val === 'web' && !['pwa', 'web'].includes(packageFormat)) {
                          setPackageFormat('pwa');
                          setTargetOs('Modern Web Browser / Universal PWA');
                        } else if (val === 'android' && !['apk', 'aab'].includes(packageFormat)) {
                          setPackageFormat('apk');
                          setTargetOs('Android 8.0 and up');
                        }
                      }}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                    >
                      <option value="android">Android</option>
                      <option value="ios">Apple (iOS / iPadOS)</option>
                      <option value="mac">Mac (macOS)</option>
                      <option value="linux">Linux</option>
                      <option value="windows">Windows</option>
                      <option value="web">Web Store (PWA / Web App)</option>
                      <option value="multiplatform">Multiplatform</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Package Format *</label>
                      <div className="flex items-center gap-1 shrink-0">
                        <PackageFormatIcon format={packageFormat} className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-mono text-theme-text-muted">{packageFormat ? `.${packageFormat.replace(/^\./, '').toLowerCase().slice(0, 8)}` : ''}</span>
                        <span className="text-[10px] text-theme-text-muted ml-0.5">{(packageFormat || '').length}/12</span>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      maxLength={12}
                      placeholder="e.g. apk, dmg, deb, exe"
                      value={packageFormat} 
                      onChange={e => setPackageFormat(e.target.value.replace(/^\./, '').trim().slice(0, 12) as any)}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs font-mono text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Package Size</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{assetSize.length}/15</span>
                    </div>
                    <input 
                      type="text" 
                      maxLength={15}
                      placeholder="24 MB"
                      value={assetSize} 
                      onChange={e => setAssetSize(e.target.value.slice(0, 15))}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">OS Requirement</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{minAndroid.length}/40</span>
                    </div>
                    <input 
                      type="text" 
                      maxLength={40}
                      placeholder="e.g. Android 8.0+, Windows 10/11"
                      value={minAndroid} 
                      onChange={e => {
                        const val = e.target.value.slice(0, 40);
                        setMinAndroid(val);
                        setTargetOs(val);
                      }}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Hardware & CPU Architecture Requirements */}
                <div className="space-y-3 pt-1 border-t border-theme-border/20">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-theme-text">Hardware &amp; System Architecture</label>
                    <span className="text-[10px] text-theme-text-muted">Compatibility &amp; Requirements</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[20px]">
                        <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Supported CPU Architectures</label>
                        <span className="text-[10px] text-theme-text-muted shrink-0">{supportedArchitecturesInput.length}/50</span>
                      </div>
                      <input 
                        type="text" 
                        maxLength={50}
                        placeholder="e.g. Universal, arm64-v8a, x86_64"
                        value={supportedArchitecturesInput} 
                        onChange={e => {
                          const val = e.target.value.slice(0, 50);
                          setSupportedArchitecturesInput(val);
                          const list = val.split(',').map(s => s.trim()).filter(Boolean);
                          setSupportedArchitectures(list.length > 0 ? list : ['Universal']);
                        }}
                        className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[20px]">
                        <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Minimum RAM Requirement</label>
                        <span className="text-[10px] text-theme-text-muted shrink-0">{minRam.length}/20</span>
                      </div>
                      <input 
                        type="text" 
                        maxLength={20}
                        placeholder="e.g. 2 GB, 4 GB recommended"
                        value={minRam} 
                        onChange={e => setMinRam(e.target.value.slice(0, 20))}
                        className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-theme-text flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
                      <span>Package SHA-256 Checksum * (Integrity Digest)</span>
                    </label>
                  </div>
                  <input 
                    type="text" 
                    required
                    readOnly
                    disabled
                    maxLength={64}
                    value={sha256} 
                    className="w-full bg-theme-hover/20 border border-theme-border/60 rounded-lg px-3 py-2 text-xs font-mono text-theme-text cursor-not-allowed select-none opacity-90"
                    title="Package SHA-256 cryptographic checksum is fixed for release integrity and cannot be edited."
                  />
                  <p className="text-[10px] text-theme-text-muted mt-1">
                    Cryptographic 64-character SHA-256 release digest verifying binary package integrity (Uneditable).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Release Date</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{releaseDate.length}/25</span>
                    </div>
                    <input 
                      type="text" 
                      maxLength={25}
                      placeholder="Sep 17, 2026"
                      value={releaseDate} 
                      onChange={e => setReleaseDate(e.target.value.slice(0, 25))}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 min-h-[20px]">
                      <label className="block text-xs font-medium text-theme-text whitespace-nowrap">Initial Launch Date</label>
                      <span className="text-[10px] text-theme-text-muted shrink-0">{initialReleaseDate.length}/25</span>
                    </div>
                    <input 
                      type="text" 
                      maxLength={25}
                      placeholder="Oct 12, 2024"
                      value={initialReleaseDate} 
                      onChange={e => setInitialReleaseDate(e.target.value.slice(0, 25))}
                      className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-theme-text">What's New / Release Notes</label>
                    <span className="text-[10px] text-theme-text-muted">{changelog.length}/200</span>
                  </div>
                  <textarea 
                    rows={3}
                    maxLength={200}
                    placeholder="Highlight new features, performance improvements, and bug fixes..."
                    value={changelog} 
                    onChange={e => setChangelog(e.target.value.slice(0, 200))}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500 font-mono resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Media Assets & Store Copy */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Comprehensive Media Uploader Component */}
              <div id="section-media-upload">
                <AppMediaUploader
                  appName={name || 'App'}
                  category={category}
                  initialData={{
                    iconUrl,
                    featureGraphicUrl,
                    detailsBannerUrl,
                    heroBannerUrl,
                    screenshots: screenshotsList,
                    tabletScreenshots: tabletScreenshotsList,
                    desktopScreenshots: desktopScreenshotsList,
                    promoVideoUrl,
                    videoThumbnailUrl
                  }}
                  onChange={(mediaData) => {
                    if (mediaData.iconUrl !== undefined) setIconUrl(mediaData.iconUrl);
                    if (mediaData.featureGraphicUrl !== undefined) setFeatureGraphicUrl(mediaData.featureGraphicUrl);
                    if (mediaData.detailsBannerUrl !== undefined) setDetailsBannerUrl(mediaData.detailsBannerUrl);
                    if (mediaData.heroBannerUrl !== undefined) setHeroBannerUrl(mediaData.heroBannerUrl);
                    if (mediaData.screenshots !== undefined) setScreenshotsList(mediaData.screenshots);
                    if (mediaData.tabletScreenshots !== undefined) setTabletScreenshotsList(mediaData.tabletScreenshots);
                    if (mediaData.desktopScreenshots !== undefined) setDesktopScreenshotsList(mediaData.desktopScreenshots);
                    if (mediaData.promoVideoUrl !== undefined) setPromoVideoUrl(mediaData.promoVideoUrl);
                    if (mediaData.videoThumbnailUrl !== undefined) setVideoThumbnailUrl(mediaData.videoThumbnailUrl);
                  }}
                />
              </div>

              {/* Spotlight Feed Placement Feature Graphic */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-theme-text">
                    Store Spotlight & Editorial Banner
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-theme-text">
                    <input
                      type="checkbox"
                      checked={featureOnSpotlight}
                      onChange={(e) => setFeatureOnSpotlight(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                    <span>Highlight in Spotlight</span>
                  </label>
                </div>
                {featureOnSpotlight && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[20px]">
                        <label className="block text-xs font-medium text-theme-text whitespace-nowrap">
                          Spotlight Badge Tag
                        </label>
                        <span className="text-[10px] text-theme-text-muted shrink-0">{spotlightBadge.length}/20</span>
                      </div>
                      <input 
                        type="text" 
                        maxLength={20}
                        placeholder="e.g. Featured, New Release, Editor's Pick"
                        value={spotlightBadge} 
                        onChange={(e) => setSpotlightBadge(e.target.value.slice(0, 20))}
                        className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1 min-h-[20px]">
                        <label className="block text-xs font-medium text-theme-text whitespace-nowrap">
                          Spotlight Headline Callout
                        </label>
                        <span className="text-[10px] text-theme-text-muted shrink-0">{spotlightHeadline.length}/60</span>
                      </div>
                      <input 
                        type="text" 
                        maxLength={60}
                        placeholder="e.g. High-performance open-source client"
                        value={spotlightHeadline} 
                        onChange={(e) => setSpotlightHeadline(e.target.value.slice(0, 60))}
                        className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Full Description & Store Copy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-theme-text">
                    About This App (Full Store Description)
                  </label>
                  <span className="text-[10px] text-theme-text-muted">
                    {description.length}/4000 characters
                  </span>
                </div>
                <textarea 
                  id="input-app-description"
                  rows={6}
                  maxLength={4000}
                  placeholder="Comprehensive description of app features, functionality, system requirements, open source notes, and release highlights. Displayed in the 'About this app' store page..."
                  value={description} 
                  onChange={e => setDescription(e.target.value.slice(0, 4000))}
                  className="w-full bg-theme-hover/40 border border-theme-border rounded-lg p-3 text-xs text-theme-text outline-none focus:border-blue-500 resize-y min-h-[140px] leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Step 5: Data Safety & Developer Support */}
          {step === 5 && (
            <div className="space-y-6 pb-4">
              {/* Sub-Section 1: Data Privacy & Practices */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-lg font-semibold text-theme-text font-google-sans tracking-tight">
                    Data Safety & Privacy Declarations
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-text-muted leading-relaxed">
                    Provide accurate disclosures of how your application handles, collects, and shares user data off-device.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Overview Introduction */}
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Report page introduction / overview
                    </label>
                    <span className="absolute -top-2.5 right-3.5 px-1.5 bg-theme-bg text-[10px] sm:text-[11px] text-theme-text-muted select-none z-10 leading-none">
                      {dataSafetyOverview.length}/500
                    </span>
                    <textarea 
                      rows={3}
                      maxLength={1000}
                      placeholder="High-level summary of your app's privacy and data safety practices. Displayed on the Data Safety report page..."
                      value={dataSafetyOverview} 
                      onChange={e => setDataSafetyOverview(e.target.value.slice(0, 1000))}
                      className="w-full h-[120px] sm:h-[130px] min-h-[120px] sm:min-h-[130px] bg-transparent border border-theme-border focus:border-blue-500 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-theme-text outline-none resize-none leading-relaxed transition-colors"
                    />
                  </div>

                  {/* Data Collected */}
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Data collected by app
                    </label>
                    <span className="absolute -top-2.5 right-3.5 px-1.5 bg-theme-bg text-[10px] sm:text-[11px] text-theme-text-muted select-none z-10 leading-none">
                      {customDataCollected.length}/2000
                    </span>
                    <textarea 
                      rows={3}
                      maxLength={2000}
                      placeholder="Describe what data your app collects and why, or state that no personal data is collected off-device. You can write paragraphs, lists, or custom bullet points freely..."
                      value={customDataCollected} 
                      onChange={e => setCustomDataCollected(e.target.value.slice(0, 2000))}
                      className="w-full h-[120px] sm:h-[130px] min-h-[120px] sm:min-h-[130px] bg-transparent border border-theme-border focus:border-blue-500 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-theme-text outline-none resize-none leading-relaxed transition-colors"
                    />
                  </div>

                  {/* Data Shared */}
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Data shared with third parties
                    </label>
                    <span className="absolute -top-2.5 right-3.5 px-1.5 bg-theme-bg text-[10px] sm:text-[11px] text-theme-text-muted select-none z-10 leading-none">
                      {dataShared.length}/1000
                    </span>
                    <textarea 
                      rows={3}
                      maxLength={1000}
                      placeholder="Describe third-party sharing, analytics, advertising SDKs, or state 'No data shared with third parties.'..."
                      value={dataShared} 
                      onChange={e => setDataShared(e.target.value.slice(0, 1000))}
                      className="w-full h-[120px] sm:h-[130px] min-h-[120px] sm:min-h-[130px] bg-transparent border border-theme-border focus:border-blue-500 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-theme-text outline-none resize-none leading-relaxed transition-colors"
                    />
                  </div>

                  {/* Data Deletion */}
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Data deletion & retention policy
                    </label>
                    <span className="absolute -top-2.5 right-3.5 px-1.5 bg-theme-bg text-[10px] sm:text-[11px] text-theme-text-muted select-none z-10 leading-none">
                      {dataDeletionPolicy.length}/1000
                    </span>
                    <textarea 
                      rows={3}
                      maxLength={1000}
                      placeholder="Users can request permanent data deletion or clear application cache locally at any time."
                      value={dataDeletionPolicy} 
                      onChange={e => setDataDeletionPolicy(e.target.value.slice(0, 1000))}
                      className="w-full h-[120px] sm:h-[130px] min-h-[120px] sm:min-h-[130px] bg-transparent border border-theme-border focus:border-blue-500 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-theme-text outline-none resize-none leading-relaxed transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-Section 2: Apps and permissions */}
              <div className="space-y-3 pt-5 border-t border-theme-border/60">
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-lg font-semibold text-theme-text font-google-sans tracking-tight">
                    Apps and permissions
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-text-muted leading-relaxed">
                    Declare hardware and system capabilities requested by your application. All bullet points register directly on the input ground. Use comma (,) or Enter to add points
                  </p>
                </div>

                {/* Natural flow on page - Zero nested scrollbars */}
                <div className="space-y-4 pt-1">
                  {activePermissionIds.map(id => {
                    const catalogItem = ALL_PERMISSION_CATALOG.find(c => c.id === id);
                    const customItem = customPermissionCategories.find(c => c.id === id);
                    const catName = catalogItem?.name || customItem?.name || id;
                    const placeholder = catalogItem?.placeholder || `e.g. details for ${catName} (Enter or comma)`;

                    return (
                      <PermissionGroundInput
                        key={id}
                        icon={getPlayStorePermissionIcon(id, "w-5 h-5 text-neutral-400 dark:text-neutral-300 shrink-0")}
                        categoryName={catName}
                        items={parseBulletPoints(getPermissionValue(id))}
                        onChange={(newItems) => updateDynamicPermission(id, newItems.join('\n'))}
                        placeholder={placeholder}
                        showNoAccessButton={id !== 'other'}
                        onRemoveCategory={() => setCategoryToRemove({ id, name: catName })}
                      />
                    );
                  })}
                </div>

                {/* '+ Add permission' Action Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddPermissionModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors cursor-pointer active:opacity-80 py-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add permission</span>
                  </button>
                </div>
              </div>


              {/* Sub-Section 4: Mandatory Legal Policies (2 columns in one line for compact space) */}
              <div className="space-y-3 pt-5 border-t border-theme-border/60">
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-lg font-semibold text-theme-text font-google-sans tracking-tight">
                    Mandatory Legal Policies
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-text-muted leading-relaxed">
                    Google Play guidelines require every published application to link to a valid and publicly accessible Privacy Policy and Terms of Service.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                  {/* Privacy Policy */}
                  <div className="space-y-1.5">
                    <div className="relative mt-3.5 group">
                      <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Privacy policy authorized URL (required)</span>
                      </label>
                      <input 
                        id="input-privacy-policy-url"
                        type="url" 
                        required
                        maxLength={500}
                        placeholder="https://prople.store/privacy or https://github.com/..."
                        value={privacyPolicyUrl} 
                        onChange={e => setPrivacyPolicyUrl(e.target.value.slice(0, 500))}
                        className={`w-full bg-transparent border rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text outline-none transition-colors ${
                          privacyPolicyUrl.trim() && !checkAuthorizedLink(privacyPolicyUrl).isAuthorized
                            ? 'border-rose-500 focus:border-rose-500'
                            : privacyPolicyUrl.trim() && checkAuthorizedLink(privacyPolicyUrl).isAuthorized
                            ? 'border-emerald-500/80 focus:border-emerald-500'
                            : 'border-theme-border focus:border-blue-500'
                        }`}
                      />
                    </div>

                    {/* Dynamic Status Indicator */}
                    <div className="text-xs px-1">
                      {privacyPolicyUrl.trim() ? (
                        checkAuthorizedLink(privacyPolicyUrl).isAuthorized ? (
                          <span className="text-emerald-500 font-medium flex items-center gap-1.5 truncate">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{checkAuthorizedLink(privacyPolicyUrl).statusText}</span>
                          </span>
                        ) : (
                          <span className="text-rose-500 font-medium flex items-center gap-1.5 truncate">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{checkAuthorizedLink(privacyPolicyUrl).statusText}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-rose-500/90 font-medium flex items-center gap-1.5 truncate">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Mandatory: Please provide an authorized link</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="space-y-1.5">
                    <div className="relative mt-3.5 group">
                      <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Terms & conditions authorized URL (required)</span>
                      </label>
                      <input 
                        id="input-terms-conditions-url"
                        type="url" 
                        required
                        maxLength={500}
                        placeholder="https://prople.store/terms or https://github.com/..."
                        value={termsAndConditionsUrl} 
                        onChange={e => setTermsAndConditionsUrl(e.target.value.slice(0, 500))}
                        className={`w-full bg-transparent border rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text outline-none transition-colors ${
                          termsAndConditionsUrl.trim() && !checkAuthorizedLink(termsAndConditionsUrl).isAuthorized
                            ? 'border-rose-500 focus:border-rose-500'
                            : termsAndConditionsUrl.trim() && checkAuthorizedLink(termsAndConditionsUrl).isAuthorized
                            ? 'border-emerald-500/80 focus:border-emerald-500'
                            : 'border-theme-border focus:border-blue-500'
                        }`}
                      />
                    </div>

                    {/* Dynamic Status Indicator */}
                    <div className="text-xs px-1">
                      {termsAndConditionsUrl.trim() ? (
                        checkAuthorizedLink(termsAndConditionsUrl).isAuthorized ? (
                          <span className="text-emerald-500 font-medium flex items-center gap-1.5 truncate">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{checkAuthorizedLink(termsAndConditionsUrl).statusText}</span>
                          </span>
                        ) : (
                          <span className="text-rose-500 font-medium flex items-center gap-1.5 truncate">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{checkAuthorizedLink(termsAndConditionsUrl).statusText}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-rose-500/90 font-medium flex items-center gap-1.5 truncate">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Mandatory: Please provide an authorized link</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Section 4: Developer & Publisher Support Credentials (2 columns in one line) */}
              <div className="space-y-3 pt-5 border-t border-theme-border/60">
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-lg font-semibold text-theme-text font-google-sans tracking-tight flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-theme-text-muted" />
                    <span>Developer & Publisher Support Credentials</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-theme-text-muted leading-relaxed">
                    Provide verified contact points and web presence displayed publicly for users and Google Play reviewers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Support email (required)
                    </label>
                    <input 
                      type="email" 
                      required
                      readOnly
                      disabled
                      value={currentGoogleEmail} 
                      className="w-full bg-transparent border border-theme-border/60 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text cursor-not-allowed select-none opacity-80"
                      title="Support email is linked to your authenticated Google account and cannot be edited."
                    />
                  </div>
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      GitHub repo owner (required)
                    </label>
                    <input 
                      type="text" 
                      required
                      readOnly
                      disabled
                      value={githubRepoOwner ? `@${githubRepoOwner}` : 'Not detected (Set release link in Step 1)'} 
                      className="w-full bg-transparent border border-theme-border/60 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text cursor-not-allowed select-none opacity-80"
                      title="Repository owner is fetched from the GitHub release link and cannot be edited manually."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Official website
                    </label>
                    <input 
                      type="url" 
                      maxLength={300}
                      placeholder="https://example.com"
                      value={websiteUrl} 
                      onChange={e => setWebsiteUrl(e.target.value.slice(0, 300))}
                      className="w-full bg-transparent border border-theme-border focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text outline-none transition-colors"
                    />
                  </div>
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      GitHub profile / org
                    </label>
                    <input 
                      type="url" 
                      maxLength={300}
                      placeholder="https://github.com/organization"
                      value={githubRepoUrl} 
                      onChange={e => setGithubRepoUrl(e.target.value.slice(0, 300))}
                      className="w-full bg-transparent border border-theme-border focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative mt-3.5 group">
                    <label className="absolute -top-2.5 left-3.5 px-1.5 bg-theme-bg text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] pointer-events-none select-none z-10 font-google-sans leading-none transition-colors">
                      Publisher physical address
                    </label>
                    <span className="absolute -top-2.5 right-3.5 px-1.5 bg-theme-bg text-[10px] sm:text-[11px] text-theme-text-muted select-none z-10 leading-none">
                      {developerAddress.length}/50
                    </span>
                    <input 
                      type="text"
                      maxLength={50}
                      placeholder="Optional physical mailing or office address"
                      value={developerAddress} 
                      onChange={e => setDeveloperAddress(e.target.value.slice(0, 50))}
                      className="w-full bg-transparent border border-theme-border focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-theme-text outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Review & Confirmation */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-theme-text uppercase tracking-wider">
                  Review & Final Confirmation
                </h3>
                <span className="text-[11px] text-theme-text-muted">Step 6 of 6</span>
              </div>

              {/* App Preview Card with App Details Page Header Banner */}
              <div className="rounded-xl overflow-hidden border border-theme-border bg-theme-hover/30">
                {(() => {
                  const detailsHeroBanner = detailsBannerUrl || featureGraphicUrl || heroBannerUrl;

                  return (
                    <div className="w-full aspect-[16/9] overflow-hidden bg-black/40 border-b border-theme-border/50 relative flex items-center justify-center">
                      {detailsHeroBanner && detailsHeroBanner.trim() ? (
                        <img 
                          src={detailsHeroBanner} 
                          alt="App Details Header Banner" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-theme-text-muted/60 text-xs p-4 text-center">
                          <ImageIcon className="w-8 h-8 mb-2 text-theme-text-muted/40" />
                          <span className="text-xs tracking-wide font-medium text-theme-text-muted">App Details Header Banner</span>
                          <span className="text-[10px] text-theme-text-muted/60 mt-0.5">16:9 Widescreen proportion (No graphic uploaded)</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="p-3 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-theme-hover border border-theme-border shrink-0 shadow-sm">
                    {iconUrl && iconUrl.trim() ? (
                      <img src={iconUrl} alt="App Icon" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-theme-text-muted">
                        <Tag className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-theme-text truncate">{name || 'Untitled Application'}</h4>
                      <button
                        type="button"
                        onClick={() => navigateToStepAndSection(2, 'input-app-name')}
                        className="text-[11px] text-blue-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-theme-text-muted truncate">{developerName || 'Independent Publisher'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-theme-text-muted">
                        {category}
                      </span>
                      <span className="text-[11px] text-theme-text font-mono font-semibold">v{versionName || version.replace(/^v/i, '') || '1.0.0'}</span>
                      {version && version !== versionName && version !== `v${versionName}` && (
                        <span className="text-[10px] text-theme-text-muted font-mono">({version})</span>
                      )}
                      <span className="text-[11px] text-theme-text-muted">•</span>
                      <span className="text-[11px] text-theme-text-muted">{assetSize || '25 MB'}</span>
                    </div>
                  </div>
                </div>

                {/* Media assets indicator */}
                <div className="px-3 pb-3 flex items-center justify-between gap-2 border-t border-theme-border/30 pt-2">
                  <span className="text-[11px] text-theme-text-muted">
                    {screenshotsList.length} Phone • {tabletScreenshotsList.length} Tablet • {desktopScreenshotsList.length} Desktop {promoVideoUrl ? '• Video' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToStepAndSection(4, 'section-media-upload')}
                    className="text-[11px] text-blue-400 hover:underline shrink-0 cursor-pointer"
                  >
                    Edit Media
                  </button>
                </div>
              </div>



              {/* Parameters Breakdown */}
              <div className="space-y-0 text-xs">
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Publisher Name:</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-medium text-theme-text truncate">{currentGoogleName}</span>
                    <span className="text-[10px] text-theme-text-muted bg-theme-hover px-1.5 py-0.5 rounded shrink-0">Google Account</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Support Email:</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-medium text-theme-text truncate" title={currentGoogleEmail}>{currentGoogleEmail}</span>
                    <span className="text-[10px] text-theme-text-muted bg-theme-hover px-1.5 py-0.5 rounded shrink-0">Google Login</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Repository Owner:</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="font-mono text-theme-text truncate">@{githubRepoOwner || 'Not detected'}</span>
                    <span className="text-[10px] text-theme-text-muted bg-theme-hover px-1.5 py-0.5 rounded shrink-0">GitHub Release</span>
                    <button
                      type="button"
                      onClick={() => navigateToStepAndSection(1, 'input-github-release-url')}
                      className="text-[11px] text-blue-400 hover:underline ml-auto shrink-0 cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Version Details:</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <span className="font-mono font-medium text-theme-text">v{versionName || version.replace(/^v/i, '') || '1.0.0'}</span>
                    <span className="text-[10px] text-theme-text-muted font-mono bg-theme-hover px-1.5 py-0.5 rounded">Tag: {version || 'v1.0.0'}</span>
                    {versionCode && (
                      <span className="text-[10px] text-theme-text-muted font-mono bg-theme-hover px-1.5 py-0.5 rounded">Build: {versionCode}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToStepAndSection(3, 'input-version-name')}
                    className="text-[11px] text-blue-400 hover:underline ml-auto shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Package SHA-256:</span>
                  <span className="font-mono text-[11px] text-theme-text truncate min-w-0 flex-1" title={sha256}>
                    {sha256 ? `${sha256.substring(0, 16)}...${sha256.substring(48)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Package Asset:</span>
                  <span className="font-mono text-theme-text truncate min-w-0 flex-1" title={assetName || 'package-file'}>
                    {assetName || 'package-file'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Download Endpoint:</span>
                  <span className="font-mono text-blue-400 truncate min-w-0 flex-1" title={downloadUrl || 'Not provided'}>
                    {downloadUrl || 'Not provided'}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToStepAndSection(3, 'input-download-url')}
                    className="text-[11px] text-blue-400 hover:underline ml-auto shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Content Rating:</span>
                  <span className="text-theme-text min-w-0 flex-1">{contentRating}</span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-theme-border/25">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Privacy Policy:</span>
                  <span className="font-mono text-blue-400 truncate min-w-0 flex-1" title={privacyPolicyUrl}>
                    {privacyPolicyUrl || 'Not provided'}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToStepAndSection(5, 'input-privacy-policy-url')}
                    className="text-[11px] text-blue-400 hover:underline ml-auto shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-2.5 py-2">
                  <span className="text-theme-text-muted w-[130px] sm:w-[155px] shrink-0">Terms & Conditions:</span>
                  <span className="font-mono text-blue-400 truncate min-w-0 flex-1" title={termsAndConditionsUrl}>
                    {termsAndConditionsUrl || 'Not provided'}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToStepAndSection(5, 'input-terms-conditions-url')}
                    className="text-[11px] text-blue-400 hover:underline ml-auto shrink-0 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Native Mobile Bottom Action Navigation Bar */}
        <div className="p-3.5 bg-theme-bg flex items-center justify-between gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom,16px))] w-full max-w-7xl mx-auto border-t border-theme-border/40 relative z-[80] shadow-[0_-4px_16px_rgba(0,0,0,0.15)]">
          {step > 1 ? (
            <button
              id="btn-bottom-back"
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1) as any)}
              className="w-24 h-10 bg-theme-hover hover:bg-theme-hover/80 text-theme-text rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              id="btn-bottom-cancel"
              type="button"
              onClick={handleCancelPublish}
              className="w-24 h-10 bg-theme-hover hover:bg-theme-hover/80 text-theme-text rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}

          {step < 6 ? (
            <button
              id="btn-bottom-next"
              type="button"
              onClick={handleAttemptNext}
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            (() => {
              const missingSteps = getPublishingMissingSteps();
              const hasMissing = missingSteps.length > 0;
              const isWarning = publishButtonState === 'warning' || hasMissing;
              const isUnchanged = Boolean(editingAppId && !hasFormChanged);
              const isCoolingDown = (editingAppId && updateQuota.isExhausted) || (!editingAppId && publishQuota.isExhausted);
              const isUnauthorized = Boolean(editingAppId && !isOwnerAuthorized);
              const cooldownFormatted = editingAppId ? updateQuota.nextAvailableTimeFormatted : publishQuota.nextAvailableTimeFormatted;

              return (
                <button
                  id="btn-bottom-confirm"
                  type="button"
                  onClick={handleAttemptPublish}
                  disabled={isPublishing || isUnchanged}
                  title={isUnchanged ? 'No changes detected to publish update' : undefined}
                  className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm ${
                    isPublishing
                      ? 'bg-blue-700 text-white cursor-wait opacity-90'
                      : isUnchanged
                      ? 'bg-theme-hover/60 text-theme-text-muted border border-theme-border/40 cursor-not-allowed opacity-50 shadow-none'
                      : isUnauthorized
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 cursor-pointer'
                      : isCoolingDown
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer'
                      : isWarning
                      ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black font-bold cursor-pointer shadow-md shadow-amber-500/10'
                      : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white cursor-pointer shadow-md shadow-emerald-600/10'
                  }`}
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>{editingAppId ? 'Updating Application...' : 'Publishing Application...'}</span>
                    </>
                  ) : isUnchanged ? (
                    <>
                      <UploadCloud className="w-4 h-4 shrink-0 text-theme-text-muted/60" />
                      <span>Publish Update</span>
                    </>
                  ) : isUnauthorized ? (
                    <>
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>Unauthorized (Not Owner)</span>
                    </>
                  ) : isCoolingDown ? (
                    <>
                      <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Please wait ({cooldownFormatted || 'cooldown'})</span>
                    </>
                  ) : isWarning ? (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-black animate-pulse" />
                      <span>{editingAppId ? 'Publish Update (Incomplete Steps)' : 'Publish App (Incomplete Steps)'}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 shrink-0" />
                      <span>{editingAppId ? 'Publish Update' : 'Publish App'}</span>
                    </>
                  )}
                </button>
              );
            })()
          )}
        </div>

        {/* Cancellation / Discard Confirmation Popup (Same styling as uninstall pop-up with darkened background) */}
        {showCancelModal && (
          <div 
            id="cancel-publish-modal-backdrop"
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
            onClick={() => setShowCancelModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div 
              id="cancel-publish-modal-container"
              className="bg-theme-card text-theme-text border-0 w-full max-w-[380px] sm:max-w-md rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-7 animate-in zoom-in-95 duration-200 relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Title and Close Cross ('X') */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0 pr-1">
                  <h3 id="cancel-modal-title" className="text-[20px] font-semibold text-theme-text leading-tight tracking-tight">
                    {editingAppId ? 'Discard update changes?' : 'Discard application draft?'}
                  </h3>
                  <p className="text-[14px] text-theme-text-muted mt-2.5 leading-relaxed font-normal">
                    {editingAppId
                      ? 'You have unsaved changes in this application update. You can save your draft to resume later, or discard your modifications.'
                      : 'You have an unfinished application draft. You can save your progress to resume later, or discard and start fresh.'}
                  </p>
                </div>
                <button
                  type="button"
                  id="cancel-modal-close-btn"
                  onClick={() => setShowCancelModal(false)}
                  className="p-1.5 -mr-1.5 -mt-1 text-theme-text-muted hover:text-theme-text rounded-full hover:bg-theme-hover active:bg-theme-border/40 transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Native Action Buttons: Exactly two buttons */}
              <div className="flex items-center justify-end gap-2 mt-6 pt-1">
                <button
                  type="button"
                  id="cancel-modal-discard-btn"
                  onClick={handleDiscardDraft}
                  className="px-5 py-2.5 rounded-full text-[14px] font-semibold text-red-500 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-all cursor-pointer"
                >
                  Discard
                </button>

                <button
                  type="button"
                  id="cancel-modal-draft-btn"
                  onClick={handleSaveDraft}
                  className="px-5 py-2.5 rounded-full text-[14px] font-semibold text-blue-600 dark:text-[#8ab4f8] hover:bg-blue-500/10 active:bg-blue-500/20 transition-all cursor-pointer"
                >
                  Save as draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Permission Category Confirmation Modal */}
        {categoryToRemove && (
          <div 
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
            onClick={() => setCategoryToRemove(null)}
            role="dialog"
            aria-modal="true"
          >
            <div 
              className="bg-theme-card text-theme-text border-0 w-full max-w-[380px] sm:max-w-md rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-7 animate-in zoom-in-95 duration-200 relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Title and Close Cross ('X') */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0 pr-1">
                  <h3 className="text-[20px] font-semibold text-theme-text leading-tight tracking-tight">
                    Remove {categoryToRemove.name} permission?
                  </h3>
                  <p className="text-[14px] text-theme-text-muted mt-2.5 leading-relaxed font-normal">
                    Are you sure you want to remove the {categoryToRemove.name} permission section? Any declared points for this permission will be cleared.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryToRemove(null)}
                  className="p-1.5 -mr-1.5 -mt-1 text-theme-text-muted hover:text-theme-text rounded-full hover:bg-theme-hover active:bg-theme-border/40 transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Native Action Buttons */}
              <div className="flex items-center justify-end gap-2 mt-6 pt-1">
                <button
                  type="button"
                  onClick={() => setCategoryToRemove(null)}
                  className="px-5 py-2.5 rounded-full text-[14px] font-semibold text-theme-text-muted hover:bg-theme-hover active:bg-theme-hover/80 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRemovePermissionCategory(categoryToRemove.id);
                    setCategoryToRemove(null);
                  }}
                  className="px-5 py-2.5 rounded-full text-[14px] font-semibold text-red-500 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-all cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Permission Modal (Popup UI for both choosing standard and adding manually) */}
        {showAddPermissionModal && (
          <div 
            className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
            onClick={() => setShowAddPermissionModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <div 
              className="bg-theme-card text-theme-text border-0 w-full max-w-[420px] sm:max-w-md rounded-[28px] shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh] overflow-y-auto overscroll-contain scrollbar-thin"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Title, Description, and Close 'X' */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-theme-border/50">
                <div className="flex flex-col min-w-0 pr-1">
                  <h3 className="text-[20px] font-semibold text-theme-text leading-tight tracking-tight">
                    Add permission
                  </h3>
                  <p className="text-[13px] text-theme-text-muted mt-1 leading-relaxed">
                    Choose from standard Android permissions or add a custom category manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPermissionModal(false)}
                  className="p-1.5 -mr-1.5 -mt-1 text-theme-text-muted hover:text-theme-text rounded-full hover:bg-theme-hover active:bg-theme-border/40 transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Completely exposed without carousel or nested truncation */}
              <div className="pt-4 space-y-5">
                {/* Section A: Choose from standard permissions - fully exposed list */}
                <div className="space-y-2">
                  <div className="text-[12px] font-semibold text-theme-text-muted uppercase tracking-wider">
                    Standard Android Permissions
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    {ALL_PERMISSION_CATALOG
                      .filter(c => !activePermissionIds.includes(c.id))
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleAddPermissionCategory(c.id)}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-theme-text bg-theme-hover/20 hover:bg-theme-hover border border-theme-border/40 hover:border-blue-500/50 transition-all text-left cursor-pointer active:scale-[0.99]"
                        >
                          {getPlayStorePermissionIcon(c.id, "w-4 h-4 text-theme-text-muted shrink-0")}
                          <span className="font-medium truncate">{c.name}</span>
                        </button>
                      ))}
                    {ALL_PERMISSION_CATALOG.filter(c => !activePermissionIds.includes(c.id)).length === 0 && (
                      <p className="py-3 text-xs text-theme-text-muted italic text-center">
                        All standard Android permissions have already been added.
                      </p>
                    )}
                  </div>
                </div>

                {/* Section B: Add Manually */}
                <div className="space-y-2 pt-3 border-t border-theme-border/50">
                  <div className="text-[12px] font-semibold text-theme-text-muted uppercase tracking-wider">
                    Add Manually
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      placeholder="Custom permission name (e.g. Biometrics, NFC)..."
                      value={customGroupInputName}
                      onChange={(e) => setCustomGroupInputName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomGroup();
                        }
                      }}
                      className="min-w-0 flex-1 bg-theme-hover/20 hover:bg-theme-hover/30 focus:bg-theme-hover/40 border border-theme-border/80 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-theme-text outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomGroup}
                      disabled={!customGroupInputName.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs sm:text-sm rounded-xl cursor-pointer transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end mt-4 pt-3 border-t border-theme-border/40">
                <button
                  type="button"
                  onClick={() => setShowAddPermissionModal(false)}
                  className="px-5 py-2 rounded-full text-xs sm:text-sm font-semibold text-theme-text-muted hover:bg-theme-hover active:bg-theme-hover/80 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  if (!user && !isPublishOpen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-y-auto">
        <header className="h-[60px] sm:h-[68px] flex items-center px-2.5 sm:px-4 md:px-6 lg:px-8 bg-theme-bg shrink-0 z-20 w-full border-0">
          <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
            <button
              onClick={onClose}
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 text-theme-text" />
            </button>
            <span className="text-[17px] sm:text-[19px] font-medium text-theme-text font-google-sans">Developer Console</span>
            <div className="w-9" />
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-[#8ab4f8] flex items-center justify-center mb-6 shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-theme-text tracking-tight mb-2">
            Publisher Account Required
          </h2>
          <p className="text-sm text-theme-text-muted leading-relaxed mb-6">
            Store visitors can download apps freely without signing up. To publish applications, release updates, and manage distribution, please sign in with your publisher account.
          </p>

          <div className="w-full bg-theme-hover/40 border border-theme-border/40 rounded-2xl p-5 text-left mb-8 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-theme-text">
                <span className="font-semibold">Release Apps &amp; APKs:</span> Direct publishing of Android binaries, PWAs, and cross-platform releases.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-theme-text">
                <span className="font-semibold">Live Distribution Analytics:</span> Real-time counters for user downloads and version adoption.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-theme-text">
                <span className="font-semibold">Ownership Protection:</span> Verified developer identity prevents tampering and unauthorized updates.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await loginWithGoogle();
              } catch (e) {
                console.warn("Publisher login notice:", e);
              }
            }}
            className="w-full py-3 px-6 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-800 border border-gray-200 text-sm font-semibold rounded-full transition-colors flex items-center justify-center gap-3 shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google to Continue</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 text-xs text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
          >
            Return to Store
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30 select-none">
      {/* Top Header */}
      <header className="h-[60px] sm:h-[68px] flex items-center px-2.5 sm:px-4 md:px-6 lg:px-8 bg-theme-bg shrink-0 z-20 w-full border-0">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 -translate-x-[2px]">
            <button 
              id="console-back-button"
              onClick={onClose} 
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6 text-theme-text" />
            </button>
            <h1 className="text-[17px] sm:text-[19px] font-medium tracking-tight text-theme-text font-google-sans">Developer Console</h1>
          </div>

          <button
            type="button"
            id="console-header-publish-btn"
            onClick={handleOpenNewPublish}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
            aria-label={savedNewAppDraft && isDraftMeaningful(savedNewAppDraft) ? "Resume drafted app" : "Publish new app"}
          >
            {savedNewAppDraft && isDraftMeaningful(savedNewAppDraft) ? (
              <>
                <Edit3 className="w-4 h-4" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Publish App</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area: Apps List - Expanded Layout */}
      <div 
        ref={consoleScrollRef} 
        className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 md:px-6 lg:px-8 pt-2 sm:pt-3 pb-8 scrollbar-hide flex flex-col min-h-0 w-full max-w-7xl mx-auto"
      >
        
        {/* Search Bar - On Page */}
        <div className="w-full mb-2">
          <div className="w-full flex items-center bg-theme-hover rounded-full h-[46px] px-4 transition-colors">
            <Search className="w-4.5 h-4.5 text-theme-text-muted mr-3 shrink-0" />
            <input
              id="console-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your published apps"
              className="flex-1 min-w-0 w-full bg-transparent text-theme-text text-[15px] font-normal focus:outline-none placeholder:text-theme-text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                id="console-search-clear"
                onClick={() => setSearchQuery('')}
                className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Clear query"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Top Charts Tabs & Filter Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 mb-2 shrink-0">
          {/* Top Charts Sort Dropdown Pill */}
          <button 
            type="button"
            id="console-top-charts-filter-btn"
            onClick={() => setShowTopFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              selectedTopFilter !== 'All apps'
                ? 'bg-blue-600/10 text-blue-500 dark:text-blue-400' 
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            {selectedTopFilter !== 'All apps' && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
            <span>{selectedTopFilter === 'All apps' ? 'Top charts' : selectedTopFilter}</span>
            <ChevronDown className={`w-3.5 h-3.5 ml-0.5 ${selectedTopFilter !== 'All apps' ? 'text-blue-500 dark:text-blue-400' : 'text-theme-text-muted'}`} />
          </button>

          {/* Categories Dropdown Pill */}
          <button 
            type="button"
            id="console-categories-filter-btn"
            onClick={() => setShowCategoriesFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              selectedCategory !== 'All categories' 
                ? 'bg-blue-600/10 text-blue-500 dark:text-blue-400' 
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            {selectedCategory !== 'All categories' && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
            <span>{selectedCategory !== 'All categories' ? selectedCategory : 'Categories'}</span>
            <ChevronDown className={`w-3.5 h-3.5 ml-0.5 ${selectedCategory !== 'All categories' ? 'text-blue-500 dark:text-blue-400' : 'text-theme-text-muted'}`} />
          </button>

          {/* Reset filters pill if active */}
          {(selectedTopFilter !== 'All apps' || selectedCategory !== 'All categories') && (
            <button
              type="button"
              id="console-reset-filters-btn"
              onClick={() => {
                setSelectedTopFilter('All apps');
                setSelectedCategory('All categories');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text bg-theme-hover/60 hover:bg-theme-hover transition-colors shrink-0 border-0 outline-none"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {searchQuery.trim() && (
            <div className="flex items-center text-[11px] text-theme-text-muted ml-auto shrink-0 pl-2">
              <span>{filteredApps.length} {filteredApps.length === 1 ? 'app' : 'apps'} found</span>
            </div>
          )}
        </div>

        {/* Apps Listing following Search Results page layout */}
        <div className="w-full flex flex-col space-y-1">
            {(isLoadingApps || !hasInitialSyncCompleted) && appsList.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
                <StoreCircleLoader size="md" />
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-theme-hover border border-theme-border flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                  <Package className="w-7 h-7 stroke-[1.5]" />
                </div>
                <p className="text-base font-semibold text-theme-text">
                  {searchQuery 
                    ? 'No matching apps' 
                    : selectedCategory !== 'All categories'
                    ? `No apps found in ${selectedCategory}`
                    : 'No published apps yet'}
                </p>
                <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                  {searchQuery 
                    ? `No published apps match "${searchQuery}"` 
                    : 'Your developer account is ready. Publish your first app to make it available on Prople App Market.'}
                </p>
                {!searchQuery && (
                  <button
                    id="console-empty-publish-btn"
                    onClick={handleOpenNewPublish}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Publish App</span>
                  </button>
                )}
              </div>
            ) : (
              filteredApps.map((app) => {
                const canManage = canUserManageApp(app);
                const rawDownloads = app.downloadsCount ?? parseDownloadCount(app.downloads);
                const downloadsFormatted = rawDownloads > 0 ? formatDownloadCount(rawDownloads) : (app.downloads || '0+');
                const isRated = typeof app.rating === 'number' && app.rating > 0;
                const averageRating = isRated ? app.rating.toFixed(1) : null;

                return (
                  <div 
                    key={app.id} 
                    id={`app-item-${app.id}`}
                    onClick={() => {
                      onOpenAppDetail?.(app.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group relative outline-none transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* App Icon */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs flex items-center justify-center">
                        {app.iconUrl && app.iconUrl.trim() ? (
                          <img src={app.iconUrl} alt={app.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-blue-500">
                            {app.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      {/* App Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                            {app.name}
                          </h4>
                        </div>

                        <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
                          {app.developer} {app.category ? `• ${app.category}` : ''}
                        </p>
                        
                        <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                          {isRated ? (
                            <span className="flex items-center gap-0.5 font-medium text-theme-text shrink-0">
                              <span>{averageRating}</span>
                              <span className="text-[10px] text-amber-400">★</span>
                            </span>
                          ) : (
                            <span className="shrink-0 text-theme-text-muted">Unrated</span>
                          )}
                          {downloadsFormatted && (
                            <span className="shrink-0 font-medium text-theme-text">• {downloadsFormatted}</span>
                          )}
                          {app.size && <span className="shrink-0">• {app.size}</span>}
                        </div>
                      </div>
                    </div>

                    {/* 3 Dots Menu Button - aligned equally with the left app logo edge */}
                    <div className="relative shrink-0 flex items-center justify-center -mr-2.5 sm:-mr-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        id={`app-menu-btn-${app.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMenu(app.id, e.currentTarget);
                        }}
                        className={`w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer ${
                          openMenuAppId === app.id ? 'bg-theme-hover text-theme-text' : ''
                        }`}
                        aria-label="More actions"
                        title="More actions"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
      </div>

      {/* Dynamic 3-Dots Dropdown Menu - Styled Exactly Like App Details Page & Positioned Dynamically */}
      {openMenuAppId && menuCoords && (() => {
        const app = filteredApps.find((a) => a.id === openMenuAppId) || myApps.find((a) => a.id === openMenuAppId);
        if (!app) return null;
        const canManage = canUserManageApp(app);

        return (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuAppId(null);
                setMenuCoords(null);
                menuTriggerRef.current = null;
              }}
            />
            <div 
              id={`app-menu-dropdown-${app.id}`}
              style={{
                position: 'fixed',
                top: menuCoords.top !== undefined ? `${menuCoords.top}px` : undefined,
                bottom: menuCoords.bottom !== undefined ? `${menuCoords.bottom}px` : undefined,
                right: `${menuCoords.right}px`,
                transformOrigin: menuCoords.transformOrigin,
                maxHeight: 'calc(100vh - 32px)',
              }}
              className="w-52 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 border border-theme-border/20 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-y-auto scrollbar-hide"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                id={`menu-view-store-${app.id}`}
                onClick={() => {
                  setOpenMenuAppId(null);
                  setMenuCoords(null);
                  menuTriggerRef.current = null;
                  onOpenAppDetail?.(app.id);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                View in Store
              </button>

              <button
                id={`menu-reviews-${app.id}`}
                onClick={() => {
                  setOpenMenuAppId(null);
                  setMenuCoords(null);
                  menuTriggerRef.current = null;
                  onOpenAppDetail?.(app.id);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                Reviews & Replies
              </button>

              {canManage && (
                <button
                  id={`menu-update-app-${app.id}`}
                  onClick={() => {
                    setOpenMenuAppId(null);
                    setMenuCoords(null);
                    menuTriggerRef.current = null;
                    handleOpenEditApp(app);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
                >
                  Update app
                </button>
              )}

              {app.downloadUrl && (
                <button
                  id={`menu-copy-apk-${app.id}`}
                  onClick={() => {
                    setOpenMenuAppId(null);
                    setMenuCoords(null);
                    menuTriggerRef.current = null;
                    navigator.clipboard?.writeText(app.downloadUrl);
                    showToast(
                      app.platform === 'windows' || (app.assetName && (app.assetName.endsWith('.exe') || app.assetName.endsWith('.msi') || app.assetName.endsWith('.zip')))
                        ? 'Direct Windows link copied to clipboard!'
                        : 'Direct APK link copied to clipboard!'
                    );
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
                >
                  {app.platform === 'windows' || (app.assetName && (app.assetName.endsWith('.exe') || app.assetName.endsWith('.msi') || app.assetName.endsWith('.zip')))
                    ? 'Copy Windows Link'
                    : 'Copy APK Link'}
                </button>
              )}

              {canManage ? (
                <button
                  id={`menu-delete-${app.id}`}
                  onClick={() => {
                    setOpenMenuAppId(null);
                    setMenuCoords(null);
                    menuTriggerRef.current = null;
                    handleDeleteApp(app.id, app.name);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  Remove from Console
                </button>
              ) : (
                <div className="px-4 py-2 text-xs text-theme-text-muted border-t border-theme-border/20 italic">
                  Published by another developer
                </div>
              )}
            </div>
          </>
        );
      })()}

      <ConfirmationDialog
        isOpen={Boolean(appToDelete)}
        title={`Remove "${appToDelete?.name}"?`}
        description="Are you sure you want to remove this app from your developer console and the store catalog? This action cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isDestructive={true}
        icon="danger"
        onConfirm={confirmDeleteApp}
        onCancel={() => setAppToDelete(null)}
      />

      {/* Top Charts Sort Bottom Sheet */}
      {showTopFilter && (
        <div 
           className="fixed inset-0 z-[60] bg-transparent flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
           onClick={() => setShowTopFilter(false)}
        >
           <div 
             className="bg-theme-card text-theme-text border-none w-full max-w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl pb-4 animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 shadow-2xl overflow-hidden"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="flex flex-col pt-4">
                 <div className="flex items-center justify-between px-5 pb-3">
                   <h2 className="text-[19px] font-medium text-theme-text">Top charts</h2>
                   <button 
                     type="button" 
                     onClick={() => setShowTopFilter(false)} 
                     className="p-1.5 rounded-full hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors"
                   >
                     <X className="w-5 h-5" />
                   </button>
                 </div>
                 <ul className="flex flex-col mt-1">
                    {topFilters.map((filter) => (
                      <li 
                        key={filter} 
                        className={`flex items-center justify-between px-5 py-3.5 cursor-pointer text-[15px] transition-colors ${
                          selectedTopFilter === filter ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-600/5 dark:bg-blue-500/10' : 'text-theme-text hover:bg-theme-hover'
                        }`} 
                        onClick={() => { setSelectedTopFilter(filter); setShowTopFilter(false); }}
                      >
                         <span>{filter}</span>
                         {selectedTopFilter === filter && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>
      )}

      {/* Categories Filter Bottom Sheet */}
      {showCategoriesFilter && (
        <div className="fixed inset-0 z-[70] bg-theme-bg text-theme-text overflow-y-auto scrollbar-hide w-full animate-in slide-in-from-bottom-4 duration-200 flex flex-col shadow-none">
          <div className="flex items-center gap-4 px-4 sm:px-6 md:px-8 h-[68px] sticky top-0 bg-theme-bg shrink-0">
             <button type="button" onClick={() => setShowCategoriesFilter(false)} className="p-2 -ml-2 rounded-full hover:bg-theme-hover transition-colors">
               <X className="w-6 h-6 text-theme-text" />
             </button>
             <h2 className="text-[19px] font-medium text-theme-text">Categories</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-4 sm:px-6 py-2">
             <ul className="flex flex-col">
                {categoriesList.map((category) => (
                  <li 
                    key={category.name} 
                    className={`flex items-center justify-between gap-4 px-4 py-4 cursor-pointer text-[15px] transition-colors rounded-xl ${
                      selectedCategory === category.name ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-600/5 dark:bg-blue-500/10' : 'text-theme-text hover:bg-theme-hover'
                    }`} 
                    onClick={() => { setSelectedCategory(category.name); setShowCategoriesFilter(false); }}
                  >
                     <div className="flex items-center gap-4">
                       {category.icon && <category.icon className={`w-5 h-5 ${selectedCategory === category.name ? 'text-blue-600 dark:text-blue-400' : 'text-theme-text-muted'}`} />}
                       <span>{category.name}</span>
                     </div>
                     {selectedCategory === category.name && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                   </li>
                ))}
             </ul>
          </div>
        </div>
      )}


      {/* Modal: Change Publisher Name */}
      {showChangePublisherModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-theme-card border border-theme-border rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-500 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-text">Change Publisher Name</h3>
                  <p className="text-[11px] text-theme-text-muted">Must be unique across the Prople Store database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePublisherModal(false)}
                className="w-7 h-7 rounded-full text-theme-text-muted hover:text-theme-text hover:bg-theme-hover flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isPublisherNameConflict && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  The name <strong>"{activePublisherName}"</strong> is already claimed by another developer. Publishing forms and releases require an indexed unique publisher name.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1.5">
                New Unique Publisher Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={50}
                  value={newCandidatePublisherName}
                  onChange={(e) => setNewCandidatePublisherName(e.target.value.slice(0, 50))}
                  placeholder="e.g. Acme Software, Sahanur Studio"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-theme-text bg-theme-surface focus:outline-none transition-all ${
                    newCandidatePublisherName.trim().length >= 2 && !isCandidateChecking && !isCandidateAvailable
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : newCandidatePublisherName.trim().length >= 2 && !isCandidateChecking && isCandidateAvailable
                      ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      : 'border-theme-border focus:border-blue-500'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                  {isCandidateChecking ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : newCandidatePublisherName.trim().length >= 2 && isCandidateAvailable ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : newCandidatePublisherName.trim().length >= 2 && !isCandidateAvailable ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : null}
                </div>
              </div>

              {/* Status Message */}
              {isCandidateChecking ? (
                <p className="mt-1 text-xs text-blue-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Checking availability in database...</span>
                </p>
              ) : newCandidatePublisherName.trim().length >= 2 && !isCandidateAvailable ? (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{candidateValidationMsg || 'This publisher name is already taken.'}</span>
                </p>
              ) : newCandidatePublisherName.trim().length >= 2 && isCandidateAvailable ? (
                <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{candidateValidationMsg || 'Publisher name is unique and available!'}</span>
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowChangePublisherModal(false)}
                className="px-4 py-2 bg-theme-hover hover:bg-theme-hover/80 text-theme-text rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewPublisherName}
                disabled={isSavingPublisherName || isCandidateChecking || !isCandidateAvailable || !newCandidatePublisherName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                {isSavingPublisherName ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save & Activate Name</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}