/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * 1:1 Google Play Store Material Symbols Outlined Icons
 * Exactly matching Android Google Play Store permission groups.
 */

// Camera: Material photo_camera outlined
export const PlayStoreCameraIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 17.5q2.28 0 3.89-1.61Q17.5 14.28 17.5 12t-1.61-3.89Q14.28 6.5 12 6.5T8.11 8.11Q6.5 9.72 6.5 12t1.61 3.89Q9.72 17.5 12 17.5Zm0-2q-1.45 0-2.48-1.02Q8.5 13.45 8.5 12q0-1.45 1.02-2.48Q10.55 8.5 12 8.5q1.45 0 2.48 1.02Q15.5 10.55 15.5 12q0 1.45-1.02 2.48Q13.45 15.5 12 15.5ZM4 21q-.83 0-1.41-.59Q2 19.83 2 19V7q0-.83.59-1.41Q3.17 5 4 5h3.15L9 3h6l1.85 2H20q.83 0 1.41.59Q22 6.17 22 7v12q0 .83-.59 1.41Q20.83 21 20 21ZM4 19h16V7h-3.88l-1.85-2H9.73L7.88 7H4Zm8-6Z" />
  </svg>
);

// Location: Material location_on outlined
export const PlayStoreLocationIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 20.9q-.3 0-.58-.11-.27-.11-.47-.34-2.65-2.85-4.43-5.28Q4.75 12.75 4.75 10.2q0-3.1 2.05-5.15Q8.85 3 12 3t5.2 2.05q2.05 2.05 2.05 5.15 0 2.55-1.78 4.97-1.77 2.43-4.42 5.28-.2.23-.48.34-.27.11-.57.11Zm0-9.4q1.05 0 1.77-.73.73-.72.73-1.77t-.73-1.77Q13.05 6.5 12 6.5q-1.05 0-1.78.73-.72.72-.72 1.77t.72 1.77q.73.73 1.78.73ZM12 18.35q2.25-2.4 3.75-4.52t1.5-3.63q0-2.3-1.45-3.75T12 5q-2.35 0-3.8 1.45T6.75 10.2q0 1.52 1.5 3.63t3.75 4.52ZM12 10.2Z" />
  </svg>
);

// Microphone: Material mic outlined
export const PlayStoreMicrophoneIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 14q-1.25 0-2.12-.87Q9 12.25 9 11V5q0-1.25.88-2.13Q10.75 2 12 2t2.13.87Q15 3.75 15 5v6q0 1.25-.87 2.13Q13.25 14 12 14Zm-1 7v-3.08q-2.6-.35-4.3-2.32Q5 13.63 5 11h2q0 2.08 1.46 3.54T12 16q2.08 0 3.54-1.46T17 11h2q0 2.63-1.7 4.6-1.7 1.97-4.3 2.32V21Zm1-9q.43 0 .71-.29.29-.28.29-.71V5q0-.43-.29-.71-.28-.29-.71-.29t-.71.29Q11 4.57 11 5v6q0 .43.29.71.28.29.71.29Z" />
  </svg>
);

// Telephone: Material call outlined
export const PlayStoreTelephoneIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M19.95 21q-3.23 0-6.18-1.49-2.94-1.48-5.19-3.73-2.25-2.25-3.74-5.19Q3.35 7.64 3.35 4.4q0-.43.29-.71.28-.29.71-.29h3.5q.35 0 .63.22.27.23.37.58l.75 3.3q.05.35-.02.63-.08.27-.33.47L6.85 10.75q1.05 1.8 2.45 3.2 1.4 1.4 3.2 2.45l2.15-2.4q.23-.25.5-.32.28-.08.6-.03l3.3.75q.35.1.58.37.22.28.22.63v3.5q0 .43-.29.71-.28.29-.71.29ZM6.05 8.65 7.8 7.3 7.35 5.35H5.4q.08.85.28 1.68.2.82.37 1.62Zm8.55 8.55q.8.18 1.62.37.83.2 1.68.28v-1.95l-1.95-.45ZM6.05 8.65Zm8.55 8.55Z" />
  </svg>
);

// Storage: Material photo_library / perm_media outlined (The exact overlapping photo frames from Play Store Screenshot)
export const PlayStoreStorageIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M4 22q-.83 0-1.41-.59Q2 20.83 2 20V6h2v14h14v2Zm4-4q-.83 0-1.41-.59Q6 16.83 6 16V4q0-.83.59-1.41Q7.17 2 8 2h12q.83 0 1.41.59Q22 3.17 22 4v12q0 .83-.59 1.41Q20.83 18 20 18ZM8 16h12V4H8Zm2-2h8l-2.6-3.5-1.9 2.5-1.4-1.85ZM8 16V4v12Z" />
  </svg>
);

// Other: Material help_center outlined (The exact rounded square badge with question mark from Play Store Screenshot)
export const PlayStoreOtherIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
    {...props}
  >
    <path d="M12 17q.43 0 .71-.29.29-.28.29-.71t-.29-.71Q12.43 15 12 15t-.71.29q-.29.28-.29.71t.29.71q.28.29.71.29Zm-.75-3.5h1.5q0-.85.33-1.35.32-.5 1.17-1.35.65-.65 1-1.3.35-.65.35-1.5 0-1.45-1.02-2.48Q13.55 4.5 12 4.5q-1.35 0-2.38.77-.97.78-1.37 2.08l1.45.6q.25-.8.85-1.28.6-.47 1.45-.47.88 0 1.46.57.59.58.59 1.43 0 .55-.25 1-.25.45-.75.95-.95.95-1.35 1.6-.4.65-.4 1.75ZM5 21q-.83 0-1.41-.59Q3 19.83 3 19V5q0-.83.59-1.41Q4.17 3 5 3h14q.83 0 1.41.59Q21 4.17 21 5v14q0 .83-.59 1.41Q19.83 21 19 21Zm0-2h14V5H5v14ZM5 5v14V5Z" />
  </svg>
);

// Contacts: Material contacts outlined
export const PlayStoreContactsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
    <path d="M12 11q-1.25 0-2.12-.88Q9 9.25 9 8q0-1.25.88-2.12Q10.75 5 12 5q1.25 0 2.12.88Q15 6.75 15 8q0 1.25-.88 2.12Q13.25 11 12 11Zm-6 7q0-1.25.75-2.29.75-1.03 2.05-1.46 1.55-.5 3.2-.5t3.2.5q1.3.43 2.05 1.46.75 1.04.75 2.29Zm-2 4q-.83 0-1.41-.59Q2 20.83 2 20V4q0-.83.59-1.41Q3.17 2 4 2h16q.83 0 1.41.59Q22 3.17 22 4v16q0 .83-.59 1.41Q20.83 22 20 22ZM4 20h16V4H4Zm0 0V4v16Z" />
  </svg>
);

// SMS / Messages: Material sms outlined
export const PlayStoreSmsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
    <path d="M9 13h6v-2H9Zm-2-3h10V8H7Zm-3 12q-.83 0-1.41-.59Q2 20.83 2 20V4q0-.83.59-1.41Q3.17 2 4 2h16q.83 0 1.41.59Q22 3.17 22 4v12q0 .83-.59 1.41Q20.83 18 20 18H6Zm1.15-4H20V4H4v13.13ZM4 18V4v14Z" />
  </svg>
);

// Calendar: Material calendar_today outlined
export const PlayStoreCalendarIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
    <path d="M5 22q-.83 0-1.41-.59Q3 20.83 3 20V6q0-.83.59-1.41Q4.17 4 5 4h1V2h2v2h8V2h2v2h1q.83 0 1.41.59Q21 5.17 21 6v14q0 .83-.59 1.41Q19.83 22 19 22Zm0-2h14V10H5v10ZM5 8h14V6H5Zm0 0V6v2Z" />
  </svg>
);

// Notifications: Material notifications outlined
export const PlayStoreNotificationsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
    <path d="M12 22q-.83 0-1.41-.59Q10 20.83 10 20h4q0 .83-.59 1.41Q12.83 22 12 22Zm-8-4v-2h2v-7q0-2.08 1.25-3.68T10.5 5.2V4.5q0-.63.44-1.06Q11.38 3 12 3t1.06.44q.44.43.44 1.06v.7q2 .5 3.25 2.1T18 9v7h2v2Zm4-2h8V9q0-1.65-1.18-2.82Q13.65 5 12 5q-1.65 0-2.82 1.18Q8 7.35 8 9Zm4-3.5Z" />
  </svg>
);

// Bluetooth & Nearby devices: Material bluetooth outlined
export const PlayStoreBluetoothIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
    <path d="M14.8 12 19 7.8 13 1.8h-1v7.38L8.4 5.6 7 7l4.58 4.6L7 16.2 8.4 17.6l3.6-3.58V22.2h1l6-6-4.2-4.2Zm-1.8-6.18 2.38 2.38L13 10.58Zm2.38 11.8L13 20V13.82Z" />
  </svg>
);

// Sensors: Material sensors outlined
export const PlayStoreSensorsIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
    <path d="M12 15q-1.25 0-2.12-.88Q9 13.25 9 12q0-1.25.88-2.12Q10.75 9 12 9q1.25 0 2.12.88Q15 10.75 15 12q0 1.25-.88 2.12Q13.25 15 12 15Zm0-2q.43 0 .71-.29.29-.28.29-.71t-.29-.71Q12.43 11 12 11t-.71.29q-.29.28-.29.71t.29.71q.28.29.71.29ZM4.93 19.07l-1.4-1.42q2.35-2.35 2.35-5.65 0-3.3-2.35-5.65l1.4-1.42q2.95 2.95 2.95 7.07 0 4.12-2.95 7.07Zm14.14 0q-2.95-2.95-2.95-7.07 0-4.12 2.95-7.07l1.4 1.42q-2.35 2.35-2.35 5.65 0 3.3 2.35 5.65ZM7.75 16.25l-1.4-1.4q1.2-1.2 1.2-2.85 0-1.65-1.2-2.85l1.4-1.4q1.77 1.77 1.77 4.25t-1.77 4.25Zm8.5 0q-1.77-1.77-1.77-4.25t1.77-4.25l1.4 1.4q-1.2 1.2-1.2 2.85 0 1.65 1.2 2.85Z" />
  </svg>
);

export function getPlayStorePermissionIcon(id: string, className = 'w-6 h-6') {
  switch (id.toLowerCase()) {
    case 'camera':
      return <PlayStoreCameraIcon className={className} />;
    case 'location':
      return <PlayStoreLocationIcon className={className} />;
    case 'microphone':
      return <PlayStoreMicrophoneIcon className={className} />;
    case 'telephone':
    case 'phone':
    case 'call':
      return <PlayStoreTelephoneIcon className={className} />;
    case 'storage':
    case 'photos':
    case 'media':
      return <PlayStoreStorageIcon className={className} />;
    case 'contacts':
      return <PlayStoreContactsIcon className={className} />;
    case 'sms':
    case 'messages':
      return <PlayStoreSmsIcon className={className} />;
    case 'calendar':
      return <PlayStoreCalendarIcon className={className} />;
    case 'notifications':
      return <PlayStoreNotificationsIcon className={className} />;
    case 'bluetooth':
    case 'nearby':
      return <PlayStoreBluetoothIcon className={className} />;
    case 'sensors':
    case 'body sensors':
      return <PlayStoreSensorsIcon className={className} />;
    case 'other':
    default:
      return <PlayStoreOtherIcon className={className} />;
  }
}
