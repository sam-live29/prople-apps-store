import React, { useState, useRef, useEffect } from 'react';
import { Plus, Upload, Pencil, Video, AlertCircle, Check } from 'lucide-react';
import { 
  inspectImage, 
  fileToDataUrl, 
  fitImageToCanvas, 
  compressImage,
  extractYouTubeId, 
  ImageDimensionResult 
} from '../../utils/mediaUtils';
import { uploadMediaToS3 } from '../../services/s3MediaService';
import { useToast } from '../../context/ToastContext';
import MediaGalleryLightbox from './MediaGalleryLightbox';

export interface AppMediaState {
  iconUrl: string;
  featureGraphicUrl: string;
  detailsBannerUrl?: string;
  heroBannerUrl?: string;
  screenshots: string[];
  tabletScreenshots?: string[];
  desktopScreenshots?: string[];
  promoVideoUrl?: string;
  videoThumbnailUrl?: string;
}

interface AppMediaUploaderProps {
  initialData?: Partial<AppMediaState>;
  onChange: (data: AppMediaState) => void;
  appName?: string;
  category?: string;
  showVideoError?: boolean;
}

// Curated High-Res Sample Assets
const SAMPLE_PRESETS = {
  productivity: {
    icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=512&h=512&fit=crop&q=80',
    featureGraphic: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&h=1080&fit=crop&q=80',
    screenshots: [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&h=1920&fit=crop&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&h=1920&fit=crop&q=80',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&h=1920&fit=crop&q=80'
    ],
    video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
};

export default function AppMediaUploader({
  initialData,
  onChange,
  appName = 'My App',
  category = 'Productivity',
  showVideoError = false
}: AppMediaUploaderProps) {
  const { showToast } = useToast();

  // Controlled media values from parent
  const iconUrl = initialData?.iconUrl || '';
  const featureGraphicUrl = initialData?.featureGraphicUrl || '';
  const detailsBannerUrl = initialData?.detailsBannerUrl || '';
  const heroBannerUrl = initialData?.heroBannerUrl || '';
  const screenshots = initialData?.screenshots || [];
  const tabletScreenshots = initialData?.tabletScreenshots || [];
  const desktopScreenshots = initialData?.desktopScreenshots || [];
  const promoVideoUrl = initialData?.promoVideoUrl || '';
  const videoThumbnailUrl = initialData?.videoThumbnailUrl || '';

  // Helper to trigger parent update cleanly on explicit user actions
  const updateMedia = (updates: Partial<AppMediaState>) => {
    onChange({
      iconUrl,
      featureGraphicUrl,
      detailsBannerUrl,
      heroBannerUrl,
      screenshots,
      tabletScreenshots,
      desktopScreenshots,
      promoVideoUrl,
      videoThumbnailUrl,
      ...updates
    });
  };

  const setIconUrl = (val: string) => updateMedia({ iconUrl: val });
  const setFeatureGraphicUrl = (val: string) => updateMedia({ featureGraphicUrl: val });
  const setDetailsBannerUrl = (val: string) => updateMedia({ detailsBannerUrl: val });
  const setHeroBannerUrl = (val: string) => updateMedia({ heroBannerUrl: val });
  const setScreenshots = (action: string[] | ((prev: string[]) => string[])) => {
    const next = typeof action === 'function' ? action(screenshots) : action;
    updateMedia({ screenshots: next });
  };
  const setTabletScreenshots = (action: string[] | ((prev: string[]) => string[])) => {
    const next = typeof action === 'function' ? action(tabletScreenshots) : action;
    updateMedia({ tabletScreenshots: next });
  };
  const setDesktopScreenshots = (action: string[] | ((prev: string[]) => string[])) => {
    const next = typeof action === 'function' ? action(desktopScreenshots) : action;
    updateMedia({ desktopScreenshots: next });
  };
  const setPromoVideoUrl = (val: string) => updateMedia({ promoVideoUrl: val });
  const setVideoThumbnailUrl = (val: string) => updateMedia({ videoThumbnailUrl: val });

  // UI state
  const [activeDeviceTab, setActiveDeviceTab] = useState<'phone' | 'tablet' | 'desktop'>('phone');
  const [activeBannerTab, setActiveBannerTab] = useState<'universal' | 'details' | 'hero'>('universal');
  const [showAllBannerSections, setShowAllBannerSections] = useState(false);
  const [iconMask, setIconMask] = useState<'squircle' | 'circle' | 'square'>('squircle');
  const [isProcessing, setIsProcessing] = useState(false);

  // Diagnostics
  const [iconDiagnostics, setIconDiagnostics] = useState<ImageDimensionResult | null>(null);
  const [featureDiagnostics, setFeatureDiagnostics] = useState<ImageDimensionResult | null>(null);
  const [detailsBannerDiagnostics, setDetailsBannerDiagnostics] = useState<ImageDimensionResult | null>(null);
  const [heroBannerDiagnostics, setHeroBannerDiagnostics] = useState<ImageDimensionResult | null>(null);

  // Lightbox Preview State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [screenshotAspectRatios, setScreenshotAspectRatios] = useState<Record<string, number>>({});
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');

  // File input refs
  const iconInputRef = useRef<HTMLInputElement>(null);
  const featureInputRef = useRef<HTMLInputElement>(null);
  const detailsBannerInputRef = useRef<HTMLInputElement>(null);
  const heroBannerInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const videoThumbnailInputRef = useRef<HTMLInputElement>(null);

  const handleDirectThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      const dataUrl = await compressImage(file, 1280, 0.85);
      setVideoThumbnailUrl(dataUrl);
      showToast('Video thumbnail updated from gallery');
    } catch (err) {
      console.error('Failed to load thumbnail image:', err);
      showToast('Failed to load image file');
    } finally {
      setIsProcessing(false);
      if (videoThumbnailInputRef.current) {
        videoThumbnailInputRef.current.value = '';
      }
    }
  };

  // Inspect icon whenever it changes
  useEffect(() => {
    if (!iconUrl) {
      setIconDiagnostics(null);
      return;
    }
    inspectImage(iconUrl)
      .then(setIconDiagnostics)
      .catch(() => setIconDiagnostics(null));
  }, [iconUrl]);

  // Inspect feature graphic whenever it changes
  useEffect(() => {
    if (!featureGraphicUrl) {
      setFeatureDiagnostics(null);
      return;
    }
    inspectImage(featureGraphicUrl)
      .then(setFeatureDiagnostics)
      .catch(() => setFeatureDiagnostics(null));
  }, [featureGraphicUrl]);

  // Inspect details banner whenever it changes
  useEffect(() => {
    if (!detailsBannerUrl) {
      setDetailsBannerDiagnostics(null);
      return;
    }
    inspectImage(detailsBannerUrl)
      .then(setDetailsBannerDiagnostics)
      .catch(() => setDetailsBannerDiagnostics(null));
  }, [detailsBannerUrl]);

  // Inspect hero banner whenever it changes
  useEffect(() => {
    if (!heroBannerUrl) {
      setHeroBannerDiagnostics(null);
      return;
    }
    inspectImage(heroBannerUrl)
      .then(setHeroBannerDiagnostics)
      .catch(() => setHeroBannerDiagnostics(null));
  }, [heroBannerUrl]);

  // Measure and preserve natural aspect ratios for all screenshots as they are
  const screenshotsKey = screenshots.join('|') + '::' + tabletScreenshots.join('|') + '::' + desktopScreenshots.join('|');
  useEffect(() => {
    const list = [...screenshots, ...tabletScreenshots, ...desktopScreenshots];
    list.forEach((shot) => {
      if (!shot || screenshotAspectRatios[shot]) return;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          const r = img.naturalWidth / img.naturalHeight;
          setScreenshotAspectRatios((prev) => (prev[shot] ? prev : { ...prev, [shot]: r }));
        }
      };
      img.src = shot;
    });
  }, [screenshotsKey]);

  // Handlers for App Icon
  const handleIconFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsProcessing(true);
      const dataUrl = await compressImage(file, 512, 0.85);
      const diag = await inspectImage(dataUrl);
      setIconDiagnostics(diag);
      
      // Upload to AWS S3 bucket `prople`
      const s3Url = await uploadMediaToS3(dataUrl, `icon-${file.name}`, 'apps/icons');
      setIconUrl(s3Url || dataUrl);
      if (s3Url && s3Url.startsWith('http')) {
        showToast('App icon uploaded to AWS S3 successfully');
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing icon file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFormatIcon = async () => {
    if (!iconUrl) return;
    try {
      setIsProcessing(true);
      const formatted = await fitImageToCanvas(iconUrl, 512, 512, 'cover');
      const diag = await inspectImage(formatted);
      setIconDiagnostics(diag);

      // Upload formatted icon to S3
      const s3Url = await uploadMediaToS3(formatted, 'icon-formatted.webp', 'apps/icons');
      setIconUrl(s3Url || formatted);
    } catch (err) {
      showToast('Failed to auto-format icon');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handlers for Feature Graphic / Store Listing Banner (Exact 16:9)
  const handleFeatureFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsProcessing(true);
      const dataUrl = await compressImage(file, 1920, 0.85);
      const diag = await inspectImage(dataUrl);
      setFeatureDiagnostics(diag);

      // Upload to AWS S3 bucket `prople`
      const s3Url = await uploadMediaToS3(dataUrl, `banner-${file.name}`, 'apps/banners');
      setFeatureGraphicUrl(s3Url || dataUrl);
      if (s3Url && s3Url.startsWith('http')) {
        showToast('Banner uploaded to AWS S3 successfully');
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing banner file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFormatFeature = async () => {
    if (!featureGraphicUrl) return;
    try {
      setIsProcessing(true);
      const formatted = await fitImageToCanvas(featureGraphicUrl, 1920, 1080, 'cover');
      const diag = await inspectImage(formatted);
      setFeatureDiagnostics(diag);

      const s3Url = await uploadMediaToS3(formatted, 'banner-feature-formatted.webp', 'apps/banners');
      setFeatureGraphicUrl(s3Url || formatted);
    } catch (err) {
      showToast('Failed to auto-format feature graphic');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handlers for App Details Banner (Exact 16:9)
  const handleDetailsBannerFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsProcessing(true);
      const dataUrl = await compressImage(file, 1920, 0.85);
      const diag = await inspectImage(dataUrl);
      setDetailsBannerDiagnostics(diag);
      
      const s3Url = await uploadMediaToS3(dataUrl, `details-${file.name}`, 'apps/banners');
      setDetailsBannerUrl(s3Url || dataUrl);
    } catch (err: any) {
      showToast(err.message || 'Error processing App Details banner file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFormatDetailsBanner = async () => {
    if (!detailsBannerUrl) return;
    try {
      setIsProcessing(true);
      const formatted = await fitImageToCanvas(detailsBannerUrl, 1920, 1080, 'cover');
      const diag = await inspectImage(formatted);
      setDetailsBannerDiagnostics(diag);

      const s3Url = await uploadMediaToS3(formatted, 'details-formatted.webp', 'apps/banners');
      setDetailsBannerUrl(s3Url || formatted);
    } catch (err) {
      showToast('Failed to auto-format App Details banner');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handlers for Home Spotlight & Hero Banner (Exact 16:9)
  const handleHeroBannerFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsProcessing(true);
      const dataUrl = await compressImage(file, 1920, 0.85);
      const diag = await inspectImage(dataUrl);
      setHeroBannerDiagnostics(diag);

      const s3Url = await uploadMediaToS3(dataUrl, `hero-${file.name}`, 'apps/banners');
      setHeroBannerUrl(s3Url || dataUrl);
    } catch (err: any) {
      showToast(err.message || 'Error processing Spotlight Hero banner file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFormatHeroBanner = async () => {
    if (!heroBannerUrl) return;
    try {
      setIsProcessing(true);
      const formatted = await fitImageToCanvas(heroBannerUrl, 1920, 1080, 'cover');
      const diag = await inspectImage(formatted);
      setHeroBannerDiagnostics(diag);

      const s3Url = await uploadMediaToS3(formatted, 'hero-formatted.webp', 'apps/banners');
      setHeroBannerUrl(s3Url || formatted);
    } catch (err) {
      showToast('Failed to auto-format Spotlight Hero banner');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handlers for Screenshots
  const handleScreenshotFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setIsProcessing(true);
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await compressImage(file, 1080, 0.80);
        
        // Upload screenshot to S3
        const s3Url = await uploadMediaToS3(dataUrl, `screen-${i}-${file.name}`, 'apps/screenshots');
        const finalUrl = s3Url || dataUrl;
        newUrls.push(finalUrl);

        // Capture natural image aspect ratio as it is
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const r = img.naturalWidth / img.naturalHeight;
            setScreenshotAspectRatios((prev) => ({ ...prev, [finalUrl]: r }));
          }
        };
        img.src = finalUrl;
      }

      if (activeDeviceTab === 'phone') {
        setScreenshots((prev) => [...prev, ...newUrls].slice(0, 20));
      } else if (activeDeviceTab === 'tablet') {
        setTabletScreenshots((prev) => [...prev, ...newUrls].slice(0, 20));
      } else {
        setDesktopScreenshots((prev) => [...prev, ...newUrls].slice(0, 20));
      }
      showToast(`Added ${newUrls.length} image(s) to S3`);
    } catch (err: any) {
      showToast(err.message || 'Failed to upload screenshots');
    } finally {
      if (screenshotInputRef.current) {
        screenshotInputRef.current.value = '';
      }
      setIsProcessing(false);
    }
  };

  const handleAddScreenshotUrl = () => {
    const raw = newScreenshotUrl.trim();
    if (!raw) return;
    const urls = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    urls.forEach((u) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          const r = img.naturalWidth / img.naturalHeight;
          setScreenshotAspectRatios((prev) => ({ ...prev, [u]: r }));
        }
      };
      img.src = u;
    });

    if (activeDeviceTab === 'phone') {
      setScreenshots((prev) => [...prev, ...urls].slice(0, 20));
    } else if (activeDeviceTab === 'tablet') {
      setTabletScreenshots((prev) => [...prev, ...urls].slice(0, 20));
    } else {
      setDesktopScreenshots((prev) => [...prev, ...urls].slice(0, 20));
    }
    setNewScreenshotUrl('');
    showToast(`Added ${urls.length} preview image(s)`);
  };

  const handleMoveScreenshot = (index: number, direction: 'left' | 'right') => {
    const list = activeDeviceTab === 'phone' 
      ? [...screenshots] 
      : activeDeviceTab === 'tablet' 
        ? [...tabletScreenshots] 
        : [...desktopScreenshots];
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    if (activeDeviceTab === 'phone') {
      setScreenshots(list);
    } else if (activeDeviceTab === 'tablet') {
      setTabletScreenshots(list);
    } else {
      setDesktopScreenshots(list);
    }
  };

  const handleDeleteScreenshot = (index: number) => {
    if (activeDeviceTab === 'phone') {
      setScreenshots((prev) => prev.filter((_, i) => i !== index));
    } else if (activeDeviceTab === 'tablet') {
      setTabletScreenshots((prev) => prev.filter((_, i) => i !== index));
    } else {
      setDesktopScreenshots((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleLoadSampleKit = () => {
    const preset = SAMPLE_PRESETS.productivity;
    updateMedia({
      iconUrl: preset.icon,
      featureGraphicUrl: preset.featureGraphic,
      screenshots: preset.screenshots,
      promoVideoUrl: preset.video
    });
  };

  // Compile all media for lightbox preview
  const allMediaForLightbox = [
    ...(promoVideoUrl && promoVideoUrl.trim() ? [{ type: 'video' as const, url: promoVideoUrl, title: `${appName} Promo Video` }] : []),
    ...(featureGraphicUrl && featureGraphicUrl.trim() ? [{ type: 'image' as const, url: featureGraphicUrl, title: `${appName} Store Listing Banner` }] : []),
    ...(detailsBannerUrl && detailsBannerUrl.trim() ? [{ type: 'image' as const, url: detailsBannerUrl, title: `${appName} App Details Header Banner` }] : []),
    ...(heroBannerUrl && heroBannerUrl.trim() ? [{ type: 'image' as const, url: heroBannerUrl, title: `${appName} Home Spotlight Hero Banner` }] : []),
    ...screenshots.filter(s => Boolean(s && typeof s === 'string' && s.trim().length > 0)).map((s, idx) => ({ type: 'image' as const, url: s, title: `${appName} Phone Screenshot ${idx + 1}` })),
    ...tabletScreenshots.filter(s => Boolean(s && typeof s === 'string' && s.trim().length > 0)).map((s, idx) => ({ type: 'image' as const, url: s, title: `${appName} Tablet Screenshot ${idx + 1}` })),
    ...desktopScreenshots.filter(s => Boolean(s && typeof s === 'string' && s.trim().length > 0)).map((s, idx) => ({ type: 'image' as const, url: s, title: `${appName} Desktop Screenshot ${idx + 1}` }))
  ];

  const currentScreenshots = activeDeviceTab === 'phone' 
    ? screenshots 
    : activeDeviceTab === 'tablet' 
      ? tabletScreenshots 
      : desktopScreenshots;
  const youtubeId = promoVideoUrl ? extractYouTubeId(promoVideoUrl) : null;
  const isInvalidLink = Boolean(promoVideoUrl && promoVideoUrl.trim() && !youtubeId);
  const displayVideoError = Boolean(showVideoError && isInvalidLink);

  return (
    <div className="space-y-6 text-theme-text font-sans">
      {/* Lightbox Viewer */}
      <MediaGalleryLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        mediaItems={allMediaForLightbox}
        initialIndex={lightboxIndex}
        appName={appName}
      />

      {/* Action Header with strict policy indicator */}
      <div className="flex items-center justify-between py-1">
        <div>
          <div className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
            <span>Store Listing Media</span>
          </div>
          <div className="text-[11px] text-theme-text-muted mt-0.5">
            App icon (512×512), feature graphic banner (exact 16:9, e.g. 1920×1080), screenshots, and promo video trailer.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. APP ICON (512x512 px) */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text">App Icon</span>
            <span className="text-[11px] text-theme-text-muted">512 × 512 px</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Mask Shape Toggle */}
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setIconMask('squircle')}
                className={`px-2 py-0.5 rounded ${iconMask === 'squircle' ? 'bg-blue-600 text-white font-medium' : 'text-theme-text-muted hover:text-theme-text'}`}
              >
                Mask
              </button>
              <button
                type="button"
                onClick={() => setIconMask('square')}
                className={`px-2 py-0.5 rounded ${iconMask === 'square' ? 'bg-blue-600 text-white font-medium' : 'text-theme-text-muted hover:text-theme-text'}`}
              >
                Square
              </button>
              <button
                type="button"
                onClick={() => setIconMask('circle')}
                className={`px-2 py-0.5 rounded ${iconMask === 'circle' ? 'bg-blue-600 text-white font-medium' : 'text-theme-text-muted hover:text-theme-text'}`}
              >
                Circle
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-4 items-center">
          {/* Visual Icon Preview */}
          <div className="flex flex-col items-center justify-center">
            <div 
              className={`w-24 h-24 overflow-hidden shadow-sm bg-zinc-900 border border-theme-border transition-all ${
                iconMask === 'squircle' 
                  ? 'rounded-[22px]' 
                  : iconMask === 'circle' 
                  ? 'rounded-full' 
                  : 'rounded-none'
              }`}
            >
              {iconUrl && iconUrl.trim() ? (
                <img src={iconUrl} alt="App Icon" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-theme-text-muted text-[11px]">
                  512×512
                </div>
              )}
            </div>
            <span className="text-[10px] text-theme-text-muted mt-1.5 font-mono">
              {iconDiagnostics ? `${iconDiagnostics.width}×${iconDiagnostics.height}px` : 'No icon'}
            </span>
          </div>

          {/* Upload Controls & URL Input */}
          <div className="space-y-2">
            <input
              ref={iconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleIconFileUpload(e.target.files)}
              className="hidden"
            />

            {/* Click to browse text trigger */}
            <div
              onClick={() => iconInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleIconFileUpload(e.dataTransfer.files);
              }}
              className="border border-dashed border-theme-border rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
              <div className="text-xs font-medium text-theme-text">
                Choose 512×512 icon file or drop here
              </div>
              <p className="text-[10px] text-theme-text-muted mt-0.5">PNG or JPG up to 1 MB</p>
            </div>

            {/* Direct Image URL Input */}
            <div className="flex gap-2">
              <input
                type="url"
                maxLength={1000}
                placeholder="Or paste direct icon image URL..."
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className={`min-w-0 flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono text-theme-text outline-none transition-colors bg-transparent ${
                  iconUrl.trim() && iconDiagnostics && !iconDiagnostics.isValidIcon
                    ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5'
                    : iconUrl.trim() && iconDiagnostics?.isValidIcon
                    ? 'border-emerald-500/60 focus:border-emerald-500'
                    : 'border-theme-border focus:border-blue-500'
                }`}
              />
              {iconUrl && (
                <>
                  <button
                    type="button"
                    onClick={handleAutoFormatIcon}
                    className="px-2.5 py-1.5 text-blue-500 hover:text-blue-400 text-xs font-medium border border-theme-border rounded-lg shrink-0 transition-colors"
                  >
                    Auto-Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconUrl('')}
                    className="px-2.5 py-1.5 text-theme-text-muted hover:text-red-400 text-xs rounded-lg border border-theme-border shrink-0 transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {/* Diagnostics - Fixed min-height to prevent layout jumping */}
            <div className="text-[11px] min-h-[18px] flex items-center">
              {iconDiagnostics ? (
                iconDiagnostics.isValidIcon ? (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Valid 1:1 Icon ({iconDiagnostics.width}×{iconDiagnostics.height} px • {iconDiagnostics.fileSizeFormatted})</span>
                  </span>
                ) : (
                  <span className="text-rose-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{iconDiagnostics.width === 0 ? 'Image failed to load. Please verify the file or URL.' : `Dimensions: ${iconDiagnostics.width}×${iconDiagnostics.height} px (Recommended: 512×512)`}</span>
                  </span>
                )
              ) : (
                <span className="text-theme-text-muted/60 text-[10.5px]">
                  Standard icon size: 512×512 px PNG or JPG (up to 1 MB)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STORE BANNERS & FEATURE GRAPHICS (Multiple Sections • Exact 16:9) */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-2">
        {/* Section Header with Section Clarification & View Mode Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text">Store Banners</span>
            <span className="text-[11px] text-theme-text-muted">Multiple Sections • Exact 16:9 (1920 × 1080 px)</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAllBannerSections(!showAllBannerSections)}
            className="text-[11px] text-blue-500 hover:text-blue-400 font-medium underline cursor-pointer"
          >
            {showAllBannerSections ? 'Switch to Section Tabs' : 'Show All Banner Sections Stacked'}
          </button>
        </div>

        {/* Section Placement Tabs (Shown when not in stacked view) - Matching the Form Steps UI */}
        {!showAllBannerSections && (
          <div 
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 shrink-0"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            {[
              { id: 'universal', num: 1, title: 'Store Listing', isUploaded: !!featureGraphicUrl, isFallback: false },
              { id: 'details', num: 2, title: 'Details Header', isUploaded: !!detailsBannerUrl, isFallback: !detailsBannerUrl },
              { id: 'hero', num: 3, title: 'Spotlight & Hero', isUploaded: !!heroBannerUrl, isFallback: !heroBannerUrl },
            ].map((tab) => {
              const isActive = activeBannerTab === tab.id;
              const isCompleted = tab.isUploaded;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveBannerTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : isCompleted
                      ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-theme-hover/50 text-theme-text-muted hover:bg-theme-hover hover:text-theme-text'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-black/10 dark:bg-white/10 text-theme-text-muted'
                  }`}>
                    {isCompleted ? '✓' : tab.num}
                  </span>
                  <span>{tab.title}</span>
                  {tab.isFallback && !isActive && (
                    <span className="text-[10px] opacity-60 font-normal">(Fallback)</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* SECTION BANNER 1: UNIVERSAL STORE LISTING BANNER */}
        {(showAllBannerSections || activeBannerTab === 'universal') && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-theme-text">
                1. Store Listing Banner (Universal)
              </div>
              {featureGraphicUrl && (
                <button
                  type="button"
                  onClick={() => setFeatureGraphicUrl('')}
                  className="px-2.5 py-0.5 text-xs font-medium text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Banner Preview - Strict 16:9 */}
            <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-theme-border bg-zinc-900">
              {featureGraphicUrl && featureGraphicUrl.trim() ? (
                <img src={featureGraphicUrl} alt="Store Listing Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-theme-text-muted text-xs p-4 text-center">
                  <span className="font-medium">Universal Store Listing Banner (Exact 16:9)</span>
                  <span className="text-[10px] text-theme-text-muted/60 mt-1">1920 × 1080 or 1280 × 720 px Widescreen</span>
                </div>
              )}
            </div>

            {/* Universal Banner Controls */}
            <input
              ref={featureInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleFeatureFileUpload(e.target.files)}
              className="hidden"
            />

            <div className="space-y-2">
              <div
                onClick={() => featureInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFeatureFileUpload(e.dataTransfer.files);
                }}
                className="border border-dashed border-theme-border rounded-lg p-2.5 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <div className="text-xs font-medium text-theme-text">
                  Choose 16:9 banner file (1920×1080 or 1280×720) or drop here
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  maxLength={1000}
                  placeholder="Or paste direct store listing banner URL..."
                  value={featureGraphicUrl}
                  onChange={(e) => setFeatureGraphicUrl(e.target.value)}
                  className={`min-w-0 flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono text-theme-text outline-none transition-colors bg-transparent ${
                    featureGraphicUrl.trim() && featureDiagnostics && !featureDiagnostics.isValidFeatureGraphic
                      ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5'
                      : featureGraphicUrl.trim() && featureDiagnostics?.isValidFeatureGraphic
                      ? 'border-emerald-500/60 focus:border-emerald-500'
                      : 'border-theme-border focus:border-blue-500'
                  }`}
                />
                {featureGraphicUrl && (
                  <button
                    type="button"
                    onClick={handleAutoFormatFeature}
                    className="px-2.5 py-1.5 text-blue-500 hover:text-blue-400 text-xs font-medium border border-theme-border rounded-lg shrink-0 transition-colors"
                  >
                    Auto-Fit
                  </button>
                )}
              </div>

              {/* Diagnostics */}
              <div className="text-[11px] min-h-[18px] flex items-center">
                {featureDiagnostics ? (
                  featureDiagnostics.isValidFeatureGraphic ? (
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Valid 16:9 Banner ({featureDiagnostics.width}×{featureDiagnostics.height} px • {featureDiagnostics.fileSizeFormatted})</span>
                    </span>
                  ) : (
                    <span className="text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{featureDiagnostics.width === 0 ? 'Image failed to load. Please verify the file or URL.' : `Dimensions: ${featureDiagnostics.width}×${featureDiagnostics.height} px (Requires exact 16:9 ratio, e.g. 1920×1080 or 1280×720)`}</span>
                    </span>
                  )
                ) : (
                  <span className="text-theme-text-muted/60 text-[10.5px]">
                    Standard banner size: Exact 16:9 ratio (1920×1080 or 1280×720 px) PNG, JPG, or WebP
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION BANNER 2: APP DETAILS PAGE HEADER BANNER */}
        {(showAllBannerSections || activeBannerTab === 'details') && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-theme-text">
                2. App Details Header Banner
              </div>
              {detailsBannerUrl && (
                <button
                  type="button"
                  onClick={() => setDetailsBannerUrl('')}
                  className="px-2.5 py-0.5 text-xs font-medium text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Banner Preview - Strict 16:9 */}
            <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-theme-border bg-zinc-900">
              {detailsBannerUrl && detailsBannerUrl.trim() ? (
                <img src={detailsBannerUrl} alt="App Details Header Banner" className="w-full h-full object-cover" />
              ) : featureGraphicUrl && featureGraphicUrl.trim() ? (
                <div className="relative w-full h-full">
                  <img src={featureGraphicUrl} alt="Inheriting Store Listing Banner" className="w-full h-full object-cover opacity-75 filter blur-[0.5px]" />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-xs font-medium text-white bg-black/60 px-2.5 py-1 rounded-full border border-white/20">
                      Using Universal Store Listing Banner (Fallback)
                    </span>
                    <span className="text-[10px] text-white/70 mt-1">Upload below to customize for App Details Page</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-theme-text-muted text-xs p-4 text-center">
                  <span className="font-medium">App Details Header Banner (Exact 16:9)</span>
                  <span className="text-[10px] text-theme-text-muted/60 mt-1">1920 × 1080 px Widescreen</span>
                </div>
              )}
            </div>

            {/* Details Banner Controls */}
            <input
              ref={detailsBannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleDetailsBannerFileUpload(e.target.files)}
              className="hidden"
            />

            <div className="space-y-2">
              <div
                onClick={() => detailsBannerInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDetailsBannerFileUpload(e.dataTransfer.files);
                }}
                className="border border-dashed border-theme-border rounded-lg p-2.5 text-center cursor-pointer hover:border-emerald-500 transition-colors"
              >
                <div className="text-xs font-medium text-theme-text">
                  Choose 16:9 App Details banner file or drop here
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  maxLength={1000}
                  placeholder="Or paste direct App Details header banner URL..."
                  value={detailsBannerUrl}
                  onChange={(e) => setDetailsBannerUrl(e.target.value)}
                  className={`min-w-0 flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono text-theme-text outline-none transition-colors bg-transparent ${
                    detailsBannerUrl.trim() && detailsBannerDiagnostics && !detailsBannerDiagnostics.isValidFeatureGraphic
                      ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5'
                      : detailsBannerUrl.trim() && detailsBannerDiagnostics?.isValidFeatureGraphic
                      ? 'border-emerald-500/60 focus:border-emerald-500'
                      : 'border-theme-border focus:border-emerald-500'
                  }`}
                />
                {detailsBannerUrl && (
                  <button
                    type="button"
                    onClick={handleAutoFormatDetailsBanner}
                    className="px-2.5 py-1.5 text-emerald-500 hover:text-emerald-400 text-xs font-medium border border-theme-border rounded-lg shrink-0 transition-colors"
                  >
                    Auto-Fit
                  </button>
                )}
              </div>

              {/* Diagnostics */}
              <div className="text-[11px] min-h-[18px] flex items-center">
                {detailsBannerDiagnostics ? (
                  detailsBannerDiagnostics.isValidFeatureGraphic ? (
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Valid 16:9 App Details Banner ({detailsBannerDiagnostics.width}×{detailsBannerDiagnostics.height} px • {detailsBannerDiagnostics.fileSizeFormatted})</span>
                    </span>
                  ) : (
                    <span className="text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{detailsBannerDiagnostics.width === 0 ? 'Image failed to load. Please verify the file or URL.' : `Dimensions: ${detailsBannerDiagnostics.width}×${detailsBannerDiagnostics.height} px (Requires exact 16:9 ratio, e.g. 1920×1080 or 1280×720)`}</span>
                    </span>
                  )
                ) : (
                  <span className="text-theme-text-muted/60 text-[10.5px]">
                    Optional custom header banner for App Details Page (falls back to Universal banner)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION BANNER 3: HOME SPOTLIGHT & HERO CAROUSEL BANNER */}
        {(showAllBannerSections || activeBannerTab === 'hero') && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-theme-text">
                3. Home Spotlight & Hero Banner
              </div>
              {heroBannerUrl && (
                <button
                  type="button"
                  onClick={() => setHeroBannerUrl('')}
                  className="px-2.5 py-0.5 text-xs font-medium text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Banner Preview - Strict 16:9 */}
            <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-theme-border bg-zinc-900">
              {heroBannerUrl && heroBannerUrl.trim() ? (
                <img src={heroBannerUrl} alt="Home Spotlight Hero Banner" className="w-full h-full object-cover" />
              ) : featureGraphicUrl && featureGraphicUrl.trim() ? (
                <div className="relative w-full h-full">
                  <img src={featureGraphicUrl} alt="Inheriting Store Listing Banner" className="w-full h-full object-cover opacity-75 filter blur-[0.5px]" />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-xs font-medium text-white bg-black/60 px-2.5 py-1 rounded-full border border-white/20">
                      Using Universal Store Listing Banner (Fallback)
                    </span>
                    <span className="text-[10px] text-white/70 mt-1">Upload below to customize for Spotlight Hero Carousel</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-theme-text-muted text-xs p-4 text-center">
                  <span className="font-medium">Home Spotlight Hero Banner (Exact 16:9)</span>
                  <span className="text-[10px] text-theme-text-muted/60 mt-1">1920 × 1080 px Widescreen</span>
                </div>
              )}
            </div>

            {/* Hero Banner Controls */}
            <input
              ref={heroBannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleHeroBannerFileUpload(e.target.files)}
              className="hidden"
            />

            <div className="space-y-2">
              <div
                onClick={() => heroBannerInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleHeroBannerFileUpload(e.dataTransfer.files);
                }}
                className="border border-dashed border-theme-border rounded-lg p-2.5 text-center cursor-pointer hover:border-amber-500 transition-colors"
              >
                <div className="text-xs font-medium text-theme-text">
                  Choose 16:9 Spotlight Hero banner file or drop here
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  maxLength={1000}
                  placeholder="Or paste direct Spotlight Hero banner URL..."
                  value={heroBannerUrl}
                  onChange={(e) => setHeroBannerUrl(e.target.value)}
                  className={`min-w-0 flex-1 border rounded-lg px-3 py-1.5 text-xs font-mono text-theme-text outline-none transition-colors bg-transparent ${
                    heroBannerUrl.trim() && heroBannerDiagnostics && !heroBannerDiagnostics.isValidFeatureGraphic
                      ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5'
                      : heroBannerUrl.trim() && heroBannerDiagnostics?.isValidFeatureGraphic
                      ? 'border-emerald-500/60 focus:border-emerald-500'
                      : 'border-theme-border focus:border-amber-500'
                  }`}
                />
                {heroBannerUrl && (
                  <button
                    type="button"
                    onClick={handleAutoFormatHeroBanner}
                    className="px-2.5 py-1.5 text-amber-500 hover:text-amber-400 text-xs font-medium border border-theme-border rounded-lg shrink-0 transition-colors"
                  >
                    Auto-Fit
                  </button>
                )}
              </div>

              {/* Diagnostics */}
              <div className="text-[11px] min-h-[18px] flex items-center">
                {heroBannerDiagnostics ? (
                  heroBannerDiagnostics.isValidFeatureGraphic ? (
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Valid 16:9 Spotlight Banner ({heroBannerDiagnostics.width}×{heroBannerDiagnostics.height} px • {heroBannerDiagnostics.fileSizeFormatted})</span>
                    </span>
                  ) : (
                    <span className="text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{heroBannerDiagnostics.width === 0 ? 'Image failed to load. Please verify the file or URL.' : `Dimensions: ${heroBannerDiagnostics.width}×${heroBannerDiagnostics.height} px (Requires exact 16:9 ratio, e.g. 1920×1080 or 1280×720)`}</span>
                    </span>
                  )
                ) : (
                  <span className="text-theme-text-muted/60 text-[10.5px]">
                    Optional custom banner for Home Spotlight carousel & editorial cards (falls back to Universal banner)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. APP PREVIEW IMAGES / SCREENSHOTS */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text">Screenshot Previews</span>
            <span className="text-[11px] text-theme-text-muted">{currentScreenshots.length} / 20 uploaded</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => screenshotInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload Images
            </button>
            {/* Device Form Factor Switcher */}
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveDeviceTab('phone')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDeviceTab === 'phone' ? 'bg-blue-600 text-white font-medium' : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                Mobile ({screenshots.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDeviceTab('tablet')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDeviceTab === 'tablet' ? 'bg-blue-600 text-white font-medium' : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                Tablet ({tabletScreenshots.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDeviceTab('desktop')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDeviceTab === 'desktop' ? 'bg-blue-600 text-white font-medium' : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                Desktop ({desktopScreenshots.length})
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Multi-file Input */}
        <input
          ref={screenshotInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handleScreenshotFilesUpload(e.target.files)}
          className="hidden"
        />

        {/* Direct URL input for screenshots */}
        <div className="flex gap-2">
          <input
            type="url"
            maxLength={1000}
            placeholder="Or paste screenshot image URL (press Enter to add)..."
            value={newScreenshotUrl}
            onChange={(e) => setNewScreenshotUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddScreenshotUrl();
              }
            }}
            className="flex-1 border border-theme-border rounded-lg px-3 py-1.5 text-xs text-theme-text outline-none focus:border-blue-500 bg-transparent"
          />
          <button
            type="button"
            disabled={!newScreenshotUrl.trim()}
            onClick={handleAddScreenshotUrl}
            className="px-3 py-1.5 bg-theme-hover hover:bg-blue-600 hover:text-white text-xs font-medium rounded-lg border border-theme-border transition-colors disabled:opacity-40 cursor-pointer"
          >
            Add URL
          </button>
        </div>

        {/* Screenshots Horizontal Gallery Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-theme-text-muted">
            <span>
              {currentScreenshots.length > 0 
                ? `${currentScreenshots.length} preview image${currentScreenshots.length > 1 ? 's' : ''} added (Primary preview is #1)`
                : 'No preview images uploaded yet'}
            </span>
            {currentScreenshots.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setLightboxIndex(featureGraphicUrl || promoVideoUrl ? 1 : 0);
                  setLightboxOpen(true);
                }}
                className="text-blue-500 hover:underline cursor-pointer"
              >
                Fullscreen View
              </button>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
            {currentScreenshots.map((shot, idx) => {
              const shotRatio = screenshotAspectRatios[shot];
              const isHorizontal = shotRatio ? shotRatio >= 1.05 : false;
              const defaultAspect = activeDeviceTab === 'desktop' ? '16/9' : activeDeviceTab === 'tablet' ? '4/3' : '9/16';

              return (
                <div
                  key={idx}
                  className="relative shrink-0 flex flex-col group transition-all"
                >
                  {/* Position label and Controls (fixed h-4 to prevent shift) */}
                  <div className="flex items-center justify-between mb-1 h-4 text-[10px] text-theme-text-muted">
                    <span className="font-mono">#{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveScreenshot(idx, 'left')}
                        className="text-theme-text-muted hover:text-theme-text disabled:opacity-20 px-1 cursor-pointer"
                        title="Move left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={idx === currentScreenshots.length - 1}
                        onClick={() => handleMoveScreenshot(idx, 'right')}
                        className="text-theme-text-muted hover:text-theme-text disabled:opacity-20 px-1 cursor-pointer"
                        title="Move right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScreenshot(idx)}
                        className="text-theme-text-muted hover:text-red-400 px-1 font-bold cursor-pointer"
                        title="Delete image"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Screenshot Image - Natural Ratio Preserved, zero jump before load */}
                  <div 
                    onClick={() => {
                      setLightboxIndex(idx + (promoVideoUrl ? 1 : 0) + (featureGraphicUrl ? 1 : 0));
                      setLightboxOpen(true);
                    }}
                    style={{ 
                      aspectRatio: shotRatio ? `${shotRatio}` : defaultAspect,
                    }}
                    className="cursor-pointer overflow-hidden rounded-[3px] h-[180px] w-auto bg-black/40 shadow-sm group select-none transition-all flex items-center justify-center shrink-0 relative border border-theme-border/50 hover:border-blue-500/60"
                  >
                    {shot && shot.trim() ? (
                      <img
                        src={shot}
                        alt={`Screenshot ${idx + 1}`}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth && img.naturalHeight) {
                            const r = img.naturalWidth / img.naturalHeight;
                            setScreenshotAspectRatios((prev) => (prev[shot] === r ? prev : { ...prev, [shot]: r }));
                          }
                        }}
                        className="h-full w-auto max-w-none object-contain group-hover:opacity-95 transition-opacity pointer-events-none rounded-[3px]"
                      />
                    ) : null}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/75 text-white/90 backdrop-blur-sm pointer-events-none select-none">
                      {isHorizontal ? 'Horizontal' : 'Vertical'}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Persistent "+ Add More" card at the end of the list with matching dimensions */}
            {currentScreenshots.length > 0 && currentScreenshots.length < 20 && (
              <div
                onClick={() => screenshotInputRef.current?.click()}
                className="relative shrink-0 flex flex-col cursor-pointer group"
                title="Click to add more preview images"
              >
                <div className="flex items-center justify-between mb-1 h-4 text-[10px] text-theme-text-muted/60 font-mono">
                  <span>#{currentScreenshots.length + 1}</span>
                </div>
                <div 
                  style={{ aspectRatio: activeDeviceTab === 'desktop' ? '16/9' : activeDeviceTab === 'tablet' ? '4/3' : '9/16' }}
                  className="h-[180px] w-auto rounded-[3px] border-2 border-dashed border-theme-border/80 hover:border-blue-500 bg-theme-hover/20 hover:bg-blue-500/10 transition-all flex flex-col items-center justify-center p-3 text-center text-theme-text-muted hover:text-blue-500"
                >
                  <div className="w-8 h-8 rounded-full bg-theme-hover flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                    <Plus className="w-4 h-4 text-theme-text group-hover:text-blue-500" />
                  </div>
                  <span className="text-[11px] font-medium text-theme-text group-hover:text-blue-500">Add More</span>
                  <span className="text-[9px] opacity-70 mt-0.5">Upload image</span>
                </div>
              </div>
            )}

            {/* Empty state slots when 0 screenshots - exactly match screenshot dimensions for zero UI shift */}
            {currentScreenshots.length === 0 && (
              <>
                {[1, 2, 3].map((slot) => (
                  <div
                    key={`empty-slot-${slot}`}
                    onClick={() => screenshotInputRef.current?.click()}
                    className="relative shrink-0 flex flex-col cursor-pointer group"
                    title={`Click to upload screenshot for Slot #${slot}`}
                  >
                    <div className="flex items-center justify-between mb-1 h-4 text-[10px] text-theme-text-muted/60 font-mono">
                      <span>#{slot}</span>
                    </div>
                    <div 
                      style={{ aspectRatio: activeDeviceTab === 'desktop' ? '16/9' : activeDeviceTab === 'tablet' ? '4/3' : '9/16' }}
                      className="h-[180px] w-auto rounded-[3px] border-2 border-dashed border-theme-border/80 bg-theme-hover/20 hover:border-blue-500 hover:bg-blue-500/10 transition-all flex flex-col items-center justify-center p-2 text-center text-theme-text-muted group-hover:text-blue-500"
                    >
                      {slot === 1 ? (
                        <>
                          <div className="w-7 h-7 rounded-full bg-theme-hover flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                            <Plus className="w-3.5 h-3.5 text-theme-text group-hover:text-blue-500" />
                          </div>
                          <span className="text-[10px] font-medium text-theme-text group-hover:text-blue-500">Add Shot</span>
                          <span className="text-[8.5px] opacity-60 mt-0.5">Primary</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-medium">Slot {slot}</span>
                          <span className="text-[9px] opacity-60 mt-1">Add shot</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PROMO VIDEO (YOUTUBE URL) */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text">Promo Video URL</span>
            <span className="text-[11px] text-theme-text-muted">YouTube Trailer</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              id="input-promo-video-url"
              type="url"
              maxLength={1000}
              placeholder="https://www.youtube.com/watch?v=..."
              value={promoVideoUrl}
              onChange={(e) => setPromoVideoUrl(e.target.value.slice(0, 1000))}
              className={`flex-1 border rounded-lg px-3 py-2 text-xs font-mono outline-none transition-colors bg-transparent ${
                displayVideoError
                  ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5 text-rose-400'
                  : promoVideoUrl.trim() && youtubeId
                  ? 'border-emerald-500/60 focus:border-emerald-500'
                  : 'border-theme-border text-theme-text focus:border-blue-500'
              }`}
            />
            {promoVideoUrl ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateMedia({ promoVideoUrl: '', videoThumbnailUrl: '' });
                  if (videoThumbnailInputRef.current) {
                    videoThumbnailInputRef.current.value = '';
                  }
                }}
                className="px-2.5 py-1.5 text-theme-text-muted hover:text-red-400 text-xs rounded-lg border border-theme-border shrink-0 transition-colors cursor-pointer"
                title="Clear video link"
              >
                Clear
              </button>
            ) : null}
          </div>

          {/* Dynamic Video Authorization Status Indicator */}
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            {promoVideoUrl.trim() ? (
              youtubeId ? (
                <span className="text-emerald-500 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Authorized: Verified YouTube Trailer Video (ID: {youtubeId})</span>
                </span>
              ) : (
                <span className="text-rose-500 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Invalid URL: Please enter a valid YouTube video link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)</span>
                </span>
              )
            ) : (
              <span className="text-theme-text-muted text-[10.5px]">
                Optional: Add a YouTube link to showcase gameplay or an app trailer
              </span>
            )}
          </div>

          {/* YouTube Video Preview Container (Fixed aspect-video for zero layout shift) */}
          <div className="mt-2 space-y-2.5">
            {/* Hidden file input for direct media select from phone gallery */}
            <input
              ref={videoThumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleDirectThumbnailUpload}
            />

            <div className="aspect-video w-full max-w-sm rounded-xl overflow-hidden bg-black/40 shadow-md relative group border border-theme-border/60">
              {youtubeId ? (
                <>
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                    title="Promo Video Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />

                  {/* Colorless pen icon button on top of the video: no border, no label, opens phone gallery directly */}
                  <button
                    type="button"
                    onClick={() => videoThumbnailInputRef.current?.click()}
                    title="Select video thumbnail from gallery"
                    aria-label="Select video thumbnail from gallery"
                    className="absolute top-2.5 right-2.5 z-20 p-2 bg-transparent text-white/90 hover:text-white transition-transform hover:scale-110 active:scale-95 cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-theme-border/70 rounded-xl bg-theme-hover/10 select-none">
                  <div className="w-10 h-10 rounded-full bg-theme-hover flex items-center justify-center mb-1.5 text-theme-text-muted">
                    <Video className="w-5 h-5 opacity-70" />
                  </div>
                  <p className="text-xs font-medium text-theme-text">No promo video added</p>
                  <p className="text-[10px] text-theme-text-muted mt-0.5 max-w-[240px]">
                    Paste a YouTube trailer link above to preview video and custom thumbnail
                  </p>
                </div>
              )}
            </div>

            {/* Permanent Custom Thumbnail slot - Stabilized with fixed min-h-[50px] so it never expands suddenly */}
            <div className="w-full max-w-sm">
              {videoThumbnailUrl ? (
                <div className="flex items-center justify-between gap-2.5 px-3 py-2 bg-theme-bg rounded-lg border border-theme-border text-xs min-h-[50px]">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img 
                      src={videoThumbnailUrl} 
                      alt="Selected thumbnail" 
                      className="w-12 h-7 rounded object-cover border border-theme-border shrink-0" 
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-theme-text truncate">
                        Custom Thumbnail Active
                      </p>
                      <p className="text-[10px] text-theme-text-muted truncate">
                        Applied to app details promo trailer
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => videoThumbnailInputRef.current?.click()}
                      className="text-blue-500 hover:text-blue-400 text-xs px-2 py-1 font-medium rounded hover:bg-blue-500/10 transition-colors cursor-pointer"
                      title="Choose a different image from gallery"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setVideoThumbnailUrl('');
                        if (videoThumbnailInputRef.current) {
                          videoThumbnailInputRef.current.value = '';
                        }
                      }}
                      className="text-theme-text-muted hover:text-red-400 text-xs px-1.5 py-1 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Reset to default YouTube thumbnail"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : youtubeId ? (
                <div className="flex items-center justify-between gap-2.5 px-3 py-2 bg-theme-bg/60 rounded-lg border border-theme-border text-xs min-h-[50px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-theme-text truncate">
                      Default YouTube HQ Thumbnail
                    </p>
                    <p className="text-[10px] text-theme-text-muted truncate">
                      Tap pen on video or button to set custom thumbnail
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => videoThumbnailInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-theme-hover hover:bg-blue-600 hover:text-white text-theme-text text-xs font-medium rounded-md border border-theme-border transition-colors cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Upload Thumbnail</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2.5 px-3 py-2 bg-theme-hover/10 rounded-lg border border-dashed border-theme-border/70 text-xs min-h-[50px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-theme-text truncate">
                      Custom Video Thumbnail (Optional)
                    </p>
                    <p className="text-[10px] text-theme-text-muted truncate">
                      16:9 image displayed on store listing
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => videoThumbnailInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-theme-hover hover:bg-blue-600 hover:text-white text-theme-text text-xs font-medium rounded-md border border-theme-border transition-colors cursor-pointer shrink-0"
                  >
                    <span>Choose Image</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
