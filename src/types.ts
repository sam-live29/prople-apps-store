/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAX_REVIEW_CHARACTERS = 500;
export const MAX_REPLY_CHARACTERS = 500;

export interface SafetyHighlight {
  title: string;
  description: string;
  icon?: 'shield' | 'lock' | 'hard-drive' | 'eye-off' | 'code' | 'check' | 'zap' | string;
}

export interface AppPermissionGroup {
  id: string; // 'camera' | 'location' | 'microphone' | 'telephone' | 'storage' | 'other'
  name: string;
  items: string[];
}

export interface DataSafetyDeclaration {
  overview?: string;
  summaryText?: string;
  dataShared?: string;
  dataSharedDetails?: string;
  sharesDataWithThirdParties?: boolean;
  dataCollected?: string[];
  dataPurposes?: AppPermissionGroup[];
  purposeGroups?: AppPermissionGroup[];
  securityPractices?: string[];
  permissions?: string[];
  permissionGroups?: AppPermissionGroup[];
  deletionPolicy?: string;
  highlights?: SafetyHighlight[];
  [key: string]: any;
}

export interface DeveloperInfo {
  website?: string;
  github?: string;
  githubRepoOwner?: string;
  email?: string;
  publisherName?: string;
  address?: string;
  privacyPolicy?: string;
  termsAndConditions?: string;
  termsOfService?: string;
  [key: string]: any;
}

export interface ReviewReply {
  date: string;
  text: string;
  authorName?: string;
  authorRole?: string;
  isVerifiedPublisher?: boolean;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  date: string;
  text: string;
  helpfulCount: number;
  notHelpfulCount?: number;
  media?: string[];
  reply?: ReviewReply;
  device?: string;
  verified?: boolean;
  appId?: string;
  appName?: string;
  appIcon?: string;
  appDeveloper?: string;
  isFlagged?: boolean;
  flagReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface GitHubReleaseAsset {
  name: string;
  downloadUrl?: string;
  browser_download_url?: string;
  size?: number;
  content_type?: string;
  created_at?: string;
  updated_at?: string;
  download_count?: number;
}

export interface AppDownloadOptionItem {
  id: string;
  label: string;
  formatBadge: string;
  format: string;
  platform: 'android' | 'linux' | 'windows' | 'mac' | 'ios' | string;
  fileName: string;
  downloadUrl: string;
  sizeString?: string;
  description: string;
  isPrimary?: boolean;
}

export interface DeveloperKeystore {
  keyId: string;
  alias: string;
  sha256Fingerprint: string;
  sha1Fingerprint: string;
  algorithm: string;
  validUntil: string;
  createdAt: string;
  issuer: string;
  status: 'active' | 'revoked' | string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  age?: string;
  gender?: string;
  location?: string;
  bio?: string;
  isEmailVerified?: boolean;
  isPublisher?: boolean;
  publisherName?: string;
  publisherRole?: string;
  publisherBio?: string;
  publisherWebsite?: string;
  publisherEmail?: string;
  publisherGithub?: string;
  publisherLocation?: string;
  publishedAppIds?: string[];
  developerKeystore?: DeveloperKeystore | null;
  lastNameChangedAt?: number | string;
  nameChangeSessionStartedAt?: number | string;
  updatedAt?: any;
  createdAt?: any;
}

export interface DeveloperConsoleConfig {
  owner?: string;
  developerName?: string;
  developerEmail?: string;
  website?: string;
  github?: string;
  address?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  termsAndConditions?: string;
  updatedAt?: any;
  [key: string]: any;
}

export interface AppDetails {
  id: string;
  name: string;
  developer: string;
  category: string;
  rating?: number;
  reviewsCount?: string;
  downloads?: string;
  downloadsCount?: number;
  ratingsCount?: number;
  ratingBreakdown?: Record<number, number>;
  size?: string;
  contentRating?: string;
  price?: string;
  type?: 'github_release' | 'pwa' | 'web' | 'apk' | string;
  iconUrl?: string;
  featureGraphicUrl?: string;
  detailsBannerUrl?: string;
  heroBannerUrl?: string;
  promoVideoUrl?: string;
  videoThumbnailUrl?: string;
  tagline?: string;
  aboutText?: string;
  description?: string;
  screenshots?: string[];
  tabletScreenshots?: string[];
  desktopScreenshots?: string[];
  tags?: string[];
  dataSafety?: DataSafetyDeclaration;
  developerInfo?: DeveloperInfo;
  privacyPolicy?: string;
  termsAndConditions?: string;
  termsOfService?: string;
  releaseNotes?: string;
  releaseDate?: string;
  initialReleaseDate?: string;
  minAndroid?: string;
  minWindows?: string;
  minLinux?: string;
  sha256?: string;
  assetName?: string;
  versionName?: string;
  releaseTag?: string;
  downloadUrl?: string;
  url?: string;
  githubRepo?: string;
  githubReleaseUrl?: string;
  githubRepoOwner?: string;
  containsAds?: boolean;
  inAppPurchases?: boolean;
  interactiveElements?: string[];
  supportedArchitectures?: string[];
  minRam?: string;
  featuredTitle?: string;
  featuredSubtitle?: string;
  featuredImageUrl?: string;
  publisherName?: string;
  publisherEmail?: string;
  publishedBy?: string;
  creatorUid?: string;
  owner?: string;
  developerId?: string;
  developerEmail?: string;
  platform?: 'android' | 'linux' | 'windows' | 'mac' | 'ios' | 'web' | string;
  targetOs?: string;
  packageFormat?: string;
  permissions?: string[];
  securityPractices?: string[];
  keystoreFingerprint?: string;
  keystoreAlias?: string;
  isBanned?: boolean;
  isPrivate?: boolean;
  isPublisherBlocked?: boolean;
  isPublisherRestricted?: boolean;
  moderationReason?: string;
  reviews?: Review[];
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface AppListing {
  id: string;
  name: string;
  developer: string;
  category: string;
  rating?: number;
  ratingsCount?: number;
  size?: string;
  downloads?: string;
  downloadsCount?: number;
  price?: string;
  iconUrl?: string;
  featureGraphicUrl?: string;
  detailsBannerUrl?: string;
  heroBannerUrl?: string;
  isVerified?: boolean;
  containsAds?: boolean;
  contentRating?: string;
  type?: string;
  url?: string;
  githubRepo?: string;
  githubReleaseUrl?: string;
  downloadUrl?: string;
  releaseTag?: string;
  versionName?: string;
  assetName?: string;
  sha256?: string;
  releaseNotes?: string;
  screenshots?: string[];
  tabletScreenshots?: string[];
  promoVideoUrl?: string;
  tagline?: string;
  aboutText?: string;
  featuredImageUrl?: string;
  featuredTitle?: string;
  featuredSubtitle?: string;
  publisherName?: string;
  publisherEmail?: string;
  publishedBy?: string;
  creatorUid?: string;
  owner?: string;
  developerId?: string;
  developerEmail?: string;
  githubRepoOwner?: string;
  developerInfo?: DeveloperInfo;
  tags?: string[];
  platform?: string;
  targetOs?: string;
  packageFormat?: string;
  minAndroid?: string;
  minWindows?: string;
  minLinux?: string;
  inAppPurchases?: boolean;
  interactiveElements?: string[];
  supportedArchitectures?: string[];
  minRam?: string;
  permissions?: string[];
  permissionGroups?: AppPermissionGroup[];
  dataPurposes?: AppPermissionGroup[];
  purposeGroups?: AppPermissionGroup[];
  securityPractices?: string[];
  dataSafety?: DataSafetyDeclaration;
  keystoreFingerprint?: string;
  keystoreAlias?: string;
  isBanned?: boolean;
  isPrivate?: boolean;
  isPublisherBlocked?: boolean;
  isPublisherRestricted?: boolean;
  moderationReason?: string;
  [key: string]: any;
}

export interface HeroBannerConfig {
  id: string;
  badge?: string;
  headline?: string;
  tagline?: string;
  imageUrl?: string;
  appId?: string;
  appName?: string;
  appDeveloper?: string;
  appIcon?: string;
  appRating?: number;
  appDownloads?: string;
  isActive?: boolean;
  titleBadge?: string;
  displayOrder?: number;
  [key: string]: any;
}

export interface HomeSectionConfig {
  id: string;
  key: string;
  title: string;
  subtitle?: string;
  enabled: boolean;
}

export type NotificationCategory = 'announcement' | 'app_update' | 'moderation' | 'general' | 'developer' | 'review' | 'download' | 'milestone' | string;

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  iconUrl?: string;
  isUnread: boolean;
  appId?: string;
  actionType?: 'app_detail' | 'open_url' | 'publisher_console' | 'dialog' | 'security_check' | 'link' | 'console' | string;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: number;
  category?: NotificationCategory;
  priority?: 'normal' | 'important' | 'critical' | string;
  sender?: string;
  targetType?: 'public' | 'global' | 'all' | 'user' | 'publisher' | 'admin' | string;
  targetUid?: string;
  targetUserName?: string;
  targetEmail?: string;
  publisherAppId?: string;
  publisherUid?: string;
  publisherEmail?: string;
  publisherName?: string;
  dialogId?: string;
  [key: string]: any;
}

export type InstallState = 'uninstalled' | 'pending' | 'downloading' | 'verifying' | 'installing' | 'installed' | 'paused' | 'error';

export interface AppInstallData {
  state: InstallState;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speedFormatted?: string;
  etaFormatted?: string;
  sizeFormatted?: string;
  blobUrl?: string;
  name?: string;
  appName?: string;
  iconUrl?: string;
  installedAt?: string;
  fileName?: string;
  error?: string;
  platform?: string;
  packageFormat?: string;
  downloadUrl?: string;
  verifiedSha256?: string | boolean;
  needsUpdate?: boolean;
  [key: string]: any;
}

export interface PendingDownloadIncrement {
  id: string;
  appId: string;
  appName: string;
  iconUrl?: string;
  triggerTime: number;
  executeAt: number;
  executed: boolean;
}

export interface PublishQuotaInfo {
  publishedTimestamps: number[];
  lastPublishedAt?: number;
  exhaustionWindowMs: number;
  maxPerWindow: number;
  cooldownMs: number;
  isExhausted: boolean;
  cooldownRemainingSeconds: number;
  remainingInWindow: number;
  nextAvailableTimeFormatted?: string;
}

export interface UpdateQuotaInfo {
  updateTimestamps: number[];
  lastUpdatedAt?: number;
  windowMs: number;
  maxPerWindow: number;
  isExhausted: boolean;
  remainingInWindow: number;
  nextAvailableTimeFormatted?: string;
}

export interface SearchTrending {
  id: string;
  title: string;
  subtitle: string;
}

export interface EventItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  date?: string;
  imageUrl?: string;
  appId?: string;
  badge?: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  timestamp?: number;
}
