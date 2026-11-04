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

interface SplitOtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

function SplitOtpInput({ value, onChange, onComplete, disabled, hasError, autoFocus }: SplitOtpInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const cleanDigits = (value || '').slice(0, 6);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    onChange(digits);
    if (digits.length === 6) {
      onComplete?.(digits);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain') || '';
    const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (digits) {
      onChange(digits);
      if (digits.length === 6) {
        onComplete?.(digits);
      }
    }
  };

  const handleContainerFocus = () => {
    if (disabled) return;
    if (inputRef.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
        const len = cleanDigits.length;
        inputRef.current.setSelectionRange(len, len);
      } catch {
        inputRef.current.focus();
      }
    }
    setIsFocused(true);
  };

  // Safe initial focus without scrolling the page or jumping layout
  useEffect(() => {
    if (autoFocus && !disabled) {
      const timer = setTimeout(() => {
        try {
          inputRef.current?.focus({ preventScroll: true });
        } catch {
          inputRef.current?.focus();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  return (
    <div
      onClick={handleContainerFocus}
      onPaste={handlePaste}
      className="relative w-full max-w-[340px] mx-auto my-3 cursor-pointer select-none bg-transparent"
    >
      {/* 6 Visual Split Boxes with sharp edges and transparent background */}
      <div className="flex items-center justify-between gap-2 sm:gap-2.5 w-full bg-transparent">
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const char = cleanDigits[index] || '';
          const isCurrent = isFocused && index === Math.min(cleanDigits.length, 5);
          const isFilled = Boolean(char);

          return (
            <div
              key={index}
              className={`relative flex-1 h-12 sm:h-14 max-w-[48px] flex items-center justify-center rounded-[4px] text-xl sm:text-2xl font-bold font-mono transition-colors duration-150 bg-transparent ${
                hasError
                  ? 'border-2 border-red-500 text-red-500'
                  : isCurrent
                  ? 'border-2 border-[#1a73e8] text-theme-text ring-1 ring-[#1a73e8]/30'
                  : isFilled
                  ? 'border border-gray-400 dark:border-neutral-600 text-theme-text'
                  : 'border border-gray-300 dark:border-neutral-700 text-theme-text'
              }`}
            >
              {char ? (
                <span className="select-none leading-none">{char}</span>
              ) : isCurrent ? (
                <span className="w-[2px] h-5 sm:h-6 bg-[#1a73e8] animate-pulse rounded-xs" />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Hidden single input capturing typing, paste and SMS autofill
          Using pointer-events-none, caret-transparent, and center positioning
          so Android never displays the blue cursor teardrop/dot handle or causes layout shifts */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        disabled={disabled}
        value={cleanDigits}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 opacity-0 pointer-events-none text-transparent bg-transparent border-0 outline-none caret-transparent select-none"
        style={{
          caretColor: 'transparent',
          color: 'transparent',
        }}
        aria-label="6-digit verification code"
      />
    </div>
  );
}

interface AuthPageProps {
  onClose?: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthPage({ onClose, onSuccess, initialMode = 'signin' }: AuthPageProps) {
  const { 
    user,
    login, 
    verifyPasswordStep,
    cancelPendingTwoFactor,
    signup, 
    loginWithGoogle, 
    loginWithGithub,
    sendEmailOtp, 
    verifyEmailOtp, 
    forgotPassword, 
    resetPasswordWithCode, 
    completeExternalAuth, 
    updateUserProfile,
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
    try {
      resetToHome?.();
    } catch {}
    if (onSuccess) {
      onSuccess();
    } else if (onClose) {
      onClose();
    }
  };

  // Immediate redirect to home page when user is authenticated
  useEffect(() => {
    if (user) {
      try {
        resetToHome?.();
      } catch {}
      if (onSuccess) {
        onSuccess();
      } else if (onClose) {
        onClose();
      }
    }
  }, [user]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  usePreserveScroll(`auth-${mode}-${step}`, scrollRef);

  // Form Fields
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
  const [challengeToken, setChallengeToken] = useState<string>('');

  // Remember me preference
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem('prople_remember_me') !== 'false';
    } catch {
      return true;
    }
  });

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    try {
      localStorage.setItem('prople_remember_me', checked ? 'true' : 'false');
    } catch {}
  };

  // Check URL query parameters on mount (direct 1-click password reset or email verification links)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const authParam = searchParams.get('auth');
      const actionParam = searchParams.get('action');
      const modeParam = searchParams.get('mode');
      const emailParam = searchParams.get('email');
      const codeParam = searchParams.get('code') || searchParams.get('oobCode');
      const tokenParam = searchParams.get('token') || searchParams.get('challengeToken');

      if (tokenParam) {
        setChallengeToken(tokenParam);
        if (emailParam) {
          try {
            sessionStorage.setItem('prople_challenge_token_' + decodeURIComponent(emailParam).toLowerCase().trim(), tokenParam);
          } catch {}
        }
      }

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
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      newErrors.email = 'Please enter your email or username.';
    } else if (!cleanEmail.includes('@') && cleanEmail.includes(' ')) {
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
      await login(cleanEmail, password);
      showToast('Signed in successfully! Welcome back.');
      handleAuthSuccess();
    } catch (err: any) {
      console.warn('Sign-in notice:', err?.code || err?.message);
      if (err?.code === 'auth/ip-locked' || err?.code === 'auth/too-many-requests') {
        const msg = err.message || 'Access temporarily restricted due to security limits. Please try again later.';
        showToast(msg);
      } else if (err?.code === 'auth/user-not-found') {
        const msg = 'No account found with this email. Please check your email or sign up.';
        setFieldErrors({ email: msg });
        showToast(msg);
      } else if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        const msg = 'Incorrect password. Click "Forgot Password?" to reset.';
        setFieldErrors({ password: msg });
        showToast(msg);
      } else if (err?.code === 'auth/invalid-email') {
        const msg = 'The email address is improperly formatted.';
        setFieldErrors({ email: msg });
        showToast(msg);
      } else {
        const msg = sanitizeErrorMessage(err, 'Unable to sign in. Please verify your credentials and try again.');
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
      if (res?.challengeToken) {
        setChallengeToken(res.challengeToken);
      }
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

  // Validate OTP in step 1 of password reset against backend before transitioning to step 2 (Set new password)
  const handleVerifyResetOtp = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    const cleanCode = (overrideCode || resetCode || '').trim();
    if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
      setFieldErrors({ resetCode: 'Please enter the 6-digit verification code.' });
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const activeToken =
        challengeToken ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem('prople_challenge_token_' + cleanEmail) || ''
          : '');

      const { ok, data, error } = await safeFetchJson<{
        success: boolean;
        challengeToken?: string;
        error?: string;
      }>('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'x-challenge-token': activeToken } : {}),
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          challengeToken: activeToken || undefined,
        }),
      });

      if (!ok || !data?.success) {
        const msg = sanitizeErrorMessage(
          data?.error || error,
          'Incorrect verification code. Please check your email and enter the latest 6 digits.'
        );
        setFieldErrors({ resetCode: msg });
        showToast(msg);
        return;
      }

      if (data?.challengeToken) {
        setChallengeToken(data.challengeToken);
        try {
          sessionStorage.setItem('prople_challenge_token_' + cleanEmail, data.challengeToken);
        } catch {}
      }

      setStep('reset-new-password');
    } catch (err: any) {
      const msg = sanitizeErrorMessage(
        err,
        'Incorrect verification code. Please check your email and enter the latest 6 digits.'
      );
      setFieldErrors({ resetCode: msg });
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sign Up: Step 1 (Validate Optional Publisher/Display Name availability + Email + Password + Consent, then send real OTP via Resend)
  const handleInitiateSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string; terms?: string; general?: string } = {};

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
      const res = await sendEmailOtp(email.trim());
      if (res?.challengeToken) {
        setChallengeToken(res.challengeToken);
      }
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
  const handleVerifyOtpAndCreateAccount = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    const codeToVerify = (overrideCode || otpCode || '').trim();
    if (!codeToVerify || codeToVerify.length < 6) {
      setFieldErrors({ otp: 'Please enter the 6-digit verification code.' });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      // 1. Verify OTP via server/client fallback
      await verifyEmailOtp(email.trim(), codeToVerify);

      // If OTP was for signing in, we are already fully authenticated!
      if (otpPurpose === 'signin') {
        showToast('Signed in successfully! Welcome back.');
        handleAuthSuccess();
        return;
      }

      // 2. If Sign-Up, create/link Firebase account
      if (password && password.length >= 6) {
        try {
          await signup(email.trim(), password, '');
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
      if (res?.challengeToken) {
        setChallengeToken(res.challengeToken);
      }
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
      if (res?.challengeToken) {
        setChallengeToken(res.challengeToken);
      }
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
      const msg = sanitizeErrorMessage(err, 'Google sign-in was not completed. Please try again.');
      showToast(msg, { duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle GitHub Sign In (replaces Facebook as requested)
  const handleGithubSignIn = async () => {
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await loginWithGithub();
      showToast('Signed in with GitHub successfully!');
      handleAuthSuccess();
    } catch (err: any) {
      const msg = sanitizeErrorMessage(
        err,
        'GitHub sign-in was not completed. Please try again.'
      );
      showToast(msg, { duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend Activation Email / Instant verification code
  const handleResendActivationEmail = async () => {
    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      const msg = 'Please enter your email address in the form above first.';
      setFieldErrors((prev) => ({ ...prev, email: msg }));
      showToast(msg);
      return;
    }
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await sendEmailOtp(targetEmail);
      if (res?.challengeToken) {
        setChallengeToken(res.challengeToken);
      }
      setStep('verify-otp');
      setOtpPurpose('signin');
      setResendCooldown(60);
      showToast(
        res?.message || 'Activation / verification email sent to your inbox.',
        { duration: 7000 }
      );
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, 'Failed to send activation email. Please try again.');
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

      {/* Content Body - Natural unboxed responsive layout */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto w-full pb-safe outline-none focus:outline-none overscroll-y-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <div className="w-full max-w-[420px] mx-auto px-5 sm:px-6 pt-4 pb-20 space-y-6">
          {/* Brand Logo centered */}
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <BrandLogo size="lg" showText={true} />
          </div>

          {step === 'form' && (
            <div className="w-full">
              {/* Title & Subtitle matching user screenshot */}
              <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-snug mb-1.5">
                  {mode === 'signin'
                    ? 'Please sign in to your account'
                    : 'Create your new account'}
                </h2>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-neutral-400">
                  {mode === 'signin' ? (
                    <>
                      <span>Don't have an account?{' '}</span>
                      <button
                        type="button"
                        onClick={() => { setMode('signup'); setFieldErrors({}); }}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                      >
                        Register here
                      </button>
                    </>
                  ) : (
                    <>
                      <span>Already have an account?{' '}</span>
                      <button
                        type="button"
                        onClick={() => { setMode('signin'); setFieldErrors({}); }}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                      >
                        Sign in here
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Sign In Form */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="w-full text-left space-y-3.5">
                  <div>
                    <input
                      type="text"
                      required
                      disabled={isSubmitting}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email || fieldErrors.general) {
                          setFieldErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                        }
                      }}
                      placeholder="E-mail / Username / Phone Number"
                      className={`w-full px-3.5 py-3 rounded-[4px] border bg-white dark:bg-[#151619] text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 transition-colors focus:outline-none disabled:opacity-60 ${
                        fieldErrors.email
                          ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.email}</span>
                      </p>
                    )}
                  </div>

                  <div>
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
                        placeholder="Password"
                        className={`w-full px-3.5 py-3 pr-11 rounded-[4px] border bg-white dark:bg-[#151619] text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 transition-colors focus:outline-none disabled:opacity-60 ${
                          fieldErrors.password
                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200 p-1 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.password}</span>
                      </p>
                    )}
                  </div>

                  {/* Remember me & Forgot Password */}
                  <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => handleRememberMeChange(e.target.checked)}
                        className="w-4 h-4 rounded-[3px] border-gray-300 dark:border-neutral-700 text-[#1a73e8] focus:ring-[#1a73e8] accent-[#1a73e8] cursor-pointer"
                      />
                      <span className="text-gray-700 dark:text-neutral-300">
                        Remember me
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPasswordClick}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Primary Blue Login Button with sharp edges */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading || !email || !password}
                    className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-50 text-white font-bold rounded-[4px] text-base transition-all duration-150 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    Login
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {mode === 'signup' && (
                <form onSubmit={handleInitiateSignUp} className="w-full text-left space-y-3.5">
                  <div>
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
                      placeholder="E-mail address"
                      className={`w-full px-3.5 py-3 rounded-[4px] border bg-white dark:bg-[#151619] text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 transition-colors focus:outline-none disabled:opacity-60 ${
                        fieldErrors.email
                          ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.email}</span>
                      </p>
                    )}
                  </div>

                  <div>
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
                        placeholder="Password (min. 6 characters)"
                        className={`w-full px-3.5 py-3 pr-11 rounded-[4px] border bg-white dark:bg-[#151619] text-sm text-gray-900 dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 transition-colors focus:outline-none disabled:opacity-60 ${
                          fieldErrors.password
                            ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200 p-1 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.password}</span>
                      </p>
                    )}
                  </div>

                  {/* Terms and Privacy Policy Checkbox */}
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
                        className="mt-0.5 w-4 h-4 rounded-[3px] border-gray-300 dark:border-neutral-700 text-[#1a73e8] focus:ring-[#1a73e8] cursor-pointer accent-[#1a73e8] shrink-0"
                      />
                      <span className="text-xs text-gray-600 dark:text-neutral-400 leading-tight">
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTermsModal(true);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
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
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          Privacy Policy
                        </button>
                      </span>
                    </label>
                    {fieldErrors.terms && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-fadeIn text-left">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.terms}</span>
                      </p>
                    )}
                  </div>

                  {/* Primary Blue Register Button with sharp edges */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading || !email || password.length < 6 || !agreedToTerms}
                    className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-50 text-white font-bold rounded-[4px] text-base transition-all duration-150 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    Create Account
                  </button>
                </form>
              )}

              {/* Standard OR Divider */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-neutral-800" />
                </div>
                <span className="relative bg-theme-bg px-4 text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                  OR
                </span>
              </div>

              {/* Social Buttons Container - Sharp edged matching the reference screenshot */}
              <div className="space-y-3">
                {/* GitHub Login Button */}
                <button
                  type="button"
                  id="auth-github-signin-btn"
                  onClick={handleGithubSignIn}
                  disabled={isSubmitting || isLoading}
                  className="w-full py-3 px-4 bg-[#f8f9fa] dark:bg-neutral-800/80 hover:bg-[#f1f3f5] dark:hover:bg-neutral-700/80 text-gray-800 dark:text-neutral-100 border border-gray-300 dark:border-neutral-700 rounded-[4px] text-sm font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <svg className="w-5 h-5 shrink-0 text-[#24292f] dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span>Login with GitHub</span>
                </button>

                {/* Google Login Button */}
                <button
                  type="button"
                  id="auth-google-signin-btn"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting || isLoading}
                  className="w-full py-3 px-4 bg-[#f8f9fa] dark:bg-neutral-800/80 hover:bg-[#f1f3f5] dark:hover:bg-neutral-700/80 text-gray-800 dark:text-neutral-100 border border-gray-300 dark:border-neutral-700 rounded-[4px] text-sm font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Login with Google</span>
                </button>
              </div>

              {/* Bottom Footer Links (Matching Screenshot) */}
              <div className="mt-8 pt-4 border-t border-gray-200 dark:border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-700 dark:text-neutral-300">
                <div>
                  {mode === 'signin' ? (
                    <>
                      <span>Don't have an account?{' '}</span>
                      <button
                        type="button"
                        onClick={() => { setMode('signup'); setFieldErrors({}); }}
                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        Sign up now
                      </button>
                    </>
                  ) : (
                    <>
                      <span>Already have an account?{' '}</span>
                      <button
                        type="button"
                        onClick={() => { setMode('signin'); setFieldErrors({}); }}
                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        Sign in now
                      </button>
                    </>
                  )}
                </div>
                {mode === 'signin' && (
                  <div>
                    <span>User not active?{' '}</span>
                    <button
                      type="button"
                      onClick={handleResendActivationEmail}
                      className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                    >
                      Resend activation email
                    </button>
                  </div>
                )}
              </div>
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
                  <div className="flex items-center justify-between mb-1.5 min-h-[18px]">
                    <label className="block text-xs font-semibold text-theme-text-muted">
                      Email address
                    </label>
                    {fieldErrors.email && (
                      <span className="text-[11px] text-rose-500 font-medium truncate max-w-[240px] text-right flex items-center gap-1 animate-fadeIn">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{fieldErrors.email}</span>
                      </span>
                    )}
                  </div>
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
                    className={`w-full px-4 py-3 bg-white dark:bg-[#151619] border rounded-[4px] text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                      fieldErrors.email
                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || !email || !email.includes('@')}
                  className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-50 text-white rounded-[4px] text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-sm disabled:cursor-not-allowed"
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
                You can enter the 6-digit code below or tap the &quot;Verify Email&quot; button in your email to authenticate instantly.
              </p>

              <form onSubmit={handleVerifyOtpAndCreateAccount} className="w-full space-y-4">
                <div>
                  <SplitOtpInput
                    value={otpCode}
                    onChange={(val) => {
                      setOtpCode(val);
                      if (fieldErrors.otp || fieldErrors.general) {
                        setFieldErrors((prev) => ({ ...prev, otp: undefined, general: undefined }));
                      }
                    }}
                    onComplete={(val) => {
                      if (!isSubmitting) {
                        handleVerifyOtpAndCreateAccount(undefined, val);
                      }
                    }}
                    disabled={isSubmitting}
                    hasError={Boolean(fieldErrors.otp || fieldErrors.general)}
                    autoFocus
                  />
                  <div className="h-6 mt-1 flex items-center justify-center">
                    {(fieldErrors.otp || fieldErrors.general) ? (
                      <p className="text-xs text-red-500 font-medium text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.otp || fieldErrors.general}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || otpCode.length < 6}
                  className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-50 text-white rounded-[4px] text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-sm disabled:cursor-not-allowed"
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
                  <SplitOtpInput
                    value={resetCode}
                    onChange={(val) => {
                      setResetCode(val);
                      if (fieldErrors.resetCode || fieldErrors.general) {
                        setFieldErrors((prev) => ({ ...prev, resetCode: undefined, general: undefined }));
                      }
                    }}
                    onComplete={(val) => {
                      if (!isSubmitting) {
                        handleVerifyResetOtp(undefined, val);
                      }
                    }}
                    disabled={isSubmitting}
                    hasError={Boolean(fieldErrors.resetCode || fieldErrors.general)}
                    autoFocus
                  />
                  <div className="h-6 mt-1 flex items-center justify-center">
                    {(fieldErrors.resetCode || fieldErrors.general) ? (
                      <p className="text-xs text-red-500 font-medium text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.resetCode || fieldErrors.general}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || resetCode.length < 6}
                  className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-50 text-white rounded-[4px] text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-sm disabled:cursor-not-allowed"
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
                  <div className="flex items-center justify-between mb-1.5 min-h-[18px]">
                    <label className="block text-xs font-semibold text-theme-text-muted">
                      New password (min. 6 characters)
                    </label>
                    {fieldErrors.newPassword && (
                      <span className="text-[11px] text-rose-500 font-medium truncate max-w-[220px] text-right flex items-center gap-1 animate-fadeIn">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{fieldErrors.newPassword}</span>
                      </span>
                    )}
                  </div>
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
                      className={`w-full px-4 py-3 pr-11 bg-white dark:bg-[#151619] border rounded-[4px] text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                        fieldErrors.newPassword
                          ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
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
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 min-h-[18px]">
                    <label className="block text-xs font-semibold text-theme-text-muted">
                      Confirm new password
                    </label>
                    {fieldErrors.confirmNewPassword && (
                      <span className="text-[11px] text-rose-500 font-medium truncate max-w-[220px] text-right flex items-center gap-1 animate-fadeIn">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{fieldErrors.confirmNewPassword}</span>
                      </span>
                    )}
                  </div>
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
                    className={`w-full px-4 py-3 bg-white dark:bg-[#151619] border rounded-[4px] text-sm text-theme-text placeholder-theme-text-muted/60 focus:outline-none transition-all disabled:opacity-60 ${
                      fieldErrors.confirmNewPassword
                        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-gray-300 dark:border-neutral-700 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || newPassword.length < 6 || confirmNewPassword.length < 6}
                  className="w-full py-3 px-4 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] disabled:opacity-50 text-white rounded-[4px] text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                >
                  <span>Update Password & Sign In</span>
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
