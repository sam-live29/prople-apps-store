import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import QRCode from 'qrcode';
import { useTheme } from '../context/ThemeContext';
import appLogo from '../assets/images/logo.png';
import donationQrImage from '../assets/images/regenerated_image_1789930106285.png';

interface DeveloperDonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone?: number | null;
}

const UPI_ID = 'proplestore@upi';
const UPI_PAYLOAD = `upi://pay?pa=${UPI_ID}&pn=Prople%20Store%20Infrastructure&cu=INR&tn=Server%20Hosting%20Sponsorship`;

export function DeveloperDonationModal({
  isOpen,
  onClose,
  milestone
}: DeveloperDonationModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const { theme } = useTheme();

  useEffect(() => {
    // Generate QR with clean transparent background adapted to current theme and High error correction level for logo center
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    QRCode.toDataURL(UPI_PAYLOAD, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: isDark ? '#f1f5f9' : '#0f172a',
        light: '#00000000' // transparent background
      }
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Error generating UPI QR code:', err));
  }, [theme]);

  if (!isOpen) return null;

  return (
    <div
      id="dev-donation-modal-backdrop"
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="dev-donation-modal-content"
        className="w-full max-w-sm sm:max-w-md bg-theme-bg p-5 shadow-2xl space-y-4 rounded-none border-0 animate-in zoom-in-95 duration-150 text-theme-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Red Heart (No cross icon) */}
        <div className="pb-1 border-b border-theme-border/20">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500 fill-red-500 shrink-0" />
            <h3 className="text-base sm:text-lg font-medium text-theme-text leading-snug">
              Sustain Prople Platform
            </h3>
          </div>
          <p className="text-[12px] text-theme-text-muted mt-0.5">
            {milestone
              ? milestone === 2
                ? 'Congratulations on publishing your first 2 apps!'
                : `Milestone reached: Congratulations on publishing ${milestone} apps!`
              : 'A note from the developer team..'}
          </p>
        </div>

        {/* Content & Pure QR Code with centered App Logo */}
        <div className="space-y-4 text-xs sm:text-[13px] text-theme-text-muted leading-relaxed">
          <p className="text-theme-text font-normal">
            {milestone
              ? milestone === 2
                ? 'A note from the developer team: As you celebrate publishing your first 2 apps, we wanted to thank you for building on Prople Store. We work hard to keep Prople Store completely free and open for every creator. If you would like to help us cover server and hosting costs, any voluntary contribution means a lot to us:'
                : `A note from the developer team: You've reached an incredible milestone with ${milestone} published apps on Prople Store! We work hard to keep Prople Store completely free and open for every creator. If you would like to help us cover server and hosting infrastructure, any voluntary contribution means a lot to us:`
              : 'A note from the developer team: We work hard to keep Prople Store completely free and open for everyone. If you appreciate what we\'re building and would like to help us cover our server and hosting costs, any voluntary contribution means a lot to us:'}
          </p>

          {/* Pure QR code with App Logo centered */}
          <div className="flex items-center justify-center py-2">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <img
                src={donationQrImage || qrCodeDataUrl}
                alt="Donation QR Code"
                className="w-full h-full object-contain bg-transparent select-none"
              />
              {/* Centered App Logo with solid white background to cover underlying logo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white flex items-center justify-center p-1.5 shadow-xs border border-gray-100">
                  <img
                    src={appLogo}
                    alt="Prople Store Logo"
                    className="w-full h-full object-contain select-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Thanking message at the bottom & Done button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-theme-border/20">
          <p className="text-[12px] text-theme-text-muted text-center sm:text-left">
            Thank you for supporting the Prople platform!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 text-sm font-medium bg-theme-hover hover:opacity-90 text-theme-text rounded-none border-0 transition-colors cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
