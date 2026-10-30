import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ChevronDown, Check, AlertCircle, Loader2, Lock, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStoreConfig } from '../context/StoreConfigContext';
import { useToast } from '../context/ToastContext';
import ConfirmationDialog from './ConfirmationDialog';
import StoreCircleLoader from './StoreCircleLoader';
import { 
  usePublisherNameValidation, 
  checkPublisherNameAvailability, 
  claimPublisherName,
  getNameChangeStatus,
  recordNameChangeTimestamps
} from '../services/publisherNameService';
import { usePreserveScroll } from '../services/scrollManager';

export default function EditProfilePage({ onBack }: { onBack: () => void }) {
  const { user, isLoading: isAuthLoading, updateUserProfile } = useAuth();
  const { appsList } = useStoreConfig();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);

  usePreserveScroll('edit-profile', containerRef);

  // Publisher name takes highest priority over raw email/display name
  const currentActiveName = user?.publisherName || user?.displayName || (user?.email && !user.email.includes('user') ? user.email.split('@')[0] : '');
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

        if (user?.uid && user?.email) {
          const claimRes = await claimPublisherName(cleanName, user.uid, user.email, calculated);
          if (!claimRes.success) {
            showToast(claimRes.message || 'Failed to update publisher name.', { type: 'error' });
            setIsSaving(false);
            return;
          }
        }
      }

      updateUserProfile({
        displayName: isNameChanged ? cleanName : (user?.displayName || cleanName),
        publisherName: cleanName,
        age,
        gender,
        location: location.trim() || 'Global',
        bio: bio.trim(),
        lastNameChangedAt: updatedTimestamps.lastNameChangedAt,
        nameChangeSessionStartedAt: updatedTimestamps.nameChangeSessionStartedAt
      });

      if (isNameChanged) {
        showToast('Publisher name updated successfully! You have 30 minutes to make any further quick adjustments.');
      } else {
        showToast('Profile updated successfully');
      }

      // When user enters profile editing page after saving, return back to previous page
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
              <label className="block text-sm font-medium font-google-sans text-theme-text tracking-tight flex items-center gap-1.5">
                <span>Publisher / Display Name</span>
                <span className="text-red-500">*</span>
                {isNameLocked && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
                {nameChangeStatus.isInGracePeriod && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    <Clock className="w-2.5 h-2.5" /> 30m Edit Window
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
                className={`w-full border rounded-xl text-sm text-theme-text placeholder-theme-text-muted/50 px-3.5 py-2.5 pr-10 focus:outline-none transition-all ${
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
                {isNameLocked ? (
                  <Lock className="w-4 h-4 text-theme-text-muted/60" />
                ) : nameValidation.isChecking ? (
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
              <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 mt-1">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="flex-1 space-y-0.5">
                  <p className="font-medium text-amber-200">15-Day Name Change Waiting Period</p>
                  <p className="text-amber-300/90 leading-relaxed">{nameChangeStatus.statusMessage}</p>
                  <p className="text-[11px] text-amber-400/80">You can still freely update your bio, age group, gender, and location below.</p>
                </div>
              </div>
            ) : nameChangeStatus.isInGracePeriod ? (
              <div className="flex items-start gap-2 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 mt-1">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                <div className="flex-1 space-y-0.5">
                  <p className="font-medium text-blue-200">Active 30-Minute Edit Window</p>
                  <p className="text-blue-300/90 leading-relaxed">{nameChangeStatus.statusMessage}</p>
                </div>
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
              <p className="text-xs text-theme-text-muted pt-0.5">
                Each publisher has a unique name across the store. When changed, you have 30 minutes to make quick back-to-back edits before a 15-day waiting period takes effect.
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
