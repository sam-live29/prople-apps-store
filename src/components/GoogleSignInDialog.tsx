import React, { useState } from 'react';
import { 
  X, 
  Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigation } from '../context/NavigationContext';
import defaultLogo from '../assets/images/logo.png';

interface PendingInstallInfo {
  appId: string;
  appName?: string;
  iconUrl?: string;
  sizeString?: string;
  fileName?: string;
}

interface GoogleSignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingApp?: PendingInstallInfo | null;
  onSuccess?: () => void;
  mode?: 'default' | 'publisher' | 'review';
  customTitle?: string;
  customSubtitle?: string;
}

export default function GoogleSignInDialog({
  isOpen,
  onClose,
  pendingApp,
  onSuccess,
  mode = 'default',
  customTitle,
  customSubtitle
}: GoogleSignInDialogProps) {
  const { loginWithGoogle, isLoading } = useAuth();
  const { showToast } = useToast();
  const { openAuthPage } = useNavigation();

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      showToast('Signed in with Google');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in failed. Please try again with a legitimate Google account.';
      setErrorMessage(msg);
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="google-signin-overlay"
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Borderless straight-corner popup modal matching report window */}
      <div
        className="w-full max-w-sm sm:max-w-md bg-theme-bg p-5 sm:p-6 shadow-2xl space-y-4 rounded-none border-0 text-theme-text animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Prople Logo & Prople Store Label + Close Cross */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2 select-none">
            <img
              src={defaultLogo}
              alt="Prople Store"
              className="w-5 h-5 object-contain shrink-0 rounded-none"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== defaultLogo) {
                  target.src = defaultLogo;
                }
              }}
            />
            <span className="text-xs font-semibold tracking-tight text-theme-text font-sans">
              Prople Store
            </span>
          </div>
          <button
            type="button"
            id="close-google-signin-btn"
            onClick={onClose}
            className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text active:bg-theme-hover transition-colors cursor-pointer rounded-none"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-medium text-theme-text tracking-tight leading-snug">
            {customTitle ? customTitle : mode === 'publisher' ? 'Publisher sign-in required' : mode === 'review' ? 'Sign in to leave a review' : pendingApp ? 'Sign in to sync app' : 'Sign in with Google'}
          </h2>
          <p className="text-xs text-theme-text-muted leading-relaxed">
            {customSubtitle ? customSubtitle : mode === 'publisher'
              ? 'To publish apps, release updates, and access the Developer Console, please sign in with your Google account.'
              : mode === 'review'
              ? 'Sign in with your Google account to post a verified rating and review for this application.'
              : pendingApp 
              ? `Sign in with your Google account to sync ${pendingApp.appName || 'this application'} with your library.`
              : 'Choose your Google account to continue to Prople Store.'}
          </p>
        </div>

        {/* Pending App Info Item (if triggered by Install action) */}
        {pendingApp && (
          <div className="py-2 flex items-center gap-3">
            <div className="w-11 h-11 shrink-0 flex items-center justify-center bg-theme-hover/50 overflow-hidden rounded-none">
              {pendingApp.iconUrl && pendingApp.iconUrl.trim() ? (
                <img 
                  src={pendingApp.iconUrl} 
                  alt={pendingApp.appName || 'App'} 
                  className="w-full h-full object-cover rounded-none" 
                />
              ) : (
                <Download className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-theme-text truncate">
                {pendingApp.appName || 'Application Package'}
              </h3>
              <p className="text-xs text-theme-text-muted truncate mt-0.5">
                {pendingApp.sizeString || '26.2 MB'} • Verified by Prople Protect
              </p>
            </div>
          </div>
        )}

        {/* Inline Error Message */}
        {errorMessage && (
          <p className="text-xs text-red-500 font-medium text-center py-1 leading-relaxed animate-fadeIn">
            {errorMessage}
          </p>
        )}

        {/* Primary Google & Email Sign-in Options */}
        <div className="pt-1 space-y-2">
          <button
            type="button"
            id="google-signin-dialog-btn"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isLoading}
            className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-none text-sm font-medium flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs active:opacity-90 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {isSubmitting ? 'Signing in with Google...' : 'Continue with Google'}
            </span>
          </button>

          <button
            type="button"
            id="email-signin-dialog-btn"
            onClick={() => {
              onClose();
              openAuthPage();
            }}
            className="w-full py-2.5 px-4 bg-theme-card hover:bg-theme-hover text-theme-text border border-theme-border/60 rounded-none text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="52 42 88 66" aria-hidden="true">
              <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
              <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
              <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
              <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
              <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
            </svg>
            <span>Sign in with Email OTP</span>
          </button>
        </div>

        {/* Privacy note and Actions */}
        <div className="pt-2 flex items-center justify-between gap-3 text-[11px] text-theme-text-muted">
          <p className="leading-tight text-left">
            To continue, Google shares your account info with Prople Store.
          </p>
          <button
            type="button"
            id="cancel-signin-btn"
            onClick={onClose}
            className="shrink-0 text-blue-500 hover:text-blue-400 font-medium text-xs px-3 py-1.5 rounded-none hover:bg-theme-hover transition-colors cursor-pointer"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
