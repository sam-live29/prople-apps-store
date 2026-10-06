import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ArrowRight, 
  LogIn, 
  UserPlus, 
  RefreshCw, 
  KeyRound, 
  Mail,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigation } from '../context/NavigationContext';
import { safeFetchJson } from '../utils/safeFetch';
import { sanitizeErrorMessage } from '../utils/errorUtils';
import BrandLogo from './BrandLogo';
import StoreCircleLoader from './StoreCircleLoader';
import TermsPage from './TermsPage';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import { usePreserveScroll } from '../services/scrollManager';
import { auth } from '../firebase';

interface AuthPageProps {
  onClose?: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthPage({ onClose, onSuccess, initialMode = 'signin' }: AuthPageProps) {
  const { 
    login, 
    verifyPasswordStep,
    cancelPendingTwoFactor,
    signup, 
    loginWithGoogle, 
    sendEmailOtp, 
    verifyEmailOtp, 
    forgotPassword, 
    resetPasswordWithCode, 
    completeExternalAuth, 
    isLoading 
  } = useAuth();
  const { showToast, dismissToast } = useToast();
  const { resetToHome } = useNavigation();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [step, setStep] = useState<'form' | 'verify-otp' | 'forgot-email' | 'reset-otp' | 'reset-new-password'>('form');
  const [otpPurpose, setOtpPurpose] = useState<'signup' | 'signin'>('signup');

  // Sync mode with initialMode prop updates
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  const handleAuthSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else if (onClose) {
      onClose();
    } else {
      try {
        resetToHome?.();
      } catch {}
    }
  };

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`auth-${mode}-${step}`, scrollRef);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Password Reset Fields
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // UI States
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    terms?: string;
    otp?: string;
    resetCode?: string;
    newPassword?: string;
    confirmNewPassword?: string;
    general?: string;
  }>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  // Check URL query parameters on mount (direct 1-click password reset or email verification links)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const authParam = searchParams.get('auth');
      const actionParam = searchParams.get('action');
      const modeParam = searchParams.get('mode');
      const emailParam = searchParams.get('email');
      const codeParam = searchParams.get('code') || searchParams.get('oobCode');

      // Detect in-app Android/Gmail webview to break out or show banner
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isAndroid = /Android/i.test(ua);
      const isGmailOrWebview = /Gmail|GSA|Version\/[0-9.]+/i.test(ua) || (isAndroid && ua.includes('; wv'));
      if (isAndroid && isGmailOrWebview) {
        setIsInAppBrowser(true);
        try {
          if (!sessionStorage.getItem('prople_attempted_chrome_intent')) {
            sessionStorage.setItem('prople_attempted_chrome_intent', '1');
            const intentUrl = "intent://" + window.location.host + window.location.pathname + window.location.search + "#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end";
            window.location.href = intentUrl;
          }
        } catch {}
      }

      const isResetMode =
        authParam === 'reset-password' ||
        actionParam === 'reset-password' ||
        modeParam === 'reset-password' ||
        modeParam === 'resetPassword' ||
        (Boolean(searchParams.get('oobCode')) && modeParam !== 'verifyEmail');

      const isVerifyEmailMode =
        authParam === 'verify-email' ||
        actionParam === 'verify-email' ||
        modeParam === 'verifyEmail' ||
        modeParam === 'signIn' ||
        (Boolean(searchParams.get('oobCode')) && modeParam === 'verifyEmail');

      if (isResetMode) {
        if (emailParam) {
          setEmail(decodeURIComponent(emailParam));
        } else if (searchParams.get('oobCode')) {
          import('firebase/auth').then(({ verifyPasswordResetCode }) => {
            verifyPasswordResetCode(auth, searchParams.get('oobCode')!)
              .then((userEmail) => {
                if (userEmail) setEmail(userEmail);
              })
              .catch(() => {});
          });
        }

        if (codeParam) {
          setResetCode(decodeURIComponent(codeParam));
          // If code or oobCode is provided in the direct link, jump directly to set new password!
          setStep('reset-new-password');
        } else {
          setStep('reset-otp');
        }
      } else if (isVerifyEmailMode) {
        const cleanEmail = emailParam ? decodeURIComponent(emailParam) : '';
        const cleanCode = codeParam ? decodeURIComponent(codeParam) : '';
        if (cleanEmail) setEmail(cleanEmail);
        if (cleanCode) setOtpCode(cleanCode);

        // If email and 6-digit code or oobCode are provided in query params, auto-verify immediately!
        if (cleanEmail && cleanCode) {
          setIsSubmitting(true);
          verifyEmailOtp(cleanEmail, cleanCode)
            .then(() => {
              showToast('Email verified successfully! Welcome to Prople Store.');
              handleAuthSuccess();
            })
            .catch((err) => {
              setStep('verify-otp');
              const msg = sanitizeErrorMessage(err, 'Verification could not be confirmed. Please check your code.');
              setFieldErrors({ otp: msg });
              showToast(msg);
            })
            .finally(() => {
              setIsSubmitting(false);
            });
        } else {
          setStep('verify-otp');
        }
      }
    } catch {}
  }, []);

  // Real-time synchronization: automatically log in if password was reset or OTP was verified in another window (like Gmail)
  useEffect(() => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || (step !== 'reset-otp' && step !== 'reset-new-password' && step !== 'verify-otp')) {
      return;
    }

    let isSubscribed = true;

    const checkSessionStatus = async () => {
      if (!isSubscribed) return;
      try {
        const { ok, data } = await safeFetchJson<{
          success: boolean;
          status: 'pending' | 'completed' | 'none';
          user?: any;
        }>(`/api/auth/session-status?email=${encodeURIComponent(targetEmail)}`);

        if (ok && data?.status === 'completed' && data.user) {
          isSubscribed = false;
          // Consume session so it's not reused
          safeFetchJson('/api/auth/consume-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail }),
          }).catch(() => {});

          completeExternalAuth(data.user);
          showToast('Authentication confirmed! You are now logged in.');
          handleAuthSuccess();
        }
      } catch {}
    };

    // 1. Initial check
    checkSessionStatus();

    // 2. Poll every 2.5 seconds while waiting
    const interval = setInterval(checkSessionStatus, 2500);

    // 3. CRITICAL: Trigger check immediately when user switches between Gmail and Chrome!
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionStatus();
      }
    };
    const handleWindowFocus = () => {
      checkSessionStatus();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [email, step, completeExternalAuth, onSuccess, onClose, resetToHome, showToast]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Handle Standard Email + Password Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string; general?: string } = {};
    if (!email || !email.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      newErrors.password = 'Please enter your password.';
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      showToast('Signed in successfully! Welcome back.');
      handleAuthSuccess();
    } catch (err: any) {
      console.warn('Sign-in notice:', err?.code || err?.message);
      if (err?.code === 'auth/ip-locked' || err?.code === 'auth/too-many-requests') {
        const msg = err.message || 'Access temporarily restricted due to security limits. Please try again later.';
        setFieldErrors({ general: msg });
        showToast(msg);
      } else if (err?.code === 'auth/user-not-found') {
        setFieldErrors({ email: 'No account found with this email. Please check your email or sign up.' });
        showToast('No account found with this email. Please check your email or sign up.');
      } else if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setFieldErrors({ password: 'Incorrect password. Click "Forgot password?" above to reset it.' });
        showToast('Incorrect password. Failed attempt logged for security.');
      } else if (err?.code === 'auth/invalid-email') {
        setFieldErrors({ email: 'The email address is improperly formatted.' });
        showToast('The email address is improperly formatted.');
      } else {
        const msg = sanitizeErrorMessage(err, 'Unable to sign in. Please verify your credentials and try again.');
        setFieldErrors({ general: msg });
        showToast(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password Click - direct dispatch if email already entered, otherwise open dedicated forgot-email view
  const handleForgotPasswordClick = () => {
    setFieldErrors({});
    if (email && email.includes('@')) {
      handleSendResetCode(email.trim());
    } else {
      setStep('forgot-email');
    }
  };

  // Dispatch 6-digit Reset Code & Email Link
  const handleSendResetCode = async (targetEmail: string) => {
    if (!targetEmail || !targetEmail.includes('@')) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await forgotPassword(targetEmail.trim());
      setEmail(targetEmail.trim());
      setStep('reset-otp');
      setResendCooldown(60);
      showToast(res.message || 'Verification code sent to your email.', { duration: 7000 });
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to send verification code. Please try again.');
      setFieldErrors({ email: msg });
      showToast(msg, { duration: 7000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate OTP in step 1 of password reset, then transition to step 2 (Set new password)
  const handleVerifyResetOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = resetCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setFieldErrors({ resetCode: 'Please enter the 6-digit verification code.' });
      return;
    }
    setFieldErrors({});
    setStep('reset-new-password');
  };

  // Handle Sign Up: Step 1 (Validate Full Name + Email + Password + Consent, then send real OTP via Resend)
  const handleInitiateSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; email?: string; password?: string; terms?: string; general?: string } = {};

    const cleanName = name.trim();
    if (!cleanName) {
      newErrors.name = 'Please enter your full name.';
    } else if (cleanName.length < 2) {
      newErrors.name = 'Full name must be at least 2 characters.';
    }

    if (!email || !email.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!password || password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long.';
    }
    if (!agreedToTerms) {
      newErrors.terms = 'Please accept the Terms of Service and Privacy Policy to continue.';
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    setOtpPurpose('signup');
    try {
      const res = await sendEmailOtp(email.trim(), cleanName);
      setStep('verify-otp');
      setResendCooldown(60);
      showToast(res.message || 'Verification code sent to your email.', { duration: 7000 });
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to send verification code. Please check your email or try again.');
      setFieldErrors({ general: msg });
      showToast(msg, { duration: 7000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP Verification: works for both Instant Sign-In and New Sign-Up
  const handleVerifyOtpAndCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setFieldErrors({ otp: 'Please enter the 6-digit verification code.' });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      // 1. Verify OTP via server/client fallback
      await verifyEmailOtp(email.trim(), otpCode.trim());

      // If OTP was for signing in, we are already fully authenticated!
      if (otpPurpose === 'signin') {
        showToast('Signed in successfully! Welcome back.');
        handleAuthSuccess();
        return;
      }

      // 2. If Sign-Up, create/link Firebase account
      if (password && password.length >= 6) {
        try {
          await signup(email.trim(), password, name.trim());
        } catch (signupErr: any) {
          if (signupErr?.code === 'auth/email-already-in-use') {
            try {
              await login(email.trim(), password);
            } catch {
              // Non-blocking: user is already authenticated
            }
          }
        }
      }

      showToast('Account verified successfully! Welcome to Prople Store.');
      handleAuthSuccess();
    } catch (err: any) {
      console.warn('OTP verification notice:', err?.message);
      const msg = sanitizeErrorMessage(err, 'Invalid or expired verification code. Please check your inbox and try again.');
      setFieldErrors({ otp: msg });
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Resend OTP Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await sendEmailOtp(email.trim());
      setResendCooldown(60);
      showToast(res.message || 'New verification code sent to your email.');
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to resend verification code. Please try again.');
      setFieldErrors({ otp: msg });
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reset Password Submission
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanCode = resetCode.trim();

    if (!cleanCode || cleanCode.length < 6) {
      setFieldErrors({ resetCode: 'Please enter the 6-digit reset code.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setFieldErrors({ newPassword: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFieldErrors({ confirmNewPassword: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      await resetPasswordWithCode(cleanEmail, cleanCode, newPassword);
      showToast('Password reset successfully! You are now signed in.');
      handleAuthSuccess();
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to reset password. Please check the code and try again.');
      setFieldErrors({ general: msg });
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend Password Reset Code
  const handleResendResetCode = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await forgotPassword(email.trim());
      setResendCooldown(60);
      showToast(res.message || 'New password reset code sent to your email.');
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to resend reset code. Please try again.');
      setFieldErrors({ general: msg });
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      showToast('Signed in with Google successfully.');
      handleAuthSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in was not completed.';
      setFieldErrors({ general: msg });
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'reset-new-password') {
      setStep('reset-otp');
    } else if (step === 'reset-otp' || step === 'forgot-email' || step === 'verify-otp') {
      if (step === 'verify-otp' && otpPurpose === 'signin') {
        cancelPendingTwoFactor().catch(() => {});
      }
      setStep('form');
      setOtpCode('');
      setFieldErrors({});
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* External Browser Handoff Banner for Android Gmail & In-App WebViews */}
      {isInAppBrowser && (
        <div className="bg-blue-950/80 border-b border-blue-800/40 px-3.5 py-2 text-xs flex items-center justify-between gap-3 text-blue-200 shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate">Opened in email app. Open in your main browser for instant sync:</span>
          </div>
          <a
            href={`intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end;`}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded text-xs shrink-0 inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
          >
            Open in Browser &rarr;
          </a>
        </div>
      )}

      {/* Top Header matching standard Prople Store layout */}
      <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 bg-theme-bg shrink-0 gap-3 z-20 w-full border-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 -translate-x-[2px]">
          {onClose || step !== 'form' ? (
            <button 
              type="button"
              onClick={handleBack} 
              disabled={isSubmitting}
              className="w-9 h-9 -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
              title="Go back"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-theme-text" />
            </button>
          ) : (
            <div className="w-9 h-9 -ml-1" />
          )}
          <div className="flex flex-col min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-medium font-google-sans text-theme-text tracking-tight truncate leading-tight">
              {step === 'form' 
                ? (mode === 'signin' ? 'Sign in to Prople Store' : 'Create Prople Account')
                : step === 'verify-otp'
                ? 'Verify Email'
                : step === 'forgot-email'
                ? 'Forgot Password'
                : step === 'reset-otp'
                ? 'Verify Reset Code'
                : 'Set New Password'}
            </h1>
            <span className="text-xs text-theme-text-muted truncate leading-normal mt-0.5">
              Prople Store &bull; Account Access
            </span>
          </div>
        </div>
        <div className="flex-1"></div>
      </header>

      {/* Content Body - Expanded full-width responsive layout */}
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-y-auto w-full pb-safe outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <div className="w-full max-w-xl mx-auto px-3.5 sm:px-6 md:px-8 py-2 sm:py-4 space-y-6 pb-24">
          {/* Form Container without card background or border */}
          <div className="w-full py-2 space-y-6 text-left">
            <div className="flex flex-col items-center text-center">
              {/* Prople Logo */}
              <div className="mb-3 mt-1 flex items-center justify-center relative">
                <BrandLogo size="xl" showText={false} />
              </div>

              {step === 'form' && (
                <div className="w-full">
                  <h2 className="text-2xl sm:text-3xl font-bold font-google-sans text-theme-text mb-1 tracking-tight">
                    {mode === 'signin' ? 'Sign in to Prople Store' : 'Create a Prople Account'}
                  </h2>
                  <p className="text-[13px] sm:text-[14px] text-theme-text-muted mb-6 leading-relaxed max-w-md mx-auto">
                    {mode === 'signin' 
                      ? 'Access your apps, sync bookmarks, and manage developer releases.' 
                      : 'Join Prople Store to install apps, publish software, and write reviews.'}
                  </p>

                  {/* Mode Segmented Switcher (Sign In / Sign Up) */}
                  <div className="w-full flex items-center p-1 bg-theme-surface rounded-2xl border border-theme-border/80 mb-6">
                    <button
                      type="button"
                      id="auth-mode-signin-tab"
                      disabled={isSubmitting}
                      onClick={() => { setMode('signin'); setFieldErrors({}); }}
                      className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                        mode === 'signin'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-hover/40'
                      }`}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      id="auth-mode-signup-tab"
                      disabled={isSubmitting}
                      onClick={() => { setMode('signup'); setFieldErrors({}); }}
                      className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                        mode === 'signup'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-hover/40'
                      }`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Sign Up</span>
                    </button>
                  </div>

              {/* Sign In Form */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="w-full text-left space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-theme-text-muted mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        disabled={isSubmitting}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (fieldErrors.email || fieldErrors.general) {
                            setFieldErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                          }
                        }}
                        placeholder="you@example.com"
                        className={`w-full px-4 py-3 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                          fieldErrors.email
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-theme-text-muted">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPasswordClick}
                        disabled={isSubmitting}
                        className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        disabled={isSubmitting}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password || fieldErrors.general) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                          }
                        }}
                        placeholder="Enter your password"
                        className={`w-full px-4 py-3 pr-11 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                          fieldErrors.password
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text p-1 transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  {fieldErrors.general && (
                    <p className="text-xs text-red-500 font-medium text-center py-1 animate-fadeIn">
                      {fieldErrors.general}
                    </p>
                  )}

                  {/* Animated Sign In Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading || !email || !password}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {mode === 'signup' && (
                <form onSubmit={handleInitiateSignUp} className="w-full text-left space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-theme-text-muted">
                        Full Name
                      </label>
                      <span className="text-[11px] text-theme-text-muted">
                        {name.length}/50
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={50}
                        disabled={isSubmitting}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value.slice(0, 50));
                          if (fieldErrors.name || fieldErrors.general) {
                            setFieldErrors((prev) => ({ ...prev, name: undefined, general: undefined }));
                          }
                        }}
                        placeholder="Your full name"
                        className={`w-full px-4 py-3 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                          fieldErrors.name
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                    </div>
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.name}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-muted mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      disabled={isSubmitting}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email || fieldErrors.general) {
                          setFieldErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                        }
                      }}
                      placeholder="you@example.com"
                      className={`w-full px-4 py-3 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                        fieldErrors.email
                          ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-muted mb-1.5">
                      Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        disabled={isSubmitting}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password || fieldErrors.general) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                          }
                        }}
                        placeholder="Create a strong password"
                        className={`w-full px-4 py-3 pr-11 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                          fieldErrors.password
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text p-1 transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  {fieldErrors.general && (
                    <p className="text-xs text-red-500 font-medium text-center py-1 animate-fadeIn">
                      {fieldErrors.general}
                    </p>
                  )}

                  {/* Terms of Service and Privacy Policy Consent Checkbox */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none text-left">
                      <input
                        type="checkbox"
                        id="auth-signup-terms-checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          if (fieldErrors.terms || fieldErrors.general) {
                            setFieldErrors((prev) => ({ ...prev, terms: undefined, general: undefined }));
                          }
                        }}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                      />
                      <span className="text-xs text-theme-text-muted leading-tight">
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTermsModal(true);
                          }}
                          className="text-blue-500 hover:underline font-medium cursor-pointer"
                        >
                          Terms of Service
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPrivacyModal(true);
                          }}
                          className="text-blue-500 hover:underline font-medium cursor-pointer"
                        >
                          Privacy Policy
                        </button>
                      </span>
                    </label>
                    {fieldErrors.terms && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn text-left">
                        {fieldErrors.terms}
                      </p>
                    )}
                  </div>

                  {/* Continue Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading || !email || password.length < 6 || !agreedToTerms}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <span>Continue to Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Standard OR Divider */}
              <div className="w-full my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-theme-border" />
                <span className="text-xs text-theme-text-muted uppercase font-medium tracking-wider">or</span>
                <div className="flex-1 h-px bg-theme-border" />
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                id="auth-google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting || isLoading}
                className="w-full py-3.5 px-4 bg-white hover:bg-gray-50 active:bg-gray-200 text-gray-800 border border-gray-300/80 rounded-full text-sm font-semibold flex items-center justify-center gap-3 transition-all duration-200 shadow-xs cursor-pointer disabled:opacity-60 active:scale-[0.98]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* Dedicated Forgot Password - Email Input Step */}
          {step === 'forgot-email' && (
            <div className="w-full">
              <h1 className="text-2xl font-bold text-center text-theme-text mb-1 tracking-tight">
                Forgot your password?
              </h1>
              <p className="text-xs text-center text-theme-text-muted mb-5 leading-relaxed max-w-xs mx-auto">
                Enter your account email address. We'll send you a 6-digit verification code to reset your password.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendResetCode(email);
                }}
                className="w-full text-left space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email || fieldErrors.general) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                      }
                    }}
                    placeholder="you@example.com"
                    className={`w-full px-4 py-3 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                      fieldErrors.email
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {fieldErrors.general && (
                  <p className="text-xs text-red-500 font-medium text-center py-1 animate-fadeIn">
                    {fieldErrors.general}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || !email || !email.includes('@')}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span>Send Verification Code</span>
                </button>

                <div className="flex items-center justify-center text-xs pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setStep('form');
                      setFieldErrors({});
                    }}
                    className="text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer font-medium disabled:opacity-50"
                  >
                    &larr; Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* OTP Verification Screen (Sign Up & Two-Factor) */}
          {step === 'verify-otp' && (
            <div className="w-full text-center">
              <h1 className="text-2xl font-bold text-theme-text mb-2 tracking-tight">
                Enter Verification Code
              </h1>
              <p className="text-sm text-theme-text-muted mb-2 leading-relaxed max-w-sm mx-auto">
                Enter the 6-digit code sent to <span className="font-semibold text-theme-text">{email}</span>
              </p>
              <p className="text-xs text-theme-text-muted mb-5 max-w-sm mx-auto leading-relaxed">
                You can enter the 6-digit code below or tap the &ldquo;Verify Email&rdquo; button in your email to authenticate instantly.
              </p>

              <form onSubmit={handleVerifyOtpAndCreateAccount} className="w-full space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    disabled={isSubmitting}
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/[^0-9]/g, ''));
                      if (fieldErrors.otp || fieldErrors.general) {
                        setFieldErrors((prev) => ({ ...prev, otp: undefined, general: undefined }));
                      }
                    }}
                    placeholder="• • • • • •"
                    className={`w-full text-center tracking-[12px] text-2xl font-mono py-3.5 bg-theme-surface border rounded-xl text-theme-text focus:outline-none transition-all disabled:opacity-60 placeholder:tracking-[8px] ${
                      fieldErrors.otp
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  {fieldErrors.otp && (
                    <p className="mt-2 text-xs text-red-500 font-medium text-center animate-fadeIn">
                      {fieldErrors.otp}
                    </p>
                  )}
                  {fieldErrors.general && !fieldErrors.otp && (
                    <p className="mt-2 text-xs text-red-500 font-medium text-center animate-fadeIn">
                      {fieldErrors.general}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || otpCode.length < 6}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span>Verify Code</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (otpPurpose === 'signin') {
                        cancelPendingTwoFactor().catch(() => {});
                      }
                      setStep('form');
                      setOtpCode('');
                      setFieldErrors({});
                    }}
                    className="text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer font-medium disabled:opacity-50"
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="text-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors cursor-pointer font-medium flex items-center gap-1.5 active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Password Reset: OTP Input Step */}
          {step === 'reset-otp' && (
            <div className="w-full text-center">
              <h1 className="text-2xl font-bold text-theme-text mb-2 tracking-tight">
                Enter Verification Code
              </h1>
              <p className="text-sm text-theme-text-muted mb-2 leading-relaxed max-w-sm mx-auto">
                Enter the 6-digit code sent to <span className="font-semibold text-theme-text">{email}</span>
              </p>
              <p className="text-xs text-theme-text-muted mb-5 max-w-sm mx-auto leading-relaxed">
                You can enter the 6-digit code below or click the &ldquo;Reset Password&rdquo; link in your email.
              </p>

              <form onSubmit={handleVerifyResetOtp} className="w-full space-y-4">
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    disabled={isSubmitting}
                    value={resetCode}
                    onChange={(e) => {
                      setResetCode(e.target.value.replace(/[^0-9]/g, ''));
                      if (fieldErrors.resetCode || fieldErrors.general) {
                        setFieldErrors((prev) => ({ ...prev, resetCode: undefined, general: undefined }));
                      }
                    }}
                    placeholder="• • • • • •"
                    className={`w-full text-center tracking-[12px] text-2xl font-mono py-3.5 bg-theme-surface border rounded-xl text-theme-text focus:outline-none transition-all disabled:opacity-60 placeholder:tracking-[8px] ${
                      fieldErrors.resetCode
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  {fieldErrors.resetCode && (
                    <p className="mt-2 text-xs text-red-500 font-medium text-center animate-fadeIn">
                      {fieldErrors.resetCode}
                    </p>
                  )}
                  {fieldErrors.general && !fieldErrors.resetCode && (
                    <p className="mt-2 text-xs text-red-500 font-medium text-center animate-fadeIn">
                      {fieldErrors.general}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || resetCode.length < 6}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span>Verify Code</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => { setStep('form'); setResetCode(''); setFieldErrors({}); }}
                    className="text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer font-medium disabled:opacity-50"
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="text-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors cursor-pointer font-medium flex items-center gap-1.5 active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2 of Password Reset: Set New Password & Confirm */}
          {step === 'reset-new-password' && (
            <div className="w-full">
              <h1 className="text-2xl font-bold text-center text-theme-text mb-1 tracking-tight">
                Set new password
              </h1>
              <p className="text-xs text-center text-theme-text-muted mb-4 leading-relaxed max-w-xs mx-auto">
                Choose a new password for <span className="font-semibold text-theme-text">{email}</span>.
              </p>

              <form onSubmit={handleResetPasswordSubmit} className="w-full text-left space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted mb-1.5">
                    New password (min. 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      disabled={isSubmitting}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (fieldErrors.newPassword || fieldErrors.general) {
                          setFieldErrors((prev) => ({ ...prev, newPassword: undefined, general: undefined }));
                        }
                      }}
                      placeholder="Enter new password"
                      className={`w-full px-4 py-3 pr-11 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                        fieldErrors.newPassword
                          ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text p-1 transition-colors cursor-pointer"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.newPassword && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                      {fieldErrors.newPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value);
                      if (fieldErrors.confirmNewPassword || fieldErrors.general) {
                        setFieldErrors((prev) => ({ ...prev, confirmNewPassword: undefined, general: undefined }));
                      }
                    }}
                    placeholder="Repeat new password"
                    className={`w-full px-4 py-3 bg-theme-surface border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                      fieldErrors.confirmNewPassword
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-theme-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  {fieldErrors.confirmNewPassword && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium animate-fadeIn">
                      {fieldErrors.confirmNewPassword}
                    </p>
                  )}
                </div>

                {fieldErrors.general && (
                  <p className="text-xs text-red-500 font-medium text-center py-1 animate-fadeIn">
                    {fieldErrors.general}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || newPassword.length < 6 || confirmNewPassword.length < 6}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span>Update Password &amp; Sign In</span>
                </button>

                <div className="flex items-center justify-center text-xs pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => { setStep('form'); setResetCode(''); setNewPassword(''); setConfirmNewPassword(''); setFieldErrors({}); }}
                    className="text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer font-medium disabled:opacity-50"
                  >
                    &larr; Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}
            </div>
          </div>

          {/* Footer info below card */}
          <div className="text-center text-xs text-theme-text-muted pt-2 space-y-1">
            <div className="flex items-center justify-center text-[12px] text-theme-text-muted/80 mb-1">
              <span>Protected by Prople Protect security inspection</span>
            </div>
            <p className="text-[12px] text-theme-text-muted/70">
              By continuing, you agree to Prople Store{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-blue-500 hover:underline cursor-pointer"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-blue-500 hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>.
            </p>
          </div>
        </div>
      </div>

      {/* Pure, borderless, containerless fade dark full-screen loading overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-0 transition-opacity duration-200 animate-in fade-in select-none">
          <StoreCircleLoader size="lg" strokeWidth={2.6} fast minHeightClass="min-h-0" />
        </div>
      )}

      {/* Terms of Service Reader Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[70]">
          <TermsPage
            onBack={() => setShowTermsModal(false)}
            onOpenPrivacy={() => {
              setShowTermsModal(false);
              setShowPrivacyModal(true);
            }}
          />
        </div>
      )}

      {/* Privacy Policy Reader Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[70]">
          <PrivacyPolicyPage
            onBack={() => setShowPrivacyModal(false)}
            onOpenTerms={() => {
              setShowPrivacyModal(false);
              setShowTermsModal(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
