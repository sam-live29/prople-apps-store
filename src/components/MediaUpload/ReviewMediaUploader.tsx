import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, Plus, AlertCircle } from 'lucide-react';
import { fileToDataUrl, inspectImage } from '../../utils/mediaUtils';
import { useToast } from '../../context/ToastContext';

interface ReviewMediaUploaderProps {
  media: string[];
  onChange: (media: string[]) => void;
  maxFiles?: number;
}

export default function ReviewMediaUploader({
  media = [],
  onChange,
  maxFiles = 4
}: ReviewMediaUploaderProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (media.length + files.length > maxFiles) {
      showToast(`You can attach up to ${maxFiles} images per review.`);
      return;
    }

    try {
      setIsProcessing(true);
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          showToast(`"${file.name}" exceeds 5 MB limit.`);
          continue;
        }

        const dataUrl = await fileToDataUrl(file);
        newUrls.push(dataUrl);
      }

      onChange([...media, ...newUrls].slice(0, maxFiles));
    } catch (err) {
      showToast('Failed to load selected photos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = (index: number) => {
    onChange(media.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-theme-text-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <Camera className="w-3.5 h-3.5 text-theme-text-muted" />
          <span>Attach photos or screenshots (Optional)</span>
        </span>
        <span>{media.length} / {maxFiles}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Thumbnails Row */}
      <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1">
        {media.filter(url => Boolean(url && typeof url === 'string' && url.trim().length > 0)).map((url, idx) => (
          <div
            key={idx}
            className="relative w-16 h-16 rounded-xl overflow-hidden border border-theme-border bg-theme-hover shrink-0 group shadow-sm"
          >
            <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors"
              title="Remove photo"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {media.length < maxFiles && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-16 h-16 rounded-xl border-2 border-dashed border-theme-border hover:border-blue-500/60 bg-theme-hover/30 hover:bg-theme-hover/60 flex flex-col items-center justify-center gap-1 text-theme-text-muted hover:text-blue-400 transition-colors shrink-0"
            title="Add photo"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[9px] font-medium">Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
