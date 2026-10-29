import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  Ban,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Users,
  Package,
  Star,
  Download,
  ExternalLink,
  MoreVertical,
  Plus,
  X,
  Clock,
  ArrowRight,
  Check,
  CheckCheck,
  Bell,
  MessageSquare,
  Globe,
  UserCheck,
  ChevronDown,
  Github,
  AlertCircle,
  Mail,
  Send,
  Radio,
  Megaphone,
  Copy,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useReviews } from '../context/ReviewContext';
import { useNavigation } from '../context/NavigationContext';
import {
  AdminModerationService,
  AppReportItem,
  ReviewReportItem,
  BannedReleaseLink,
  PublisherRestriction,
  AppModerationState,
  parseBannedTarget,
  validateBannedLinkInput
} from '../services/adminModerationService';
import {
  notifyUserBanned,
  notifyUserUnbanned,
  notifyPublisherAppAction,
  notifyPublisherRestrictionAction,
  notifyUserReviewDeleted,
  sendGlobalBroadcastNotice,
  deleteBroadcastNotification,
  listenToStoreNotifications
} from '../services/firestoreNotificationService';
import { AppDetails, NotificationItem, NotificationCategory } from '../types';
import ConfirmationDialog from './ConfirmationDialog';
import GlobalNoticeDetailModal from './GlobalNoticeDetailModal';
import PullToRefresh from './PullToRefresh';
import { usePreserveScroll } from '../services/scrollManager';
import StoreCircleLoader from './StoreCircleLoader';
import { formatDownloadCount, parseDownloadCount } from '../utils/appMetricsAlgorithm';

interface AdminControlPanelProps {
  onClose: () => void;
  onOpenAppDetail?: (id: string) => void;
  onOpenPublisher?: (publisherName: string) => void;
  onOpenPublisherConsole?: (publisherName: string) => void;
  onOpenReviews?: (appId: string, reviewId?: string) => void;
}

type AdminTab = 'app-reports' | 'review-reports' | 'all-apps' | 'publishers' | 'banned-links' | 'global-notice';

// Notification Row for App Reports (Matching Publisher Console & Notifications UI style)
function AppReportNotificationRow({
  report,
  app,
  onDismiss,
  onOpenPublisherConsole,
  onOpenAppDetail
}: {
  key?: React.Key;
  report: AppReportItem;
  app?: AppDetails;
  onDismiss: (appId: string) => void;
  onOpenPublisherConsole: (publisherName: string) => void;
  onOpenAppDetail: (appId: string) => void;
}) {
  const isPending = report.status === 'pending';

  const timeAgo = useMemo(() => {
    const diff = Date.now() - (report.lastReportedAt || Date.now());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [report.lastReportedAt]);

  const resolvedIcon = app?.iconUrl || (report as any).appIcon || (report as any).iconUrl;

  return (
    <div className="w-full relative select-none">
      <div
        className="w-full relative flex items-start gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group outline-none transition-colors"
        onClick={() => {
          onOpenAppDetail(report.appId);
        }}
      >
        {/* App Icon */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs flex items-center justify-center">
          {resolvedIcon ? (
            <img src={resolvedIcon} alt="" className="w-full h-full object-cover" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-red-500 stroke-[1.75]" />
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                {report.appName || app?.name || 'Reported Application'}
              </h3>
              {isPending && (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 inline-block shadow-xs" title="Pending report" />
              )}
              {report.reportCount > 1 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shrink-0">
                  {report.reportCount} reports
                </span>
              )}
            </div>
            <span className="text-[11px] text-theme-text-muted shrink-0">
              {timeAgo}
            </span>
          </div>

          <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
            <span className="font-medium text-theme-text">Reasons:</span> {report.reportReasons.join(', ')}
            {report.developer && ` • ${report.developer}`}
          </p>

          {report.notes && (
            <div className="text-xs text-theme-text/80 bg-theme-hover/40 rounded-lg p-2 mb-1.5 italic">
              "{report.notes}"
            </div>
          )}

          {/* Interactive Navigation Action Links */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const pub = app?.developer || report.developer || report.appName;
                if (pub) onOpenPublisherConsole(pub);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer bg-transparent border-none p-0"
            >
              <span>View in Store (pub)</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAppDetail(report.appId);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-theme-text-muted hover:text-theme-text cursor-pointer bg-transparent border-none p-0"
            >
              <span>App details</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(report.appId);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-400 cursor-pointer bg-transparent border-none p-0 ml-auto"
            >
              <Trash2 className="w-3 h-3" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Notification Row for Review Reports (Matching Publisher Console & Ratings Page UI style)
function ReviewReportNotificationRow({
  report,
  app,
  onDismiss,
  onOpenReviews,
  onOpenPublisherConsole,
  onDeleteForGuidelines
}: {
  key?: React.Key;
  report: ReviewReportItem;
  app?: AppDetails;
  onDismiss: (reviewId: string) => void;
  onOpenReviews: (appId: string, reviewId: string) => void;
  onOpenPublisherConsole: (publisherName: string) => void;
  onDeleteForGuidelines?: (report: ReviewReportItem) => void;
}) {
  const isPending = report.status === 'pending';

  const timeAgo = useMemo(() => {
    const diff = Date.now() - (report.lastReportedAt || Date.now());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [report.lastReportedAt]);

  const resolvedIcon = app?.iconUrl;

  return (
    <div className="w-full relative select-none">
      <div
        className="w-full relative flex items-start gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group outline-none transition-colors"
        onClick={() => {
          onOpenReviews(report.appId, report.reviewId);
        }}
      >
        {/* Review or App Icon */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-theme-hover shadow-xs flex items-center justify-center">
          {resolvedIcon ? (
            <img src={resolvedIcon} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-blue-600/10 flex items-center justify-center text-blue-500 text-lg font-bold">
              {report.appName ? report.appName.charAt(0).toUpperCase() : 'A'}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                {report.appName || app?.name || 'App Review'}
              </h3>
            </div>
            <span className="text-[11px] text-theme-text-muted shrink-0">
              {timeAgo}
            </span>
          </div>

          {/* Star Rating and Reviewer Name */}
          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted mb-0.5">
            <div className="flex text-amber-400 gap-0.5 text-xs">
              {[1, 2, 3, 4, 5].map((s) => (
                <span 
                  key={s} 
                  className={s <= (report.rating || 5) ? 'text-amber-400' : 'text-zinc-400 dark:text-zinc-600'}
                >
                  ★
                </span>
              ))}
            </div>
            <span>•</span>
            <span className="truncate">{report.userName || 'User Review'}</span>
            {isPending && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 inline-block ml-1" title="Pending review report" />
            )}
          </div>

          {/* Review Snippet */}
          <p className="text-theme-text-muted text-xs sm:text-[13px] leading-relaxed line-clamp-2 mb-0.5">
            {report.reviewText || 'No comment provided'}
          </p>

          {/* Flag reasons tag */}
          <p className="text-[11px] text-red-500/90 font-medium">
            Flagged: {report.reportReasons.join(', ')}{report.reportCount > 1 ? ` (${report.reportCount} flags)` : ''}
          </p>

          {/* Interactive Action Links */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReviews(report.appId, report.reviewId);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer bg-transparent border-none p-0"
            >
              <span>App reviews</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            {app?.developer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPublisherConsole(app.developer);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-theme-text-muted hover:text-theme-text cursor-pointer bg-transparent border-none p-0"
              >
                <span>View in Store (pub)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {onDeleteForGuidelines && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteForGuidelines(report);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-400 cursor-pointer bg-transparent border-none p-0 ml-auto"
                title="Delete review for community guidelines violation"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete (Guidelines)</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(report.reviewId);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-theme-text-muted hover:text-theme-text cursor-pointer bg-transparent border-none p-0"
            >
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterSheetOption {
  key: string;
  label: string;
  count?: number;
}

function AdminFilterSheet({
  isOpen,
  onClose,
  title,
  options,
  currentValue,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: FilterSheetOption[];
  currentValue: string;
  onSelect: (key: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-theme-card text-theme-text border-none w-full max-w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl pb-4 animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col pt-4">
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-[18px] font-semibold text-theme-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-theme-hover text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <ul className="flex flex-col mt-1 max-h-[60vh] overflow-y-auto">
            {options.map((option) => (
              <li
                key={option.key}
                className={`flex items-center justify-between px-5 py-3.5 cursor-pointer text-[15px] transition-colors ${
                  currentValue === option.key
                    ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-600/5 dark:bg-blue-500/10'
                    : 'text-theme-text hover:bg-theme-hover font-normal'
                }`}
                onClick={() => {
                  onSelect(option.key);
                  onClose();
                }}
              >
                <div className="flex items-center gap-2">
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-theme-text-muted">({option.count})</span>
                  )}
                </div>
                {currentValue === option.key && (
                  <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AdminTabSearchBar({
  query,
  setQuery,
  placeholder,
}: {
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
}) {
  return (
    <div className="w-full mb-2 shrink-0">
      <div className="w-full flex items-center bg-theme-hover rounded-full h-[46px] px-4 transition-colors">
        <Search className="w-4.5 h-4.5 text-theme-text-muted mr-3 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 w-full bg-transparent text-theme-text text-[15px] font-normal focus:outline-none placeholder:text-theme-text-muted"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Clear query"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function AdminTabFilterBar({
  filterLabel,
  isFilterActive,
  onOpenFilter,
  searchQuery,
  onReset,
  count,
  unitLabel
}: {
  filterLabel: string;
  isFilterActive: boolean;
  onOpenFilter: () => void;
  searchQuery?: string;
  onReset: () => void;
  count: number;
  unitLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 mb-2 shrink-0">
      <button
        type="button"
        onClick={onOpenFilter}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 border-0 outline-none ${
          isFilterActive
            ? 'bg-blue-600/10 text-blue-500 dark:text-blue-400 font-bold'
            : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
        }`}
      >
        {isFilterActive && <Check className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />}
        <span>{filterLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 ml-0.5 ${isFilterActive ? 'text-blue-500 dark:text-blue-400' : 'text-theme-text-muted'}`} />
      </button>

      {(isFilterActive || (searchQuery && searchQuery.trim())) && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text bg-theme-hover/60 hover:bg-theme-hover transition-colors shrink-0 border-0 outline-none cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      )}

      <div className="flex items-center text-[11px] text-theme-text-muted shrink-0 ml-auto">
        <span>{count} {count === 1 ? unitLabel : `${unitLabel}s`}</span>
      </div>
    </div>
  );
}

export default function AdminControlPanel({
  onClose,
  onOpenAppDetail,
  onOpenPublisher,
  onOpenPublisherConsole,
  onOpenReviews
}: AdminControlPanelProps) {
  const { allAppListings, rawAllAppListings, appsList, apps, removeApp, refreshCatalogue, isPullRefreshing } = useStoreConfig();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { deleteReview } = useReviews();
  const navigation = useNavigation();

  // Unified navigation fallbacks
  const handleOpenAppDetail = useCallback((id: string) => {
    if (onOpenAppDetail) onOpenAppDetail(id);
    else navigation.openAppDetail(id);
  }, [onOpenAppDetail, navigation]);

  const handleOpenPublisherInStore = useCallback((publisherName: string) => {
    if (publisherName) {
      navigation.performSearch(`pub:${publisherName.trim()}`);
    }
  }, [navigation]);

  const handleFilterAppsByPublisher = useCallback((publisherName: string) => {
    if (publisherName) {
      setSearchAppsQuery(publisherName);
      setActiveTab('all-apps');
    }
  }, []);

  const handleOpenPublisherConsole = handleOpenPublisherInStore;

  const handleOpenReviews = useCallback((appId: string, reviewId?: string) => {
    if (onOpenReviews) onOpenReviews(appId, reviewId);
    else navigation.openAppReviews(appId, reviewId);
  }, [onOpenReviews, navigation]);

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('app-reports');

  // Moderation state caches
  const [appReports, setAppReports] = useState<AppReportItem[]>([]);
  const [reviewReports, setReviewReports] = useState<ReviewReportItem[]>([]);
  const [bannedLinks, setBannedLinks] = useState<BannedReleaseLink[]>([]);
  const [publisherRestrictions, setPublisherRestrictions] = useState<Record<string, PublisherRestriction>>({});
  const [moderationStates, setModerationStates] = useState<Record<string, AppModerationState>>({});

  // Search & Filter State across all tabs
  // Tab 1: App Reports
  const [searchAppReportsQuery, setSearchAppReportsQuery] = useState('');
  const [appReportsFilter, setAppReportsFilter] = useState<'all' | 'pending' | 'multiple' | 'policy' | 'harmful' | 'impersonation' | 'inappropriate'>('all');
  const [showAppReportsFilterSheet, setShowAppReportsFilterSheet] = useState(false);

  // Tab 2: Review Reports
  const [searchReviewReportsQuery, setSearchReviewReportsQuery] = useState('');
  const [reviewReportsFilter, setReviewReportsFilter] = useState<'all' | 'pending' | '1star' | 'harassment' | 'spam' | 'offensive'>('all');
  const [showReviewReportsFilterSheet, setShowReviewReportsFilterSheet] = useState(false);

  // Tab 3: All Apps
  const [searchAppsQuery, setSearchAppsQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'active' | 'private' | 'banned' | 'flagged'>('all');
  const [showAppsFilterSheet, setShowAppsFilterSheet] = useState(false);

  // Tab 4: Publishers
  const [searchPublishersQuery, setSearchPublishersQuery] = useState('');
  const [publishersFilter, setPublishersFilter] = useState<'all' | 'active' | 'restricted' | 'blocked'>('all');
  const [showPublishersFilterSheet, setShowPublishersFilterSheet] = useState(false);

  // Tab 5: Banned Links
  const [searchBannedLinksQuery, setSearchBannedLinksQuery] = useState('');
  const [bannedLinksFilter, setBannedLinksFilter] = useState<'all' | 'profiles' | 'releases' | 'direct' | 'github' | 'apk'>('all');
  const [showBannedLinksFilterSheet, setShowBannedLinksFilterSheet] = useState(false);
  const [newBanUrl, setNewBanUrl] = useState('');
  const [newBanReason, setNewBanReason] = useState('Violated developer distribution terms');
  const [banFormError, setBanFormError] = useState<string | null>(null);

  // 3-dots floating menus with precise positioning
  const [openMenuAppId, setOpenMenuAppId] = useState<string | null>(null);
  const [openMenuPublisherKey, setOpenMenuPublisherKey] = useState<string | null>(null);
  const [appMenuCoords, setAppMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    transformOrigin: string;
  } | null>(null);
  const [pubMenuCoords, setPubMenuCoords] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    transformOrigin: string;
  } | null>(null);
  const appMenuTriggerRef = useRef<HTMLElement | null>(null);
  const pubMenuTriggerRef = useRef<HTMLElement | null>(null);

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {}
  });

  // Tab 6: Global Notice Broadcast & Direct Account Messaging State
  const [globalNoticeTitle, setGlobalNoticeTitle] = useState('');
  const [globalNoticeMessage, setGlobalNoticeMessage] = useState('');
  const [globalNoticeCategory, setGlobalNoticeCategory] = useState<NotificationCategory>('announcement');
  const [globalNoticePriority, setGlobalNoticePriority] = useState<'normal' | 'important' | 'critical'>('normal');
  const [globalNoticeActionUrl, setGlobalNoticeActionUrl] = useState('');
  const [globalNoticeActionLabel, setGlobalNoticeActionLabel] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [storeNotifications, setStoreNotifications] = useState<NotificationItem[]>([]);
  const [searchBroadcastsQuery, setSearchBroadcastsQuery] = useState('');
  const [showNoticeCategoryMenu, setShowNoticeCategoryMenu] = useState(false);
  const [selectedNoticeDetail, setSelectedNoticeDetail] = useState<NotificationItem | null>(null);

  // Live subscription to notifications feed for broadcast tracking
  useEffect(() => {
    const unsub = listenToStoreNotifications((notifs) => {
      setStoreNotifications(notifs);
    });
    return () => unsub();
  }, []);

  const globalBroadcastsHistory = useMemo(() => {
    return storeNotifications
      .filter(n => n.targetType === 'global' || n.targetType === 'all' || n.category === 'announcement' || n.category === 'global_notice')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [storeNotifications]);

  const filteredGlobalBroadcasts = useMemo(() => {
    if (!searchBroadcastsQuery.trim()) return globalBroadcastsHistory;
    const q = searchBroadcastsQuery.toLowerCase().trim();
    return globalBroadcastsHistory.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.message || '').toLowerCase().includes(q) ||
      (n.category || '').toLowerCase().includes(q)
    );
  }, [globalBroadcastsHistory, searchBroadcastsQuery]);

  // Presets for Global Broadcasts
  const applyBroadcastPreset = (type: 'store_update' | 'new_feature' | 'maintenance' | 'security' | 'policy') => {
    switch (type) {
      case 'store_update':
        setGlobalNoticeTitle('Prople Store v2.5 Update Released');
        setGlobalNoticeMessage('A new store update is now rolling out with enhanced download speeds, responsive UI refinements, and dark mode optimizations.');
        setGlobalNoticeCategory('app_update');
        setGlobalNoticePriority('normal');
        setGlobalNoticeActionUrl('/');
        setGlobalNoticeActionLabel('Explore Store');
        break;
      case 'new_feature':
        setGlobalNoticeTitle('New Publisher Verification System');
        setGlobalNoticeMessage('Publishers can now verify their domain and release certificates directly from the Publisher Console for instant trust badges.');
        setGlobalNoticeCategory('announcement');
        setGlobalNoticePriority('normal');
        setGlobalNoticeActionUrl('/console');
        setGlobalNoticeActionLabel('Go to Console');
        break;
      case 'maintenance':
        setGlobalNoticeTitle('Scheduled Platform Maintenance');
        setGlobalNoticeMessage('Platform services will undergo scheduled infrastructure maintenance on Sunday at 02:00 UTC. Download mirrors will remain unaffected.');
        setGlobalNoticeCategory('announcement');
        setGlobalNoticePriority('important');
        setGlobalNoticeActionUrl('');
        setGlobalNoticeActionLabel('');
        break;
      case 'security':
        setGlobalNoticeTitle('Security & Ecosystem Advisory');
        setGlobalNoticeMessage('All developers are advised to review external release links and ensure SHA-256 checksums are updated for high-trust verification.');
        setGlobalNoticeCategory('moderation');
        setGlobalNoticePriority('critical');
        setGlobalNoticeActionUrl('');
        setGlobalNoticeActionLabel('');
        break;
      case 'policy':
        setGlobalNoticeTitle('Updated Developer Distribution Policy');
        setGlobalNoticeMessage('Our developer terms have been updated to streamline app submissions and safeguard user privacy across Android and Web ecosystems.');
        setGlobalNoticeCategory('announcement');
        setGlobalNoticePriority('important');
        setGlobalNoticeActionUrl('/about');
        setGlobalNoticeActionLabel('Read Terms');
        break;
    }
  };

  // Handle broadcasting a Global Notice from Tab 6
  const handleSendBroadcast = () => {
    const title = globalNoticeTitle.trim();
    const message = globalNoticeMessage.trim();
    if (!title || !message) {
      showToast('Please enter both title and message', { type: 'error' });
      return;
    }

    setConfirmAction({
      isOpen: true,
      title: 'Broadcast Global Notice?',
      description: 'This announcement will be broadcasted to ALL active users and developers on Prople Store. It will appear immediately in their Notification Centre and push notifications.',
      confirmLabel: 'Broadcast to All',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        setIsBroadcasting(true);
        try {
          const adminEmail = user?.email || 'admin@prople.co.in';
          const sentId = await sendGlobalBroadcastNotice({
            title,
            message,
            category: globalNoticeCategory,
            priority: globalNoticePriority,
            actionUrl: globalNoticeActionUrl.trim() || undefined,
            actionLabel: globalNoticeActionLabel.trim() || undefined,
            senderEmail: adminEmail
          });

          // Optimistic injection into local list
          const optimisticNotif: NotificationItem = {
            id: sentId,
            title,
            message,
            timestamp: 'Just now',
            isUnread: true,
            createdAt: Date.now(),
            category: globalNoticeCategory,
            targetType: 'global',
            actionUrl: globalNoticeActionUrl.trim() || undefined,
            actionLabel: globalNoticeActionLabel.trim() || undefined,
            iconUrl: '/logo.png'
          };
          setStoreNotifications(prev => [optimisticNotif, ...prev.filter(n => n.id !== sentId)]);

          showToast('Global notice successfully broadcasted to all users!', { type: 'success' });

          // Reset fields
          setGlobalNoticeTitle('');
          setGlobalNoticeMessage('');
          setGlobalNoticeActionUrl('');
          setGlobalNoticeActionLabel('');
        } catch (err) {
          console.error('Broadcast failed:', err);
          showToast('Failed to broadcast notice. Please try again.', { type: 'error' });
        } finally {
          setIsBroadcasting(false);
        }
      }
    });
  };

  // Revoke / Delete a broadcast notice
  const handleRevokeBroadcast = (item: NotificationItem) => {
    setConfirmAction({
      isOpen: true,
      title: 'Delete Broadcast Notice?',
      description: `Revoking "${item.title}" will remove it from all users' notification centres immediately.`,
      confirmLabel: 'Delete Broadcast',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteBroadcastNotification(item.id, user?.email || 'admin@prople.co.in');
          setStoreNotifications(prev => prev.filter(n => n.id !== item.id));
          showToast('Broadcast notice revoked from platform', { type: 'success' });
        } catch (err) {
          console.error('Failed to revoke broadcast:', err);
          showToast('Failed to revoke broadcast', { type: 'error' });
        }
      }
    });
  };

  // New banned repo form
  // Refresh moderation data
  const refreshData = useCallback(() => {
    AdminModerationService.syncAdminReportsFromServer().then(() => {
      setAppReports(AdminModerationService.getAppReports());
      setReviewReports(AdminModerationService.getReviewReports());
    }).catch(() => {});
    setAppReports(AdminModerationService.getAppReports());
    setReviewReports(AdminModerationService.getReviewReports());
    setBannedLinks(AdminModerationService.getBannedReleases());
    setPublisherRestrictions(AdminModerationService.getAllPublisherRestrictions());
    setModerationStates(AdminModerationService.getAllModerationStates());
  }, []);

  const adminScrollRef = useRef<HTMLDivElement | null>(null);
  const [isAdminRefreshing, setIsAdminRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  usePreserveScroll(`admin-control-${activeTab}`, adminScrollRef);

  // Initial load transition
  useEffect(() => {
    refreshData();
    const timer = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(timer);
  }, [refreshData]);

  // Real-time synchronization whenever admin moderation action occurs anywhere
  useEffect(() => {
    const handleModerationUpdate = () => {
      refreshData();
    };
    window.addEventListener('admin:moderation:updated', handleModerationUpdate);
    return () => window.removeEventListener('admin:moderation:updated', handleModerationUpdate);
  }, [refreshData]);

  // Pull to refresh handler matching Console Page & Search Results
  const handleAdminPullRefresh = useCallback(async () => {
    setIsAdminRefreshing(true);
    setIsLoading(true);
    try {
      await Promise.all([
        refreshCatalogue(),
        Promise.resolve().then(() => refreshData()),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setIsAdminRefreshing(false);
      setIsLoading(false);
    }
  }, [refreshCatalogue, refreshData]);

  // Execute ban on a GitHub profile or specific release link
  const handleExecuteBan = useCallback(() => {
    const trimmed = newBanUrl.trim();
    if (!trimmed) {
      setBanFormError('Please enter a GitHub profile link, username, or release link.');
      return;
    }
    const valCheck = validateBannedLinkInput(trimmed);
    if (!valCheck.isValid) {
      setBanFormError(valCheck.error || 'Please enter a valid URL or GitHub username (@username).');
      return;
    }
    const parsed = parseBannedTarget(trimmed);
    const reason = newBanReason.trim() || 'Violated developer distribution terms';

    setConfirmAction({
      isOpen: true,
      title: `Ban ${parsed.type === 'profile' ? 'Profile' : 'Release Link'}?`,
      description: `Are you sure you want to ban "${parsed.displayName}" (${trimmed})? Any apps utilizing this source will be blocked from platform distribution, and notifications will be sent.`,
      confirmLabel: 'Ban Target',
      isDestructive: true,
      onConfirm: async () => {
        AdminModerationService.banReleaseUrl(trimmed, reason, parsed.displayName);

        // Direct notification on phone via Firestore notification sending service
        notifyUserBanned({
          targetIdentifier: parsed.targetIdentifier,
          urlOrRepo: trimmed,
          type: parsed.type,
          reason,
          appName: parsed.displayName
        }).catch((err) => {
          console.warn('notifyUserBanned error:', err);
        });

        setNewBanUrl('');
        setBanFormError(null);
        refreshData();
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast(
          parsed.type === 'profile'
            ? `Banned GitHub profile @${parsed.targetIdentifier}: Direct phone notification sent.`
            : `Banned release link from platform: Notification sent to notification centre.`,
          { type: 'success' }
        );
      }
    });
  }, [newBanUrl, newBanReason, refreshData, showToast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Dynamic menu positioning logic mirroring PublisherConsolePage
  const updateAppMenuPosition = useCallback((buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpenMenuAppId(null);
      setAppMenuCoords(null);
      appMenuTriggerRef.current = null;
      return;
    }

    const estimatedMenuHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpwards = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const rightOffset = Math.max(16, window.innerWidth - rect.right);

    if (openUpwards) {
      setAppMenuCoords({
        bottom: window.innerHeight - rect.top + 6,
        right: rightOffset,
        transformOrigin: 'bottom right'
      });
    } else {
      setAppMenuCoords({
        top: rect.bottom + 6,
        right: rightOffset,
        transformOrigin: 'top right'
      });
    }
  }, []);

  const updatePubMenuPosition = useCallback((buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpenMenuPublisherKey(null);
      setPubMenuCoords(null);
      pubMenuTriggerRef.current = null;
      return;
    }

    const estimatedMenuHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpwards = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const rightOffset = Math.max(16, window.innerWidth - rect.right);

    if (openUpwards) {
      setPubMenuCoords({
        bottom: window.innerHeight - rect.top + 6,
        right: rightOffset,
        transformOrigin: 'bottom right'
      });
    } else {
      setPubMenuCoords({
        top: rect.bottom + 6,
        right: rightOffset,
        transformOrigin: 'top right'
      });
    }
  }, []);

  // Dismiss floating menus on scroll or resize immediately to maintain 60fps scrolling
  useEffect(() => {
    if (!openMenuAppId && !openMenuPublisherKey) return;

    const handleScrollOrResize = (e: Event) => {
      if (e.type === 'scroll') {
        setOpenMenuAppId(null);
        setOpenMenuPublisherKey(null);
        setAppMenuCoords(null);
        setPubMenuCoords(null);
        appMenuTriggerRef.current = null;
        pubMenuTriggerRef.current = null;
        return;
      }
      if (appMenuTriggerRef.current) {
        updateAppMenuPosition(appMenuTriggerRef.current);
      }
      if (pubMenuTriggerRef.current) {
        updatePubMenuPosition(pubMenuTriggerRef.current);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenuAppId, openMenuPublisherKey, updateAppMenuPosition, updatePubMenuPosition]);

  // Combined full apps list from store config - uses rawAllAppListings to show all apps to admin
  const fullAppsList = useMemo(() => {
    const list = rawAllAppListings || allAppListings;
    const map = new Map<string, AppDetails>();
    appsList.forEach(a => map.set(a.id, a));
    list.forEach(a => {
      if (!map.has(a.id)) {
        map.set(a.id, (apps[a.id] || a) as AppDetails);
      }
    });
    return Array.from(map.values());
  }, [appsList, rawAllAppListings, allAppListings, apps]);

  // Filtered lists for each tab
  const filteredAppReports = useMemo(() => {
    let list = appReports;
    if (searchAppReportsQuery.trim()) {
      const q = searchAppReportsQuery.toLowerCase().trim();
      list = list.filter(r => 
        (r.appName && r.appName.toLowerCase().includes(q)) ||
        (r.appId && r.appId.toLowerCase().includes(q)) ||
        (r.reasons && r.reasons.some(re => re.toLowerCase().includes(q))) ||
        (r.notes && r.notes.some(note => note.toLowerCase().includes(q)))
      );
    }
    if (appReportsFilter === 'pending') {
      list = list.filter(r => r.status === 'pending');
    } else if (appReportsFilter === 'multiple') {
      list = list.filter(r => r.reportCount > 1);
    } else if (appReportsFilter === 'policy') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('policy') || re.toLowerCase().includes('terms')));
    } else if (appReportsFilter === 'harmful') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('harmful') || re.toLowerCase().includes('malware') || re.toLowerCase().includes('security')));
    } else if (appReportsFilter === 'impersonation') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('impersonation') || re.toLowerCase().includes('fake')));
    } else if (appReportsFilter === 'inappropriate') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('inappropriate') || re.toLowerCase().includes('content')));
    }
    return list;
  }, [appReports, searchAppReportsQuery, appReportsFilter]);

  const filteredReviewReports = useMemo(() => {
    let list = reviewReports;
    if (searchReviewReportsQuery.trim()) {
      const q = searchReviewReportsQuery.toLowerCase().trim();
      list = list.filter(r => 
        (r.userName && r.userName.toLowerCase().includes(q)) ||
        (r.comment && r.comment.toLowerCase().includes(q)) ||
        (r.appName && r.appName.toLowerCase().includes(q)) ||
        (r.reasons && r.reasons.some(re => re.toLowerCase().includes(q)))
      );
    }
    if (reviewReportsFilter === 'pending') {
      list = list.filter(r => r.status === 'pending');
    } else if (reviewReportsFilter === '1star') {
      list = list.filter(r => r.rating === 1);
    } else if (reviewReportsFilter === 'harassment') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('harassment') || re.toLowerCase().includes('hate')));
    } else if (reviewReportsFilter === 'spam') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('spam') || re.toLowerCase().includes('advertising')));
    } else if (reviewReportsFilter === 'offensive') {
      list = list.filter(r => r.reasons && r.reasons.some(re => re.toLowerCase().includes('offensive') || re.toLowerCase().includes('inappropriate')));
    }
    return list;
  }, [reviewReports, searchReviewReportsQuery, reviewReportsFilter]);

  const filteredApps = useMemo(() => {
    let list = fullAppsList;
    if (searchAppsQuery.trim()) {
      const q = searchAppsQuery.toLowerCase().trim();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.developer && a.developer.toLowerCase().includes(q)) ||
        (a.publisherName && a.publisherName.toLowerCase().includes(q)) ||
        ((a as any).ownerEmail && (a as any).ownerEmail.toLowerCase().includes(q)) ||
        (a.developerEmail && a.developerEmail.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        a.id.toLowerCase().includes(q)
      );
    }
    if (appStatusFilter === 'private') {
      list = list.filter(a => moderationStates[a.id]?.isPrivate);
    } else if (appStatusFilter === 'banned') {
      list = list.filter(a => moderationStates[a.id]?.isBanned);
    } else if (appStatusFilter === 'flagged') {
      const flaggedIds = new Set(appReports.filter(r => r.status === 'pending').map(r => r.appId));
      list = list.filter(a => flaggedIds.has(a.id));
    } else if (appStatusFilter === 'active') {
      list = list.filter(a => !moderationStates[a.id]?.isPrivate && !moderationStates[a.id]?.isBanned);
    }
    return list;
  }, [fullAppsList, searchAppsQuery, appStatusFilter, moderationStates, appReports]);

  // Detected publishers list
  const detectedPublishers = useMemo(() => {
    const pubMap = new Map<string, {
      name: string;
      key: string;
      appCount: number;
      email?: string;
      totalDownloads: number;
      isRestricted: boolean;
      isBlocked: boolean;
    }>();

    fullAppsList.forEach(app => {
      const pubName = (app.publisherName || app.developer || 'Unknown Publisher').trim();
      if (!pubName) return;
      const key = pubName.toLowerCase();
      const restriction = publisherRestrictions[key];
      const isRestricted = Boolean(restriction?.isRestricted);
      const isBlocked = Boolean(restriction?.isBlocked || (restriction as any)?.isSuspended);

      const existing = pubMap.get(key) || {
        name: pubName,
        key,
        appCount: 0,
        email: app.developerEmail || app.publisherEmail,
        totalDownloads: 0,
        isRestricted,
        isBlocked
      };

      existing.isRestricted = isRestricted;
      existing.isBlocked = isBlocked;
      existing.appCount += 1;
      existing.totalDownloads += (app.downloadsCount || 10);
      if (!existing.email && (app.developerEmail || app.publisherEmail)) {
        existing.email = app.developerEmail || app.publisherEmail;
      }
      pubMap.set(key, existing);
    });

    let list = Array.from(pubMap.values()).sort((a, b) => b.appCount - a.appCount);

    if (searchPublishersQuery.trim()) {
      const q = searchPublishersQuery.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q)));
    }

    return list;
  }, [fullAppsList, publisherRestrictions, searchPublishersQuery]);

  const filteredPublishers = useMemo(() => {
    let list = detectedPublishers;
    if (publishersFilter === 'active') {
      list = list.filter(p => !p.isRestricted && !p.isBlocked);
    } else if (publishersFilter === 'restricted') {
      list = list.filter(p => p.isRestricted);
    } else if (publishersFilter === 'blocked') {
      list = list.filter(p => p.isBlocked);
    }
    return list;
  }, [detectedPublishers, publishersFilter]);

  const filteredBannedLinks = useMemo(() => {
    let list = bannedLinks;
    if (searchBannedLinksQuery.trim()) {
      const q = searchBannedLinksQuery.toLowerCase().trim();
      list = list.filter(b => {
        const u = (b.urlOrRepo || (b as any).url || '').toLowerCase();
        const r = (b.reason || '').toLowerCase();
        const t = (b.targetIdentifier || '').toLowerCase();
        const a = (b.appName || '').toLowerCase();
        return u.includes(q) || r.includes(q) || t.includes(q) || a.includes(q);
      });
    }
    if (bannedLinksFilter === 'profiles') {
      list = list.filter(b => {
        const u = (b.urlOrRepo || (b as any).url || '').toLowerCase();
        return b.type === 'profile' || (!u.includes('/') && !u.includes('.apk')) || (u.includes('github.com/') && u.replace(/^https?:\/\/github\.com\//i, '').split('/').filter(Boolean).length === 1);
      });
    } else if (bannedLinksFilter === 'releases') {
      list = list.filter(b => {
        const u = (b.urlOrRepo || (b as any).url || '').toLowerCase();
        return b.type === 'release' || u.includes('/releases') || u.includes('.apk');
      });
    } else if (bannedLinksFilter === 'github') {
      list = list.filter(b => (b.urlOrRepo || (b as any).url || '').toLowerCase().includes('github.com'));
    } else if (bannedLinksFilter === 'apk' || bannedLinksFilter === 'direct') {
      list = list.filter(b => (b.urlOrRepo || (b as any).url || '').toLowerCase().includes('.apk'));
    }
    return list;
  }, [bannedLinks, searchBannedLinksQuery, bannedLinksFilter]);

  // Labels for Sheet Filter Buttons
  const appReportsFilterLabel = useMemo(() => {
    switch (appReportsFilter) {
      case 'pending': return 'Pending only';
      case 'multiple': return 'Multiple reports';
      case 'policy': return 'Policy violations';
      case 'harmful': return 'Harmful / Malware';
      case 'impersonation': return 'Impersonation';
      case 'inappropriate': return 'Inappropriate';
      default: return 'All reports';
    }
  }, [appReportsFilter]);

  const reviewReportsFilterLabel = useMemo(() => {
    switch (reviewReportsFilter) {
      case 'pending': return 'Pending only';
      case '1star': return '1-star reviews';
      case 'harassment': return 'Harassment & hate';
      case 'spam': return 'Spam & promotion';
      case 'offensive': return 'Offensive / Inappropriate';
      default: return 'All flagged';
    }
  }, [reviewReportsFilter]);

  const appsFilterLabel = useMemo(() => {
    switch (appStatusFilter) {
      case 'active': return 'Active (Public)';
      case 'private': return 'Private only';
      case 'banned': return 'Blocked / Banned';
      case 'flagged': return 'Flagged / Reported';
      default: return 'All apps';
    }
  }, [appStatusFilter]);

  const publishersFilterLabel = useMemo(() => {
    switch (publishersFilter) {
      case 'active': return 'Active & Clear';
      case 'restricted': return 'Restricted';
      case 'blocked': return 'Blocked / Suspended';
      default: return 'All publishers';
    }
  }, [publishersFilter]);

  const bannedLinksFilterLabel = useMemo(() => {
    switch (bannedLinksFilter) {
      case 'profiles': return 'GitHub user profiles';
      case 'releases': return 'Release & repo links';
      case 'github': return 'GitHub releases';
      case 'apk': return 'APK packages';
      case 'direct': return 'Direct APK packages';
      default: return 'All banned entries';
    }
  }, [bannedLinksFilter]);

  // Filter Sheet Options
  const appReportsFilterOptions: FilterSheetOption[] = useMemo(() => [
    { key: 'all', label: 'All reports', count: appReports.length },
    { key: 'pending', label: 'Pending only', count: appReports.filter(r => r.status === 'pending').length },
    { key: 'multiple', label: 'Multiple reports (>1)', count: appReports.filter(r => r.reportCount > 1).length },
    { key: 'policy', label: 'Policy violations', count: appReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('policy') || re.toLowerCase().includes('terms'))).length },
    { key: 'harmful', label: 'Harmful / Malware', count: appReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('harmful') || re.toLowerCase().includes('malware') || re.toLowerCase().includes('security'))).length },
    { key: 'impersonation', label: 'Impersonation & copycats', count: appReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('impersonation') || re.toLowerCase().includes('fake'))).length },
    { key: 'inappropriate', label: 'Inappropriate content', count: appReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('inappropriate') || re.toLowerCase().includes('content'))).length },
  ], [appReports]);

  const reviewReportsFilterOptions: FilterSheetOption[] = useMemo(() => [
    { key: 'all', label: 'All flagged reviews', count: reviewReports.length },
    { key: 'pending', label: 'Pending only', count: reviewReports.filter(r => r.status === 'pending').length },
    { key: '1star', label: '1-star reviews', count: reviewReports.filter(r => r.rating === 1).length },
    { key: 'harassment', label: 'Harassment & hate speech', count: reviewReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('harassment') || re.toLowerCase().includes('hate'))).length },
    { key: 'spam', label: 'Spam & promotion', count: reviewReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('spam') || re.toLowerCase().includes('advertising'))).length },
    { key: 'offensive', label: 'Offensive & inappropriate', count: reviewReports.filter(r => r.reasons?.some(re => re.toLowerCase().includes('offensive') || re.toLowerCase().includes('inappropriate'))).length },
  ], [reviewReports]);

  const appsFilterOptions: FilterSheetOption[] = useMemo(() => {
    const flaggedIds = new Set(appReports.filter(r => r.status === 'pending').map(r => r.appId));
    return [
      { key: 'all', label: 'All apps', count: fullAppsList.length },
      { key: 'active', label: 'Active (Public)', count: fullAppsList.filter(a => !moderationStates[a.id]?.isPrivate && !moderationStates[a.id]?.isBanned).length },
      { key: 'private', label: 'Private only', count: fullAppsList.filter(a => moderationStates[a.id]?.isPrivate).length },
      { key: 'banned', label: 'Blocked / Banned', count: fullAppsList.filter(a => moderationStates[a.id]?.isBanned).length },
      { key: 'flagged', label: 'Flagged / Reported', count: fullAppsList.filter(a => flaggedIds.has(a.id)).length },
    ];
  }, [fullAppsList, moderationStates, appReports]);

  const publishersFilterOptions: FilterSheetOption[] = useMemo(() => {
    return [
      { key: 'all', label: 'All publishers', count: detectedPublishers.length },
      { key: 'active', label: 'Active & Clear', count: detectedPublishers.filter(p => !p.isRestricted && !p.isBlocked).length },
      { key: 'restricted', label: 'Restricted', count: detectedPublishers.filter(p => p.isRestricted).length },
      { key: 'blocked', label: 'Blocked / Suspended', count: detectedPublishers.filter(p => p.isBlocked).length },
    ];
  }, [detectedPublishers]);

  const bannedLinksFilterOptions: FilterSheetOption[] = useMemo(() => {
    return [
      { key: 'all', label: 'All banned entries', count: bannedLinks.length },
      {
        key: 'profiles',
        label: 'GitHub user profiles',
        count: bannedLinks.filter(b => {
          const u = (b.urlOrRepo || (b as any).url || '').toLowerCase();
          return b.type === 'profile' || (!u.includes('/') && !u.includes('.apk')) || (u.includes('github.com/') && u.replace(/^https?:\/\/github\.com\//i, '').split('/').filter(Boolean).length === 1);
        }).length
      },
      {
        key: 'releases',
        label: 'Release & repo links',
        count: bannedLinks.filter(b => {
          const u = (b.urlOrRepo || (b as any).url || '').toLowerCase();
          return b.type === 'release' || u.includes('/releases') || u.includes('.apk');
        }).length
      },
      {
        key: 'direct',
        label: 'Direct APK files',
        count: bannedLinks.filter(b => (b.urlOrRepo || (b as any).url || '').toLowerCase().includes('.apk')).length
      },
    ];
  }, [bannedLinks]);

  // Counter badges
  const pendingAppReportsCount = useMemo(() => {
    return appReports.filter(r => r.status === 'pending').length;
  }, [appReports]);

  const pendingReviewReportsCount = useMemo(() => {
    return reviewReports.filter(r => r.status === 'pending').length;
  }, [reviewReports]);

  // App Report Handlers (Removal and dismiss)
  const handleDismissAppReport = (appId: string) => {
    const report = appReports.find(r => r.appId === appId);
    const targetName = report?.appName || 'this application';
    setConfirmAction({
      isOpen: true,
      title: 'Remove App Report?',
      description: `Are you sure you want to remove the report notification for "${targetName}"? This will clear it from your moderation queue.`,
      confirmLabel: 'Remove Report',
      isDestructive: false,
      onConfirm: () => {
        AdminModerationService.deleteAppReport(appId);
        setAppReports(prev => prev.filter(r => r.appId !== appId));
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast('App report notification removed', { type: 'success' });
      }
    });
  };

  const handleDismissReviewReport = (reviewId: string) => {
    const report = reviewReports.find(r => r.reviewId === reviewId);
    const targetApp = report?.appName || 'App';
    const targetUser = report?.userName || 'User';
    setConfirmAction({
      isOpen: true,
      title: 'Remove Review Report?',
      description: `Are you sure you want to remove the report for ${targetUser}'s review on "${targetApp}"? The review will remain published.`,
      confirmLabel: 'Remove Report',
      isDestructive: false,
      onConfirm: () => {
        AdminModerationService.deleteReviewReport(reviewId);
        setReviewReports(prev => prev.filter(r => r.reviewId !== reviewId));
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast('Review report notification removed', { type: 'success' });
      }
    });
  };

  // Delete review for Community Guidelines & notify author on phone & notification centre
  const handleDeleteReviewForGuidelines = (report: ReviewReportItem) => {
    setConfirmAction({
      isOpen: true,
      title: 'Delete review for Community Guidelines?',
      description: `Delete this review by "${report.userName}" on "${report.appName}". The author will receive a direct notification on their device and in their Notification Centre with the reason.`,
      confirmLabel: 'Delete & Notify Author',
      isDestructive: true,
      onConfirm: () => {
        const reason = report.reportReasons?.length ? report.reportReasons.join(', ') : 'Violated community guidelines';
        deleteReview(report.appId, report.reviewId, {
          appName: report.appName,
          reason,
          targetUser: {
            name: report.userName,
            email: report.userEmail
          }
        });
        AdminModerationService.resolveReviewReport(report.reviewId, `Deleted: ${reason}`);
        AdminModerationService.deleteReviewReport(report.reviewId);
        setReviewReports(prev => prev.filter(r => r.reviewId !== report.reviewId));
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast('Review deleted for community guidelines. Author notified on device.', { type: 'success' });
      }
    });
  };

  // 3-Dots App Actions mirroring PublisherConsolePage
  const handleToggleAppMenu = useCallback((appId: string, buttonEl: HTMLElement) => {
    if (openMenuAppId === appId) {
      setOpenMenuAppId(null);
      setAppMenuCoords(null);
      appMenuTriggerRef.current = null;
    } else {
      appMenuTriggerRef.current = buttonEl;
      updateAppMenuPosition(buttonEl);
      setOpenMenuAppId(appId);
      setOpenMenuPublisherKey(null);
      setPubMenuCoords(null);
      pubMenuTriggerRef.current = null;
    }
  }, [openMenuAppId, updateAppMenuPosition]);

  const handleTogglePublisherMenu = useCallback((publisherKey: string, buttonEl: HTMLElement) => {
    if (openMenuPublisherKey === publisherKey) {
      setOpenMenuPublisherKey(null);
      setPubMenuCoords(null);
      pubMenuTriggerRef.current = null;
    } else {
      pubMenuTriggerRef.current = buttonEl;
      updatePubMenuPosition(buttonEl);
      setOpenMenuPublisherKey(publisherKey);
      setOpenMenuAppId(null);
      setAppMenuCoords(null);
      appMenuTriggerRef.current = null;
    }
  }, [openMenuPublisherKey, updatePubMenuPosition]);

  // App Administration Actions
  const handleToggleAppPrivate = (app: AppDetails) => {
    setOpenMenuAppId(null);
    const isPrivate = moderationStates[app.id]?.isPrivate || false;
    const next = !isPrivate;
    setConfirmAction({
      isOpen: true,
      title: next ? `Make "${app.name}" Private?` : `Make "${app.name}" Public?`,
      description: next
        ? `Setting "${app.name}" to private will hide it from the public store, search index, and home feed. The publisher will receive a notification.`
        : `Making "${app.name}" public will restore its visibility across the entire store catalogue for all users.`,
      confirmLabel: next ? 'Make Private' : 'Make Public',
      isDestructive: next,
      onConfirm: () => {
        const reason = next ? 'Toggled to private by Platform Administration' : 'Restored to public store by Platform Administration';
        AdminModerationService.setAppPrivate(app.id, next, reason);
        refreshData();
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        notifyPublisherAppAction({
          appId: app.id,
          appName: app.name,
          action: next ? 'private' : 'public',
          reason,
          publisherName: app.developer || app.publisherName,
          publisherEmail: app.developerEmail || app.developerInfo?.email,
          iconUrl: app.iconUrl
        }).catch(() => {});
        showToast(next ? `"${app.name}" is now Private: Publisher notified` : `"${app.name}" is now Public in Store`);
      }
    });
  };

  const handleToggleAppBan = (app: AppDetails) => {
    const isBanned = moderationStates[app.id]?.isBanned || false;
    const next = !isBanned;
    setOpenMenuAppId(null);
    setConfirmAction({
      isOpen: true,
      title: next ? `Ban "${app.name}"?` : `Unban "${app.name}"?`,
      description: next
        ? `Banning "${app.name}" immediately blocks installations and downloads across the entire platform. The publisher will receive a direct notification on their device.`
        : `Unbanning will restore normal platform access for "${app.name}". The publisher will be notified.`,
      confirmLabel: next ? 'Ban App' : 'Unban App',
      isDestructive: next,
      onConfirm: () => {
        const reason = next ? 'Violated developer distribution terms' : 'Platform access restored by Platform Administration';
        AdminModerationService.setAppBanned(app.id, next, reason);
        refreshData();
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        notifyPublisherAppAction({
          appId: app.id,
          appName: app.name,
          action: next ? 'banned' : 'unbanned',
          reason,
          publisherName: app.developer || app.publisherName,
          publisherEmail: app.developerEmail || app.developerInfo?.email,
          iconUrl: app.iconUrl
        }).catch(() => {});
        showToast(next ? `"${app.name}" has been banned: Publisher notified on phone` : `"${app.name}" unbanned`);
      }
    });
  };

  const handleBanAppDownloadLink = (app: AppDetails) => {
    setOpenMenuAppId(null);
    const downloadUrl = app.downloadUrl || (app as any).platforms?.android?.downloadUrl || '';
    if (!downloadUrl) {
      showToast('No download link registered for this app');
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Ban release URL for "${app.name}"?`,
      description: `Prevent any apps from using this release asset: "${downloadUrl}". Existing downloads will be blocked.`,
      confirmLabel: 'Ban URL',
      isDestructive: true,
      onConfirm: () => {
        AdminModerationService.banReleaseUrl(downloadUrl, `Banned via platform enforcement on ${app.name}`);
        refreshData();
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast('Release download URL banned from platform');
      }
    });
  };

  const handleDeleteAppPermanently = (app: AppDetails) => {
    setOpenMenuAppId(null);
    setConfirmAction({
      isOpen: true,
      title: `Delete "${app.name}" permanently?`,
      description: `This will completely remove "${app.name}" from the store catalog, database, and search index. The publisher will receive a direct notification on their device.`,
      confirmLabel: 'Delete Forever',
      isDestructive: true,
      onConfirm: () => {
        // Immediately close confirmation popup so user is not blocked
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast(`Deleting "${app.name}" from platform...`, { type: 'info', duration: 3000 });

        // Process deletion in background and report status via toast
        (async () => {
          try {
            await removeApp(app.id);
            AdminModerationService.deleteAppReport(app.id);
            refreshData();
            await refreshCatalogue();
            notifyPublisherAppAction({
              appId: app.id,
              appName: app.name,
              action: 'deleted',
              reason: 'Application removed permanently by Platform Administration',
              publisherName: app.developer || app.publisherName,
              publisherEmail: app.developerEmail || app.developerInfo?.email,
              iconUrl: app.iconUrl
            }).catch(() => {});
            showToast(`"${app.name}" deleted permanently: Publisher notified`, { type: 'success' });
          } catch (err: any) {
            console.error('[AdminControlPanel] Failed to delete app:', err);
            showToast(err?.message || `Failed to delete "${app.name}"`, { type: 'error' });
          }
        })();
      }
    });
  };

  // Publisher Actions
  const handleTogglePublisherRestriction = (pubName: string, currentlyRestricted: boolean) => {
    setOpenMenuPublisherKey(null);
    const next = !currentlyRestricted;
    setConfirmAction({
      isOpen: true,
      title: next ? `Restrict Publisher "${pubName}"?` : `Lift Restrictions on "${pubName}"?`,
      description: next
        ? `Restricting "${pubName}" flags all existing apps, limits publishing privileges, and routes all future updates for mandatory admin review.`
        : `Lifting restrictions restores standard publishing privileges for "${pubName}".`,
      confirmLabel: next ? 'Restrict Publisher' : 'Lift Restriction',
      isDestructive: next,
      onConfirm: () => {
        const reason = next ? 'Account restricted by Platform Administration' : 'Account restriction lifted by Platform Administration';
        AdminModerationService.setPublisherRestricted(pubName, next, reason);
        refreshData();
        refreshCatalogue().catch(() => {});
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        notifyPublisherRestrictionAction({
          publisherName: pubName,
          action: next ? 'restricted' : 'unrestricted',
          reason
        }).catch(() => {});
        showToast(next ? `Publisher "${pubName}" is now restricted: Quotas throttled` : `Restriction lifted for "${pubName}"`);
      }
    });
  };

  const handleTogglePublisherSuspension = (pubName: string, currentlySuspended: boolean) => {
    setOpenMenuPublisherKey(null);
    const next = !currentlySuspended;
    setConfirmAction({
      isOpen: true,
      title: next ? `Suspend Publisher "${pubName}"?` : `Reactivate Publisher "${pubName}"?`,
      description: next
        ? `Suspension automatically hides ALL apps by "${pubName}" from the public store catalogue (Home, Categories, Search, Top Charts) and blocks them from publishing or updating apps. A direct notification will be sent to their phone.`
        : `Reactivate publisher privileges for "${pubName}" and restore their applications to active standing.`,
      confirmLabel: next ? 'Suspend Publisher' : 'Reactivate',
      isDestructive: next,
      onConfirm: () => {
        const reason = next ? 'Publisher privileges suspended by Platform Administration' : 'Publisher reactivated by Platform Administration';
        AdminModerationService.setPublisherSuspended(pubName, next, reason);
        refreshData();
        refreshCatalogue().catch(() => {});
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        notifyPublisherRestrictionAction({
          publisherName: pubName,
          action: next ? 'suspended' : 'reactivated',
          reason
        }).catch(() => {});
        showToast(next ? `Publisher "${pubName}" suspended: All apps hidden from store` : `Publisher "${pubName}" reactivated`);
      }
    });
  };

  const handlePublisherTakeAllPrivate = (pubName: string) => {
    setOpenMenuPublisherKey(null);
    const pubApps = fullAppsList.filter(a => (a.publisherName || a.developer || '').trim().toLowerCase() === pubName.trim().toLowerCase());
    if (pubApps.length === 0) {
      showToast('No apps found for this publisher');
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Make all ${pubApps.length} apps private?`,
      description: `Hide all applications published by "${pubName}" from the public store catalog immediately. Regular users will no longer see them in search, categories, or home.`,
      confirmLabel: 'Take All Private',
      isDestructive: true,
      onConfirm: () => {
        pubApps.forEach(a => {
          AdminModerationService.setAppPrivate(a.id, true, `Batch admin action for publisher ${pubName}`);
        });
        refreshData();
        refreshCatalogue().catch(() => {});
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast(`All ${pubApps.length} apps by ${pubName} taken Private (Hidden from store)`);
      }
    });
  };

  const handlePublisherMakeAllPublic = (pubName: string) => {
    setOpenMenuPublisherKey(null);
    const pubApps = fullAppsList.filter(a => (a.publisherName || a.developer || '').trim().toLowerCase() === pubName.trim().toLowerCase());
    if (pubApps.length === 0) {
      showToast('No apps found for this publisher');
      return;
    }
    setConfirmAction({
      isOpen: true,
      title: `Make all ${pubApps.length} apps public?`,
      description: `Restore public visibility for all applications published by "${pubName}" across the entire store catalogue and search results.`,
      confirmLabel: 'Make All Public',
      isDestructive: false,
      onConfirm: () => {
        pubApps.forEach(a => {
          AdminModerationService.setAppPrivate(a.id, false, `Batch admin action for publisher ${pubName}`);
        });
        refreshData();
        refreshCatalogue().catch(() => {});
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        showToast(`All ${pubApps.length} apps by ${pubName} made Public (Visible in store)`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-theme-bg text-theme-text w-full flex flex-col h-full overflow-hidden">
      {/* Top Header - The Native Page Header */}
      {/* Admin Panel Header */}
      <header className="sticky top-0 bg-theme-bg z-20 flex flex-col w-full shrink-0 border-0">
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              id="admin-panel-back-btn"
              onClick={onClose}
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-theme-text" />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate">
                  Admin Control Panel
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Super Admin</span>
                </span>
              </div>
              <p className="text-[12px] text-theme-text-muted truncate">
                Signed in as {user?.email || 'Administrator'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Horizontal Tabs (App Reports, Review Reports, All Platform Apps, Publishers, Banned Links, Global Notice) */}
        <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto scrollbar-hide py-2">
          {/* App Reports Tab */}
          <button
            type="button"
            id="admin-tab-app-reports"
            onClick={() => setActiveTab('app-reports')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              activeTab === 'app-reports'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>App Reports</span>
          </button>

          {/* Review Reports Tab */}
          <button
            type="button"
            id="admin-tab-review-reports"
            onClick={() => setActiveTab('review-reports')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              activeTab === 'review-reports'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Review Reports</span>
          </button>

          {/* All Platform Apps Tab */}
          <button
            type="button"
            id="admin-tab-all-apps"
            onClick={() => setActiveTab('all-apps')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              activeTab === 'all-apps'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>All Platform Apps</span>
          </button>

          {/* Publishers Tab */}
          <button
            type="button"
            id="admin-tab-publishers"
            onClick={() => setActiveTab('publishers')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              activeTab === 'publishers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Publishers</span>
          </button>

          {/* Banned Links Tab */}
          <button
            type="button"
            id="admin-tab-banned-links"
            onClick={() => setActiveTab('banned-links')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              activeTab === 'banned-links'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Banned Links</span>
          </button>

          {/* Global Notice Tab */}
          <button
            type="button"
            id="admin-tab-global-notice"
            onClick={() => setActiveTab('global-notice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 border-0 outline-none ${
              activeTab === 'global-notice'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-theme-hover/60 hover:bg-theme-hover text-theme-text-muted hover:text-theme-text'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Global Notice</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content with Pull-To-Refresh matching Search Results Page */}
      <PullToRefresh
        scrollRef={adminScrollRef}
        onRefresh={handleAdminPullRefresh}
        isRefreshing={isAdminRefreshing || isPullRefreshing}
        dismissBeforeEnd={true}
        earlyDismissDurationMs={300}
        className="flex-1 min-h-0 flex flex-col w-full relative"
      >
        <main
          ref={adminScrollRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 md:px-6 lg:px-8 pt-2 sm:pt-3 pb-8 scrollbar-hide flex flex-col min-h-0 w-full max-w-7xl mx-auto outline-none focus:outline-none overscroll-y-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
              <StoreCircleLoader size="md" />
            </div>
          ) : (
            <>
              {/* TAB 1: App Reports */}
              {activeTab === 'app-reports' && (
          <div className="flex flex-col w-full">
            <AdminTabSearchBar
              query={searchAppReportsQuery}
              setQuery={setSearchAppReportsQuery}
              placeholder="Search reports by app name, ID, or violation reason..."
            />
            <AdminTabFilterBar
              filterLabel={appReportsFilterLabel}
              isFilterActive={appReportsFilter !== 'all'}
              onOpenFilter={() => setShowAppReportsFilterSheet(true)}
              searchQuery={searchAppReportsQuery}
              onReset={() => {
                setSearchAppReportsQuery('');
                setAppReportsFilter('all');
              }}
              count={filteredAppReports.length}
              unitLabel="report"
            />

            {filteredAppReports.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-theme-hover flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                  <ShieldCheck className="w-7 h-7 stroke-[1.5]" />
                </div>
                <h3 className="text-theme-text font-semibold text-base mb-1">
                  {searchAppReportsQuery || appReportsFilter !== 'all' ? 'No matching reports' : 'No app reports'}
                </h3>
                <p className="text-xs text-theme-text-muted max-w-sm leading-relaxed">
                  {searchAppReportsQuery || appReportsFilter !== 'all'
                    ? 'No reports match your current search or filter criteria.'
                    : 'All platform applications are currently in good standing. No safety or policy violations reported.'}
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col space-y-1">
                {filteredAppReports.map(report => {
                  const matchedApp = fullAppsList.find(a => a.id === report.appId);
                  return (
                    <AppReportNotificationRow
                      key={report.id || report.appId}
                      report={report}
                      app={matchedApp}
                      onDismiss={handleDismissAppReport}
                      onOpenPublisherConsole={handleOpenPublisherConsole}
                      onOpenAppDetail={handleOpenAppDetail}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Review Reports */}
        {activeTab === 'review-reports' && (
          <div className="flex flex-col w-full">
            <AdminTabSearchBar
              query={searchReviewReportsQuery}
              setQuery={setSearchReviewReportsQuery}
              placeholder="Search flagged reviews by user, app, or keyword..."
            />
            <AdminTabFilterBar
              filterLabel={reviewReportsFilterLabel}
              isFilterActive={reviewReportsFilter !== 'all'}
              onOpenFilter={() => setShowReviewReportsFilterSheet(true)}
              searchQuery={searchReviewReportsQuery}
              onReset={() => {
                setSearchReviewReportsQuery('');
                setReviewReportsFilter('all');
              }}
              count={filteredReviewReports.length}
              unitLabel="review"
            />

            {filteredReviewReports.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-theme-hover flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                  <CheckCheck className="w-7 h-7 stroke-[1.5]" />
                </div>
                <h3 className="text-theme-text font-semibold text-base mb-1">
                  {searchReviewReportsQuery || reviewReportsFilter !== 'all' ? 'No matching flagged reviews' : 'No flagged reviews'}
                </h3>
                <p className="text-xs text-theme-text-muted max-w-sm leading-relaxed">
                  {searchReviewReportsQuery || reviewReportsFilter !== 'all'
                    ? 'No community reviews match your current search or filter criteria.'
                    : 'No community reviews currently need moderation. All reviews adhere to platform guidelines.'}
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col space-y-1">
                {filteredReviewReports.map(report => {
                  const matchedApp = fullAppsList.find(a => a.id === report.appId);
                  return (
                    <ReviewReportNotificationRow
                      key={report.id || report.reviewId}
                      report={report}
                      app={matchedApp}
                      onDismiss={handleDismissReviewReport}
                      onOpenReviews={handleOpenReviews}
                      onOpenPublisherConsole={handleOpenPublisherConsole}
                      onDeleteForGuidelines={handleDeleteReviewForGuidelines}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: All Platform Apps */}
        {activeTab === 'all-apps' && (
          <div className="flex flex-col w-full">
            <AdminTabSearchBar
              query={searchAppsQuery}
              setQuery={setSearchAppsQuery}
              placeholder="Search all platform apps by name, developer, category..."
            />
            <AdminTabFilterBar
              filterLabel={appsFilterLabel}
              isFilterActive={appStatusFilter !== 'all'}
              onOpenFilter={() => setShowAppsFilterSheet(true)}
              searchQuery={searchAppsQuery}
              onReset={() => {
                setSearchAppsQuery('');
                setAppStatusFilter('all');
              }}
              count={filteredApps.length}
              unitLabel="app"
            />

            {/* Apps Listing matching Publisher Console style */}
            <div className="w-full flex flex-col space-y-1">
              {filteredApps.length === 0 ? (
                <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-theme-hover flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                    <Package className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <p className="text-base font-semibold text-theme-text">
                    No matching apps found
                  </p>
                  <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                    No platform applications match the current search query or filter.
                  </p>
                </div>
              ) : (
                filteredApps.map(app => {
                  const isPrivate = moderationStates[app.id]?.isPrivate || false;
                  const isBanned = moderationStates[app.id]?.isBanned || false;
                  const rawDownloads = app.downloadsCount ?? parseDownloadCount(app.downloads);
                  const downloadsFormatted = rawDownloads > 0 ? formatDownloadCount(rawDownloads) : (app.downloads || '0+');
                  const isRated = typeof app.rating === 'number' && app.rating > 0;
                  const averageRating = isRated ? app.rating.toFixed(1) : null;

                  return (
                    <div
                      key={app.id}
                      id={`admin-app-item-${app.id}`}
                      onClick={() => handleOpenAppDetail(app.id)}
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
                          <div className="flex items-center gap-2 mb-0.5 min-w-0">
                            <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                              {app.name}
                            </h4>
                            {isBanned && (
                              <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold shrink-0">
                                Blocked
                              </span>
                            )}
                            {isPrivate && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold shrink-0">
                                Private
                              </span>
                            )}
                          </div>

                          <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
                            <span className="text-theme-text font-medium">Owner:</span> {app.developer || app.publisherName || 'Verified Publisher'}{((app as any).ownerEmail || app.developerEmail) ? ` (${(app as any).ownerEmail || app.developerEmail})` : ''} {app.category ? `• ${app.category}` : ''}
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
                            {app.size && <span className="shrink-0">• {app.size}</span>}
                            {downloadsFormatted && <span className="shrink-0">• {downloadsFormatted}</span>}
                          </div>
                        </div>
                      </div>

                      {/* 3 Dots Menu Button matching Publisher Console */}
                      <div className="relative shrink-0 flex items-center justify-center -mr-2.5 sm:-mr-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          id={`admin-app-menu-btn-${app.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAppMenu(app.id, e.currentTarget);
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
        )}

        {/* TAB 4: Publishers */}
        {activeTab === 'publishers' && (
          <div className="flex flex-col w-full">
            <AdminTabSearchBar
              query={searchPublishersQuery}
              setQuery={setSearchPublishersQuery}
              placeholder="Search publishers by name, email..."
            />
            <AdminTabFilterBar
              filterLabel={publishersFilterLabel}
              isFilterActive={publishersFilter !== 'all'}
              onOpenFilter={() => setShowPublishersFilterSheet(true)}
              searchQuery={searchPublishersQuery}
              onReset={() => {
                setSearchPublishersQuery('');
                setPublishersFilter('all');
              }}
              count={filteredPublishers.length}
              unitLabel="publisher"
            />

            {/* Publisher Listing matching Publisher Console style */}
            <div className="w-full flex flex-col space-y-1">
              {filteredPublishers.length === 0 ? (
                <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-theme-hover flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                    <Users className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <p className="text-base font-semibold text-theme-text">
                    No publishers found
                  </p>
                  <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                    No platform publishers match your current search query or filter.
                  </p>
                </div>
              ) : (
                filteredPublishers.map(pub => {
                  return (
                    <div
                      key={pub.key}
                      id={`admin-publisher-item-${pub.key}`}
                      onClick={() => handleOpenPublisherInStore(pub.name)}
                      className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group relative outline-none transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Publisher Avatar matching app icon container */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-blue-600/10 text-blue-500 font-bold text-xl flex items-center justify-center shadow-xs">
                          {pub.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Publisher Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-0.5 min-w-0">
                            <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                              {pub.name}
                            </h4>
                            {pub.isBlocked && (
                              <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold shrink-0">
                                Blocked
                              </span>
                            )}
                            {pub.isRestricted && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold shrink-0">
                                Restricted
                              </span>
                            )}
                          </div>

                          <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
                            {pub.appCount} {pub.appCount === 1 ? 'published app' : 'published apps'} {pub.email ? `• ${pub.email}` : ''}
                          </p>

                          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                            <span className="shrink-0 font-medium text-theme-text">{formatDownloadCount(pub.totalDownloads)} downloads</span>
                            <span className="shrink-0">• View in Store (pub:{pub.name})</span>
                          </div>
                        </div>
                      </div>

                      {/* 3 Dots Menu Button matching Publisher Console */}
                      <div className="relative shrink-0 flex items-center justify-center -mr-2.5 sm:-mr-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          id={`admin-pub-menu-btn-${pub.key}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePublisherMenu(pub.key, e.currentTarget);
                          }}
                          className={`w-9 h-9 flex items-center justify-center text-[#444746] dark:text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer ${
                            openMenuPublisherKey === pub.key ? 'bg-theme-hover text-theme-text' : ''
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
        )}

        {/* TAB 5: Banned Links & Profiles */}
        {activeTab === 'banned-links' && (
          <div className="flex flex-col w-full gap-4">
            {/* Seamless Borderless Ban Input Section */}
            <div className="space-y-3 py-1">
              {/* Target URL / Profile Input */}
              <div>
                <label className="block text-xs font-medium text-theme-text mb-1.5">
                  GitHub Profile URL, Username, or Release Link *
                </label>
                <input
                  id="input-ban-url-or-profile"
                  type="text"
                  maxLength={1000}
                  placeholder="https://github.com/username, @username, or https://github.com/owner/repo/releases/..."
                  value={newBanUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewBanUrl(val);
                    if (val.trim()) {
                      const check = validateBannedLinkInput(val);
                      if (!check.isValid) {
                        setBanFormError(check.error || 'Please enter a valid URL or @username.');
                      } else {
                        setBanFormError(null);
                      }
                    } else {
                      setBanFormError(null);
                    }
                  }}
                  className={`w-full bg-theme-hover/40 border rounded-lg px-3 py-2.5 text-xs font-mono text-theme-text outline-none transition-colors ${
                    banFormError ? 'border-red-500 ring-1 ring-red-500/30' : 'border-theme-border focus:border-red-500'
                  }`}
                />
                {banFormError && (
                  <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{banFormError}</span>
                  </p>
                )}
              </div>

              {/* Enforcement Reason */}
              <div>
                <label className="block text-xs font-medium text-theme-text mb-1.5">
                  Reason for Ban / Restriction *
                </label>
                <input
                  id="input-ban-reason"
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Violated developer distribution terms, malware, unauthorized packaging..."
                  value={newBanReason}
                  onChange={(e) => setNewBanReason(e.target.value)}
                  className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2.5 text-xs text-theme-text outline-none focus:border-red-500"
                />
              </div>

              {/* Full-width Ban Button */}
              <button
                id="btn-execute-ban"
                type="button"
                onClick={handleExecuteBan}
                disabled={!newBanUrl.trim() || !validateBannedLinkInput(newBanUrl).isValid}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-theme-hover/60 text-white disabled:text-theme-text-muted rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Ban Profile or Release Link from Platform</span>
              </button>
            </div>

            {/* Below Input Section: Search Bar matching other tabs */}
            <AdminTabSearchBar
              query={searchBannedLinksQuery}
              setQuery={setSearchBannedLinksQuery}
              placeholder="Search banned profiles, usernames, release links, or reasons..."
            />

            {/* Below Input Section: Filter Bar matching other tabs */}
            <AdminTabFilterBar
              filterLabel={bannedLinksFilterLabel}
              isFilterActive={bannedLinksFilter !== 'all'}
              onOpenFilter={() => setShowBannedLinksFilterSheet(true)}
              searchQuery={searchBannedLinksQuery}
              onReset={() => {
                setSearchBannedLinksQuery('');
                setBannedLinksFilter('all');
              }}
              count={filteredBannedLinks.length}
              unitLabel="entry"
            />

            {/* Rows of links or profiles listed in the SAME STYLE as apps/publishers in other tabs */}
            <div className="w-full flex flex-col space-y-1">
              {filteredBannedLinks.length === 0 ? (
                <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-theme-hover flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                    <Ban className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <p className="text-base font-semibold text-theme-text">No banned entries found</p>
                  <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                    No release links or GitHub profiles match your current search query or filter.
                  </p>
                </div>
              ) : (
                filteredBannedLinks.map(item => {
                  const targetUrl = item.urlOrRepo || (item as any).url || '';
                  const cleanTarget = targetUrl.toLowerCase();
                  const isProfile = item.type === 'profile' || (!cleanTarget.includes('/') && !cleanTarget.includes('.apk')) || (cleanTarget.includes('github.com/') && cleanTarget.replace(/^https?:\/\/github\.com\//i, '').split('/').filter(Boolean).length === 1);
                  
                  let displayTitle = item.appName;
                  if (!displayTitle || displayTitle === targetUrl) {
                    if (item.targetIdentifier) {
                      displayTitle = isProfile ? (item.targetIdentifier.startsWith('@') ? item.targetIdentifier : `@${item.targetIdentifier}`) : item.targetIdentifier;
                    } else if (isProfile) {
                      const username = cleanTarget.replace(/^https?:\/\/github\.com\//i, '').replace(/^@+/, '').split('/')[0];
                      displayTitle = username ? `@${username}` : targetUrl;
                    } else {
                      const segments = cleanTarget.replace(/^https?:\/\/github\.com\//i, '').split('/').filter(Boolean);
                      displayTitle = segments.length >= 2 ? `${segments[0]}/${segments[1]}` : targetUrl;
                    }
                  }

                  return (
                    <div
                      key={item.id}
                      className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none bg-transparent group relative outline-none transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar container matching 14x14 / 16x16 app/publisher row */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-red-500/10 text-red-500 font-bold text-xl flex items-center justify-center shadow-xs">
                          {isProfile ? (
                            <Github className="w-7 h-7 text-red-500 stroke-[1.75]" />
                          ) : (
                            <Ban className="w-7 h-7 text-red-500 stroke-[1.75]" />
                          )}
                        </div>

                        {/* Details matching App/Publisher style */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-0.5 min-w-0">
                            <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-red-500 transition-colors">
                              {displayTitle}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold shrink-0">
                              {isProfile ? 'Profile Banned' : 'Release Link Banned'}
                            </span>
                          </div>

                          <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 font-mono truncate">
                            {targetUrl}
                          </p>

                          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                            <span>Reason: {item.reason || 'Violated developer distribution terms'}</span>
                            <span>• {new Date(item.bannedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Unban */}
                      <div className="relative shrink-0 flex items-center gap-2 -mr-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction({
                              isOpen: true,
                              title: `Unban ${displayTitle}?`,
                              description: `Are you sure you want to lift the ban on ${isProfile ? 'profile' : 'release link'} "${displayTitle}" (${targetUrl})? Applications using this link will be permitted again.`,
                              confirmLabel: 'Unban Target',
                              isDestructive: false,
                              onConfirm: async () => {
                                await AdminModerationService.unbanRepoReleaseLink(item.id || targetUrl);
                                refreshData();
                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                notifyUserUnbanned({
                                  targetIdentifier: displayTitle,
                                  urlOrRepo: targetUrl,
                                  type: isProfile ? 'profile' : 'release',
                                  appName: item.appName,
                                  targetEmail: (item as any).userEmail || (item as any).publisherEmail,
                                  targetUid: (item as any).userId || (item as any).creatorUid
                                }).catch(() => {});
                                showToast(`Unbanned ${displayTitle}`);
                              }
                            });
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold text-theme-text hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer border border-theme-border/40"
                        >
                          Unban
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 6: Global Notice & Platform Broadcasts */}
        {activeTab === 'global-notice' && (
          <div className="flex flex-col w-full gap-4">
            {/* Seamless Borderless Notice Composer Section matching Banned Links & Dev Console Form UI */}
            <div className="space-y-3 py-1">
              {/* Notice Headline / Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-theme-text">
                    Notice Headline / Title *
                  </label>
                  <span className="text-[10px] text-theme-text-muted">{globalNoticeTitle.length}/100</span>
                </div>
                <input
                  id="input-notice-title"
                  type="text"
                  maxLength={100}
                  value={globalNoticeTitle}
                  onChange={(e) => setGlobalNoticeTitle(e.target.value)}
                  placeholder="e.g. Critical Ecosystem Security Advisory"
                  className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2.5 text-xs text-theme-text outline-none focus:border-blue-500"
                />
              </div>

              {/* Notice Category Dropdown matching App Details menu style */}
              <div>
                <label className="block text-xs font-medium text-theme-text mb-1.5">
                  Notice Category *
                </label>
                <div className="relative">
                  <button
                    id="notice-category-dropdown-button"
                    type="button"
                    onClick={() => setShowNoticeCategoryMenu(prev => !prev)}
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2.5 text-xs text-theme-text outline-none focus:border-blue-500 flex items-center justify-between transition-colors cursor-pointer text-left"
                  >
                    <span className="font-medium text-theme-text capitalize">{globalNoticeCategory.replace('_', ' ')}</span>
                    <ChevronDown className={`w-4 h-4 text-theme-text-muted shrink-0 transition-transform duration-200 ${showNoticeCategoryMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showNoticeCategoryMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNoticeCategoryMenu(false)} />
                      <div className="absolute left-0 top-full mt-1.5 w-full bg-theme-card rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 border border-theme-border/40">
                        {[
                          { id: 'announcement', label: 'Announcement' },
                          { id: 'app_update', label: 'Store / App Update' },
                          { id: 'moderation', label: 'Moderation / Policy' },
                          { id: 'general', label: 'General Notice' }
                        ].map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setGlobalNoticeCategory(cat.id as NotificationCategory);
                              setShowNoticeCategoryMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                              globalNoticeCategory === cat.id ? 'text-blue-500 bg-blue-500/5 font-semibold' : ''
                            }`}
                          >
                            <span>{cat.label}</span>
                            {globalNoticeCategory === cat.id && <Check className="w-4 h-4 text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-theme-text">
                    Notification Message Body *
                  </label>
                  <span className="text-[10px] text-theme-text-muted">{globalNoticeMessage.length}/500</span>
                </div>
                <textarea
                  id="textarea-notice-message"
                  rows={4}
                  maxLength={500}
                  value={globalNoticeMessage}
                  onChange={(e) => setGlobalNoticeMessage(e.target.value)}
                  placeholder="Compose notice message body..."
                  className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2.5 text-xs text-theme-text outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Optional Action URL & Action Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-theme-text mb-1.5">
                    Optional Action URL (Deep Link)
                  </label>
                  <input
                    type="text"
                    value={globalNoticeActionUrl}
                    onChange={(e) => setGlobalNoticeActionUrl(e.target.value)}
                    placeholder="e.g. /console, /about, or https://..."
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2.5 text-xs text-theme-text outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-theme-text mb-1.5">
                    Action Button Label
                  </label>
                  <input
                    type="text"
                    value={globalNoticeActionLabel}
                    onChange={(e) => setGlobalNoticeActionLabel(e.target.value)}
                    placeholder="e.g. Read Details, Open Console"
                    className="w-full bg-theme-hover/40 border border-theme-border rounded-lg px-3 py-2.5 text-xs text-theme-text outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quick Template Presets */}
              <div>
                <span className="block text-xs font-medium text-theme-text mb-1.5">
                  Quick Template Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyBroadcastPreset('store_update')}
                    className="px-2.5 py-1 rounded-lg bg-theme-hover/60 hover:bg-theme-hover text-theme-text text-xs transition-colors cursor-pointer border border-theme-border/40"
                  >
                    Store Update
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBroadcastPreset('new_feature')}
                    className="px-2.5 py-1 rounded-lg bg-theme-hover/60 hover:bg-theme-hover text-theme-text text-xs transition-colors cursor-pointer border border-theme-border/40"
                  >
                    New Feature
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBroadcastPreset('maintenance')}
                    className="px-2.5 py-1 rounded-lg bg-theme-hover/60 hover:bg-theme-hover text-theme-text text-xs transition-colors cursor-pointer border border-theme-border/40"
                  >
                    Maintenance
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBroadcastPreset('security')}
                    className="px-2.5 py-1 rounded-lg bg-theme-hover/60 hover:bg-theme-hover text-theme-text text-xs transition-colors cursor-pointer border border-theme-border/40"
                  >
                    Security Advisory
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBroadcastPreset('policy')}
                    className="px-2.5 py-1 rounded-lg bg-theme-hover/60 hover:bg-theme-hover text-theme-text text-xs transition-colors cursor-pointer border border-theme-border/40"
                  >
                    Policy Update
                  </button>
                </div>
              </div>

              {/* Full-width Execute / Broadcast Button matching Banned Links style */}
              <button
                id="btn-execute-broadcast"
                type="button"
                disabled={isBroadcasting || !globalNoticeTitle.trim() || !globalNoticeMessage.trim()}
                onClick={handleSendBroadcast}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-hover/60 text-white disabled:text-theme-text-muted rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                {isBroadcasting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Notice...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    <span>Broadcast Global Notice to All Users</span>
                  </>
                )}
              </button>
            </div>

            {/* Below Input Section: Search Bar matching other tabs */}
            <AdminTabSearchBar
              query={searchBroadcastsQuery}
              setQuery={setSearchBroadcastsQuery}
              placeholder="Search active notices by title, message, or category..."
            />

            {/* Rows of notices listed in the SAME STYLE as Banned Links & Apps */}
            <div className="w-full flex flex-col space-y-1">
              {filteredGlobalBroadcasts.length === 0 ? (
                <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-theme-hover flex items-center justify-center text-theme-text-muted mb-3 opacity-80">
                    <Radio className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <p className="text-base font-semibold text-theme-text">No active notices found</p>
                  <p className="text-xs text-theme-text-muted mt-1 max-w-xs leading-relaxed">
                    No global broadcast notices or targeted notices match your current search query.
                  </p>
                </div>
              ) : (
                filteredGlobalBroadcasts.map((notice) => {
                  return (
                    <div
                      key={notice.id}
                      onClick={() => setSelectedNoticeDetail(notice)}
                      className="w-full flex items-center justify-between gap-3 py-2 sm:py-2.5 rounded-xl transition-colors cursor-pointer select-none bg-transparent group relative outline-none"
                      title="Click to view full notice details"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar container matching 14x14 / 16x16 app/publisher/banned link row */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-blue-500/10 text-blue-500 font-bold text-xl flex items-center justify-center shadow-xs">
                          <Globe className="w-7 h-7 stroke-[1.75]" />
                        </div>

                        {/* Details matching App/Publisher/Banned link style */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-0.5 min-w-0">
                            <h4 className="text-theme-text text-[15px] sm:text-base font-medium leading-tight truncate group-hover:text-blue-500 transition-colors">
                              {notice.title}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold shrink-0 uppercase bg-blue-600">
                              Global
                            </span>
                          </div>

                          <p className="text-theme-text-muted text-xs sm:text-[13px] mb-1 truncate">
                            {notice.message}
                          </p>

                          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                            <span>Category: {notice.category || 'announcement'}</span>
                            <span>• {notice.createdAt ? new Date(notice.createdAt).toLocaleDateString() : 'Recent'}</span>
                            {notice.actionUrl && <span>• Action: {notice.actionLabel || notice.actionUrl}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Delete / Revoke */}
                      <div className="relative shrink-0 flex items-center gap-2 -mr-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleRevokeBroadcast(notice)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-theme-text hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer border border-theme-border/40 flex items-center gap-1.5"
                          title="Delete notice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
            </>
          )}
        </main>
      </PullToRefresh>

      {/* Floating 3-Dots Menu for All Platform Apps matching Publisher Console Dropdown Style */}
      {openMenuAppId && appMenuCoords && (() => {
        const app = fullAppsList.find(a => a.id === openMenuAppId);
        if (!app) return null;
        const isPrivate = moderationStates[app.id]?.isPrivate || false;
        const isBanned = moderationStates[app.id]?.isBanned || false;

        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuAppId(null);
                setAppMenuCoords(null);
                appMenuTriggerRef.current = null;
              }}
            />
            <div
              id={`admin-menu-dropdown-${app.id}`}
              style={{
                position: 'fixed',
                top: appMenuCoords.top !== undefined ? `${appMenuCoords.top}px` : undefined,
                bottom: appMenuCoords.bottom !== undefined ? `${appMenuCoords.bottom}px` : undefined,
                right: `${appMenuCoords.right}px`,
                transformOrigin: appMenuCoords.transformOrigin,
                maxHeight: 'calc(100vh - 32px)',
              }}
              className="w-56 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 border border-theme-border/20 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-y-auto scrollbar-hide"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleOpenAppDetail(app.id);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                View in store
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleFilterAppsByPublisher(app.developer || app.publisherName || app.name);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                Filter apps by this publisher
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  const pub = app.developer || app.publisherName || '';
                  if (pub) navigation.performSearch(`pub:${pub}`);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                View in Store (pub:{app.developer || app.publisherName})
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleOpenReviews(app.id);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                Ratings & reviews
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleToggleAppPrivate(app);
                }}
                className="w-full text-left px-4 py-2 hover:bg-amber-500/10 text-amber-500 text-sm font-medium transition-colors cursor-pointer"
              >
                {isPrivate ? 'Make App Public' : 'Make App Private'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleToggleAppBan(app);
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-500 text-sm font-medium transition-colors cursor-pointer"
              >
                {isBanned ? 'Unban App' : 'Ban App from Store'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleBanAppDownloadLink(app);
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-500 text-sm font-medium transition-colors cursor-pointer"
              >
                Ban Release Link
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuAppId(null);
                  setAppMenuCoords(null);
                  appMenuTriggerRef.current = null;
                  handleDeleteAppPermanently(app);
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-500 text-sm font-medium transition-colors cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </>
        );
      })()}

      {/* Floating 3-Dots Menu for Publishers matching Publisher Console Dropdown Style */}
      {openMenuPublisherKey && pubMenuCoords && (() => {
        const pub = detectedPublishers.find(p => p.key === openMenuPublisherKey);
        if (!pub) return null;

        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuPublisherKey(null);
                setPubMenuCoords(null);
                pubMenuTriggerRef.current = null;
              }}
            />
            <div
              id={`admin-pub-menu-dropdown-${pub.key}`}
              style={{
                position: 'fixed',
                top: pubMenuCoords.top !== undefined ? `${pubMenuCoords.top}px` : undefined,
                bottom: pubMenuCoords.bottom !== undefined ? `${pubMenuCoords.bottom}px` : undefined,
                right: `${pubMenuCoords.right}px`,
                transformOrigin: pubMenuCoords.transformOrigin,
                maxHeight: 'calc(100vh - 32px)',
              }}
              className="w-56 bg-theme-card rounded-xl shadow-xl py-1.5 z-50 border border-theme-border/20 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-y-auto scrollbar-hide"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenuPublisherKey(null);
                  setPubMenuCoords(null);
                  pubMenuTriggerRef.current = null;
                  handleFilterAppsByPublisher(pub.name);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                Moderate Publisher's Apps
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuPublisherKey(null);
                  setPubMenuCoords(null);
                  pubMenuTriggerRef.current = null;
                  handleOpenPublisherInStore(pub.name);
                }}
                className="w-full text-left px-4 py-2 hover:bg-theme-hover text-theme-text text-sm font-medium transition-colors cursor-pointer"
              >
                View in Store (pub:{pub.name})
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuPublisherKey(null);
                  setPubMenuCoords(null);
                  pubMenuTriggerRef.current = null;
                  handlePublisherTakeAllPrivate(pub.name);
                }}
                className="w-full text-left px-4 py-2 hover:bg-amber-500/10 text-amber-500 text-sm font-medium transition-colors cursor-pointer"
              >
                Take All Apps Private
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuPublisherKey(null);
                  setPubMenuCoords(null);
                  pubMenuTriggerRef.current = null;
                  handlePublisherMakeAllPublic(pub.name);
                }}
                className="w-full text-left px-4 py-2 hover:bg-emerald-500/10 text-emerald-500 text-sm font-medium transition-colors cursor-pointer"
              >
                Make All Apps Public
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuPublisherKey(null);
                  setPubMenuCoords(null);
                  pubMenuTriggerRef.current = null;
                  handleTogglePublisherRestriction(pub.name, pub.isRestricted);
                }}
                className="w-full text-left px-4 py-2 hover:bg-amber-500/10 text-amber-500 text-sm font-medium transition-colors cursor-pointer"
              >
                {pub.isRestricted ? 'Remove Restriction' : 'Restrict Publisher'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenuPublisherKey(null);
                  setPubMenuCoords(null);
                  pubMenuTriggerRef.current = null;
                  handleTogglePublisherSuspension(pub.name, pub.isBlocked);
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-500 text-sm font-medium transition-colors cursor-pointer"
              >
                {pub.isBlocked ? 'Reactivate Publisher' : 'Block & Suspend'}
              </button>
            </div>
          </>
        );
      })()}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        description={confirmAction.description}
        confirmLabel={confirmAction.confirmLabel}
        cancelLabel="Cancel"
        isDestructive={confirmAction.isDestructive}
        icon={confirmAction.isDestructive ? 'danger' : 'warning'}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Straight Corner Global Notice Detail Modal */}
      <GlobalNoticeDetailModal
        isOpen={Boolean(selectedNoticeDetail)}
        notice={selectedNoticeDetail}
        onClose={() => setSelectedNoticeDetail(null)}
        onDelete={handleRevokeBroadcast}
        onOpenAppDetail={handleOpenAppDetail}
      />

      {/* Filter Bottom Sheets for Each Tab (matching App Console sheet filter style) */}
      <AdminFilterSheet
        isOpen={showAppReportsFilterSheet}
        onClose={() => setShowAppReportsFilterSheet(false)}
        title="Filter App Reports"
        options={appReportsFilterOptions}
        currentValue={appReportsFilter}
        onSelect={(key) => setAppReportsFilter(key as any)}
      />

      <AdminFilterSheet
        isOpen={showReviewReportsFilterSheet}
        onClose={() => setShowReviewReportsFilterSheet(false)}
        title="Filter Flagged Reviews"
        options={reviewReportsFilterOptions}
        currentValue={reviewReportsFilter}
        onSelect={(key) => setReviewReportsFilter(key as any)}
      />

      <AdminFilterSheet
        isOpen={showAppsFilterSheet}
        onClose={() => setShowAppsFilterSheet(false)}
        title="Filter Platform Apps"
        options={appsFilterOptions}
        currentValue={appStatusFilter}
        onSelect={(key) => setAppStatusFilter(key as any)}
      />

      <AdminFilterSheet
        isOpen={showPublishersFilterSheet}
        onClose={() => setShowPublishersFilterSheet(false)}
        title="Filter Publishers"
        options={publishersFilterOptions}
        currentValue={publishersFilter}
        onSelect={(key) => setPublishersFilter(key as any)}
      />

      <AdminFilterSheet
        isOpen={showBannedLinksFilterSheet}
        onClose={() => setShowBannedLinksFilterSheet(false)}
        title="Filter Banned Links"
        options={bannedLinksFilterOptions}
        currentValue={bannedLinksFilter}
        onSelect={(key) => setBannedLinksFilter(key as any)}
      />
    </div>
  );
}
