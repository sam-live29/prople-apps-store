/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { getAvatarInitial, getGmailAvatarColor } from '../utils/avatarUtils';

export interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  publisherName?: string | null;
  email?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  className?: string;
  textClassName?: string;
  alt?: string;
}

const SIZE_CONTAINER_CLASSES: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
  '2xl': 'w-24 h-24 sm:w-28 sm:h-28',
  custom: '',
};

const SIZE_TEXT_CLASSES: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-[14px] sm:text-[15px]',
  md: 'text-[17px] sm:text-[18px]',
  lg: 'text-xl',
  xl: 'text-2xl sm:text-3xl',
  '2xl': 'text-3xl sm:text-4xl',
  custom: '',
};

export default function UserAvatar({
  photoURL,
  displayName,
  publisherName,
  email,
  name,
  size = 'md',
  className = '',
  textClassName = '',
  alt,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const identifier = email || displayName || publisherName || name || '';
  const initial = getAvatarInitial(displayName || publisherName || name, email);
  const color = getGmailAvatarColor(identifier);

  const containerSizeClass = SIZE_CONTAINER_CLASSES[size] || SIZE_CONTAINER_CLASSES.md;
  const textSizeClass = SIZE_TEXT_CLASSES[size] || SIZE_TEXT_CLASSES.md;

  const hasPhoto = Boolean(photoURL && photoURL.trim() && !imgError);

  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 select-none relative transition-colors ${containerSizeClass} ${className}`}
      style={{
        backgroundColor: hasPhoto ? 'transparent' : color.bg,
      }}
    >
      {hasPhoto ? (
        <img
          src={photoURL!}
          alt={alt || displayName || name || 'Profile'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className={`font-google-sans font-medium text-white tracking-normal leading-none uppercase ${textSizeClass} ${textClassName}`}
          style={{
            color: color.text,
            transform: 'translateY(0.5px)', // Optical vertical centering for sans-serif caps
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
