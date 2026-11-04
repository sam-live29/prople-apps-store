import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ChevronDown, Check, AlertCircle, Loader2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useToast } from '../context/ToastContext';
import { auth } from '../firebase';
import ConfirmationDialog from './ConfirmationDialog';
import StoreCircleLoader from './StoreCircleLoader';
import { 
  usePublisherNameValidation, 
  checkPublisherNameAvailability, 
  claimPublisherName,
  getNameChangeStatus,
  recordNameChangeTimestamps,
  getPreservedClaimedName,
  setPreservedClaimedName,
  getOrCreateGuestUid
} from '../services/publisherNameService';
import { usePreserveScroll } from '../services/scrollManager';
import VerifiedBadge from './VerifiedBadge';
import { AdminModerationService } from '../services/adminModerationService';

export default function EditProfilePage({ onBack }: { onBack: () => void }) {
  const { 
    user, 
    firebaseUser, 
    isLoading: isAuthLoading, 
    updateUserProfile,
    linkGoogleAccount,
    linkGithubAccount,
    unlinkAccountProvider
  } = useAuth();
  const { appsList } = useStoreConfig();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLinking, setIsLinking] = useState<string | null>(null);

  usePreserveScroll('edit-profile', containerRef);

  // Publisher name takes highest priority; falls back to preserved claimed name across guest/logout sessions
  const preservedName = getPreservedClaimedName();
  const currentActiveName = (user?.publisherName || user?.displayName || preservedName || '').trim();
  const [displayName, setDisplayName] = useState(currentActiveName);
  const [age, setAge] = useState(user?.age || '25');
  const [gender, setGender] = useState(user?.gender || 'Prefer not to say');
  const [location, setLocation] = useState(user?.location || 'Global');
  const [bio, setBio] = useState(user?.bio || '');

  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Status for 30-minute back-to-back edit window & 15-day waiting period
  const nameChangeStatus = getNameChangeStatus(user);
  const isNameChanged = displayName.trim().toLowerCase() !== currentActiveName.trim().toLowerCase();
  const isNameLocked = !nameChangeStatus.canChange;

  const isUserVerifiedPublisher = Boolean(
    user?.isVerifiedPublisher ||
    (user?.publisherName && AdminModerationService.isPublisherVerified(user.publisherName)) ||
    (user?.displayName && AdminModerationService.isPublisherVerified(user.displayName)) ||
    AdminModerationService.isPublisherVerified(currentActiveName)
  );

  // Real-time publisher name uniqueness validator
  const nameValidation = usePublisherNameValidation(displayName, {
    currentUserId: user?.uid,
    currentUserEmail: user?.email,
    currentUserName: currentActiveName,
    allApps: appsList,
    debounceMs: 250
  });

  // Store initial values to detect unsaved changes
  const initialValues = useRef({
    displayName: currentActiveName,
    bio: user?.bio || '',
    age: user?.age || '25',
    gender: user?.gender || 'Prefer not to say',
    location: user?.location || 'Global',
  });

  const isDirty = 
    displayName.trim() !== initialValues.current.displayName.trim() ||
    bio.trim() !== initialValues.current.bio.trim() ||
    age !== initialValues.current.age ||
    gender !== initialValues.current.gender ||
    location.trim() !== initialValues.current.location.trim();

  // Keep form fields synced if user profile finishes loading or updates externally before user starts typing
  useEffect(() => {
    if (!user || isDirty || isSaving) return;
    const latestName = (user.publisherName || user.displayName || '').trim();
    if (latestName !== initialValues.current.displayName) {
      setDisplayName(latestName);
      initialValues.current.displayName = latestName;
    }
    if ((user.bio || '') !== initialValues.current.bio) {
      setBio(user.bio || '');
      initialValues.current.bio = user.bio || '';
    }
    if ((user.age || '25') !== initialValues.current.age) {
      setAge(user.age || '25');
      initialValues.current.age = user.age || '25';
    }
    if ((user.gender || 'Prefer not to say') !== initialValues.current.gender) {
      setGender(user.gender || 'Prefer not to say');
      initialValues.current.gender = user.gender || 'Prefer not to say';
    }
    if ((user.location || 'Global') !== initialValues.current.location) {
      setLocation(user.location || 'Global');
      initialValues.current.location = user.location || 'Global';
    }
  }, [user?.publisherName, user?.displayName, user?.bio, user?.age, user?.gender, user?.location, user?.email, isDirty, isSaving]);

  const handleBackAttempt = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onBack();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          target.blur();
          return;
        }
        if (showDiscardDialog) {
          setShowDiscardDialog(false);
        } else {
          handleBackAttempt();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, showDiscardDialog]);

  const isGoogleLinked = Boolean(firebaseUser?.providerData?.some(p => p.providerId === 'google.com'));
  const isGithubLinked = Boolean(firebaseUser?.providerData?.some(p => p.providerId === 'github.com'));
  const hasMultipleProviders = (firebaseUser?.providerData?.length || 0) > 1;

  const handleLinkGoogle = async () => {
    try {
      setIsLinking('google.com');
      await linkGoogleAccount();
      showToast('Google account connected and unified successfully!');
    } catch (err: any) {
      if (err?.code === 'auth/credential-already-in-use') {
        showToast('This Google account is already linked to another profile.');
      } else {
        showToast(err?.message || 'Failed to connect Google account.');
      }
    } finally {
      setIsLinking(null);
    }
  };

  const handleLinkGithub = async () => {
    try {
      setIsLinking('github.com');
      await linkGithubAccount();
      showToast('GitHub account connected and unified successfully!');
    } catch (err: any) {
      if (err?.code === 'auth/credential-already-in-use') {
        showToast('This GitHub account is already linked to another profile.');
      } else {
        showToast(err?.message || 'Failed to connect GitHub account.');
      }
    } finally {
      setIsLinking(null);
    }
  };

  const handleUnlink = async (providerId: string, name: string) => {
    try {
      setIsLinking(providerId);
      await unlinkAccountProvider(providerId);
      showToast(`${name} disconnected.`);
    } catch (err: any) {
      showToast(err?.message || `Failed to disconnect ${name}.`);
    } finally {
      setIsLinking(null);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      showToast('Please enter a display name / publisher name.');
      return;
    }

    if (cleanName.length < 2) {
      showToast('Publisher name must be at least 2 characters.');
      return;
    }

    // Verify 15-day cooldown policy if user is attempting to change their publisher name
    if (isNameChanged) {
      if (!nameChangeStatus.canChange) {
        showToast(nameChangeStatus.statusMessage || 'Name changes are restricted during the 15-day waiting period.', { type: 'error' });
        return;
      }

      // Final authoritative uniqueness verification before persisting
      setIsSaving(true);
      try {
        const check = await checkPublisherNameAvailability(cleanName, {
          currentUserId: user?.uid,
          currentUserEmail: user?.email,
          currentUserName: currentActiveName,
          allApps: appsList
        });
        if (!check.available || check.isTaken) {
          showToast(check.message || 'This publisher name is already taken. Please choose a unique name.', { type: 'error' });
          setIsSaving(false);
          return;
        }
      } catch (checkErr) {
        console.warn('Uniqueness check error:', checkErr);
      }
    }

    setIsSaving(true);
    try {
      let updatedTimestamps = {
        lastNameChangedAt: user?.lastNameChangedAt ? new Date(user.lastNameChangedAt).getTime() : undefined,
        nameChangeSessionStartedAt: user?.nameChangeSessionStartedAt ? new Date(user.nameChangeSessionStartedAt).getTime() : undefined
      };

      if (isNameChanged) {
        const calculated = recordNameChangeTimestamps(user);
        updatedTimestamps = {
          lastNameChangedAt: calculated.lastNameChangedAt,
          nameChangeSessionStartedAt: calculated.nameChangeSessionStartedAt
        };

        const effectiveUid = user?.uid || auth.currentUser?.uid || getOrCreateGuestUid();
        const effectiveEmail = user?.email || auth.currentUser?.email || '';
        const claimRes = await claimPublisherName(cleanName, effectiveUid, effectiveEmail, calculated, false, currentActiveName);
        if (!claimRes.success) {
          showToast(claimRes.message || 'Failed to update publisher name.', { type: 'error' });
          setIsSaving(false);
          return;
        }
        setPreservedClaimedName(cleanName);
      }

      await updateUserProfile({
        displayName: cleanName,
        publisherName: cleanName,
        age,
        gender,
        location: location.trim() || 'Global',
        bio: bio.trim(),
        lastNameChangedAt: updatedTimestamps.lastNameChangedAt,
        nameChangeSessionStartedAt: updatedTimestamps.nameChangeSessionStartedAt
      });

      initialValues.current = {
        displayName: cleanName,
        bio: bio.trim(),
        age,
        gender,
        location: location.trim() || 'Global',
      };

      if (isNameChanged) {
        showToast('Publisher name updated across all your releases! You have 30 minutes for any quick adjustments.');
      } else {
        showToast('Profile updated successfully');
      }

      // Return back to previous page after all profile & release updates settle
      onBack();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const initialLetter = (displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-theme-bg text-theme-text w-full flex flex-col h-full overflow-y-auto scrollbar-hide pb-24 shadow-none">
      {/* Sticky Header - No separation line */}
      <header className="sticky top-0 bg-theme-bg/95 backdrop-blur-md z-30 flex items-center justify-between px-2.5 sm:px-4 md:px-6 h-[68px] shrink-0 border-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button 
            type="button"
            onClick={handleBackAttempt} 
            className="w-9 h-9 flex items-center justify-center -ml-1 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer" 
            aria-label="Back"
            title="Go back to settings"
          >
            <ArrowLeft className="w-5 h-5 text-theme-text" />
          </button>
          <h1 className="text-[17px] sm:text-[19px] font-medium text-theme-text tracking-tight truncate">
            Edit Profile
          </h1>
        </div>
      </header>

      {isAuthLoading && !user ? (
        <div className="flex-1 flex items-center justify-center min-h-[50vh] w-full">
          <StoreCircleLoader size="md" />
        </div>
      ) : (
      /* Main Container */
      <div className="w-full max-w-2xl mx-auto px-2.5 sm:px-4 md:px-6 py-5 space-y-6">
        {/* Google Style User Name Starting Letter Profile Picture (Non-changeable) */}
        <div className="flex flex-col items-center justify-center text-center space-y-2.5 pt-1">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold select-none shadow-md">
            {initialLetter}
          </div>
          <p className="text-xs text-theme-text-muted">
            Profile photo is automatically generated from your name
          </p>
        </div>

        {/* Profile Form */}
        <form 
          onSubmit={handleSave} 
          className="w-full space-y-6 text-left"
        >
          {/* Display Name / Publisher Name with Inline Uniqueness Error & 15-Day Policy */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium font-google-sans text-theme-text tracking-tight flex items-center gap-1.5 flex-wrap">
                <span>Publisher / Display Name</span>
                {isUserVerifiedPublisher && <VerifiedBadge size="sm" />}
                <span className="text-red-500">*</span>
                {isNameLocked && (
                  <span className="text-[11px] font-medium text-amber-400/90">
                    (Locked)
                  </span>
                )}
              </label>
              <span className="text-xs text-theme-text-muted">
                {displayName.length}/50
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={50}
                disabled={isNameLocked || isSaving}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                placeholder="Enter your unique publisher name"
                className={`w-full border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/50 px-3.5 py-2.5 ${isNameLocked ? 'pr-3.5' : 'pr-10'} focus:outline-none transition-all ${
                  isNameLocked 
                    ? 'bg-theme-hover/20 border-theme-border/40 text-theme-text/75 cursor-not-allowed'
                    : nameValidation.isTaken || nameValidation.errorMessage
                    ? 'bg-theme-hover/40 border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                    : nameValidation.successMessage
                    ? 'bg-theme-hover/40 border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                    : 'bg-theme-hover/40 border-theme-border/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {isNameLocked ? null : nameValidation.isChecking ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                ) : nameValidation.isTaken || nameValidation.errorMessage ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : nameValidation.successMessage ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : null}
              </div>
            </div>

            {/* Waiting Period Alert, Grace Period Notice, or Real-time Status */}
            {isNameLocked ? (
              <div className="space-y-1 pt-1 text-xs">
                <p className="font-medium text-amber-400">15-Day Name Change Waiting Period</p>
                <p className="text-theme-text-muted leading-relaxed">{nameChangeStatus.statusMessage}</p>
                <p className="text-[11px] text-theme-text-muted/80">You can still freely update your bio, age group, gender, and location below.</p>
              </div>
            ) : nameChangeStatus.isInGracePeriod ? (
              <div className="space-y-1 pt-1 text-xs">
                <p className="font-medium text-blue-400">Active 30-Minute Edit Window</p>
                <p className="text-theme-text-muted leading-relaxed">{nameChangeStatus.statusMessage}</p>
              </div>
            ) : nameValidation.isChecking ? (
              <p className="text-xs text-blue-500 flex items-center gap-1 pt-0.5 animate-fadeIn">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Checking publisher name availability...</span>
              </p>
            ) : nameValidation.errorMessage ? (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1.5 pt-0.5 animate-fadeIn">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nameValidation.errorMessage}</span>
              </p>
            ) : nameValidation.successMessage ? (
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 pt-0.5 animate-fadeIn">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{nameValidation.successMessage}</span>
              </p>
            ) : (
              <p className="text-xs text-theme-text-muted pt-0.5 leading-relaxed">
                Applies universally across all your published apps and releases (publisher name is immutable inside individual release forms). When changed, you have 30 minutes for quick adjustments before a 15-day waiting period takes effect.
              </p>
            )}
          </div>

          {/* Bio / Tagline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium font-google-sans text-theme-text tracking-tight">
                Bio / Tagline
              </label>
              <span className="text-[11px] text-theme-text-muted font-mono">
                {bio.length}/160
              </span>
            </div>
            <div className="relative">
              <textarea
                maxLength={160}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                placeholder="A short note about yourself, your favorite platforms, or the apps you build..."
                className="w-full bg-theme-hover/40 border border-theme-border/50 focus:border-blue-500 rounded-xl text-sm text-theme-text placeholder-theme-text-muted/50 px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Demographics Grid: Age & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium font-google-sans text-theme-text tracking-tight">
                Age Group
              </label>
              <div className="relative">
                <select
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full bg-theme-hover/40 border border-theme-border/50 focus:border-blue-500 rounded-xl text-sm text-theme-text px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="Under 18" className="bg-theme-bg text-theme-text">Under 18</option>
                  <option value="18-24" className="bg-theme-bg text-theme-text">18–24 years</option>
                  <option value="25" className="bg-theme-bg text-theme-text">25–34 years</option>
                  <option value="35-44" className="bg-theme-bg text-theme-text">35–44 years</option>
                  <option value="45-54" className="bg-theme-bg text-theme-text">45–54 years</option>
                  <option value="55+" className="bg-theme-bg text-theme-text">55+ years</option>
                </select>
                <ChevronDown className="w-4 h-4 text-theme-text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium font-google-sans text-theme-text tracking-tight">
                Gender
              </label>
              <div className="relative">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-theme-hover/40 border border-theme-border/50 focus:border-blue-500 rounded-xl text-sm text-theme-text px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer appearance-none"
                >
                  <option value="Prefer not to say" className="bg-theme-bg text-theme-text">Prefer not to say</option>
                  <option value="Male" className="bg-theme-bg text-theme-text">Male</option>
                  <option value="Female" className="bg-theme-bg text-theme-text">Female</option>
                  <option value="Non-binary" className="bg-theme-bg text-theme-text">Non-binary</option>
                  <option value="Other" className="bg-theme-bg text-theme-text">Other</option>
                </select>
                <ChevronDown className="w-4 h-4 text-theme-text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Location / Country */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium font-google-sans text-theme-text tracking-tight">
              Location / Country
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. India, United States, Global"
                className="w-full bg-theme-hover/40 border border-theme-border/50 focus:border-blue-500 rounded-xl text-sm text-theme-text placeholder-theme-text-muted/50 px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Unified Sign-In Accounts Card */}
          <div className="p-4 rounded-xl border border-theme-border/60 bg-theme-hover/25 space-y-3 mt-2">
            <div>
              <h4 className="text-sm font-semibold text-theme-heading font-google-sans flex items-center gap-2">
                <span>Unified Sign-In Accounts</span>
              </h4>
              <p className="text-xs text-theme-text-muted mt-0.5">
                Accounts using the same verified email automatically unify your developer profile, published releases, keystore, and admin rights.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {/* Email Account */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-bg/60 border border-theme-border/40 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <span className="font-bold text-[10px]">@</span>
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-theme-text truncate">{user?.email || 'Email Account'}</p>
                    <p className="text-[11px] text-theme-text-muted">Email / One-Time Passcode</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Primary
                </span>
              </div>

              {/* Google Account */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-bg/60 border border-theme-border/40 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <div className="truncate">
                    <p className="font-medium text-theme-text truncate">Google</p>
                    <p className="text-[11px] text-theme-text-muted">
                      {isGoogleLinked ? 'Connected to profile' : 'Not linked'}
                    </p>
                  </div>
                </div>
                {isGoogleLinked ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Connected
                    </span>
                    {hasMultipleProviders && (
                      <button
                        type="button"
                        onClick={() => handleUnlink('google.com', 'Google')}
                        disabled={isLinking === 'google.com'}
                        className="text-[11px] text-theme-text-muted hover:text-red-400 cursor-pointer"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkGoogle}
                    disabled={Boolean(isLinking)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isLinking === 'google.com' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    <span>Connect Google</span>
                  </button>
                )}
              </div>

              {/* GitHub Account */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-bg/60 border border-theme-border/40 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-5 h-5 shrink-0 text-[#24292f] dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <div className="truncate">
                    <p className="font-medium text-theme-text truncate">
                      GitHub {user?.publisherGithub ? `(@${user.publisherGithub})` : ''}
                    </p>
                    <p className="text-[11px] text-theme-text-muted">
                      {isGithubLinked ? 'Connected to profile' : 'Not linked'}
                    </p>
                  </div>
                </div>
                {isGithubLinked ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Connected
                    </span>
                    {hasMultipleProviders && (
                      <button
                        type="button"
                        onClick={() => handleUnlink('github.com', 'GitHub')}
                        disabled={isLinking === 'github.com'}
                        className="text-[11px] text-theme-text-muted hover:text-red-400 cursor-pointer"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkGithub}
                    disabled={Boolean(isLinking)}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isLinking === 'github.com' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    <span>Connect GitHub</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || !displayName.trim()}
              className="w-full sm:flex-1 py-2.5 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
            <button
              type="button"
              onClick={handleBackAttempt}
              className="w-full sm:w-auto py-2.5 px-6 bg-transparent hover:bg-theme-hover text-theme-text border border-theme-border/60 rounded-full text-sm font-medium transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Confirmation Dialog on Unsaved Discard (Using existing UI style) */}
      <ConfirmationDialog
        isOpen={showDiscardDialog}
        title="Discard unsaved changes?"
        description="You have unsaved changes in your profile. Are you sure you want to discard them and return to Settings?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        isDestructive={true}
        onConfirm={() => {
          setShowDiscardDialog(false);
          onBack();
        }}
        onCancel={() => setShowDiscardDialog(false)}
      />
    </div>
  );
}
