import React, { useMemo, useRef } from 'react';
import { 
  Search, 
  TrendingUp, 
  Star, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Download
} from 'lucide-react';
import { useStoreConfig } from '../context/StoreConfigContext';
import { AppListing } from '../types';
import { detectClientOS, sortAppsByDeviceCompatibility } from '../services/osDetectionService';
import { computeExploreDistribution } from '../services/appDistributionAlgorithm';
import { getUnifiedAppSize } from '../utils/appMetricsAlgorithm';
import ExploreSkeleton from './ExploreSkeleton';
import PullToRefresh from './PullToRefresh';

interface ExplorePageProps {
  onOpenSearch?: () => void;
  onSearchQuery: (query: string) => void;
  onAppClick: (appId: string) => void;
  onCategoryClick?: (categoryName: string) => void;
  onShowLatestReleases?: () => void;
}

// -------------------------------------------------------------
// Native Pixel/Material Vector Graphics
// -------------------------------------------------------------

function HelicopterIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Top Rotor Blade */}
      <rect x="8" y="8" width="32" height="3" rx="1.5" fill="#EF4444" />
      <rect x="23" y="11" width="3" height="5" fill="#DC2626" />
      {/* Main Body */}
      <ellipse cx="22" cy="24" rx="13" ry="9" fill="#EF4444" />
      {/* Windshield */}
      <path d="M12 21C13 18 16 16.5 19 16.5V25H10.5C10.8 23.5 11.3 22.2 12 21Z" fill="#FEE2E2" />
      {/* Tail Boom & Rotor */}
      <path d="M33 22L43 19V24L33 25V22Z" fill="#DC2626" />
      <rect x="42" y="15" width="2.5" height="13" rx="1.25" fill="#EF4444" />
      {/* Landing Skids */}
      <rect x="18" y="32" width="2" height="4" fill="#991B1B" />
      <rect x="27" y="32" width="2" height="4" fill="#991B1B" />
      <rect x="12" y="36" width="20" height="2.5" rx="1.25" fill="#B91C1C" />
    </svg>
  );
}

function SimulationIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Avatar Head */}
      <circle cx="24" cy="18" r="7" fill="#10B981" />
      {/* Avatar Shoulders */}
      <path d="M12 34C12 28.5 17 26 24 26C31 26 36 28.5 36 34V36H12V34Z" fill="#059669" />
      {/* Screen / Console Bar */}
      <rect x="8" y="36" width="32" height="4" rx="2" fill="#34D399" />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Puzzle Piece */}
      <path
        d="M14 14H21C21 11.5 22.5 10 24 10C25.5 10 27 11.5 27 14H34V21C36.5 21 38 22.5 38 24C38 25.5 36.5 27 34 27V34H27C27 36.5 25.5 38 24 38C22.5 38 21 36.5 21 34H14V27C11.5 27 10 25.5 10 24C10 22.5 11.5 21 14 21V14Z"
        fill="#0EA5E9"
      />
    </svg>
  );
}

function AdventureIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Compass Outer Ring */}
      <circle cx="24" cy="24" r="17" fill="#F59E0B" />
      <circle cx="24" cy="24" r="14" fill="#FEF3C7" />
      {/* Compass Needle */}
      <polygon points="24,14 27,24 24,22 21,24" fill="#EF4444" />
      <polygon points="24,34 27,24 24,26 21,24" fill="#64748B" />
      <circle cx="24" cy="24" r="2.5" fill="#B45309" />
    </svg>
  );
}

function RacingIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Flag Pole */}
      <rect x="10" y="8" width="3" height="32" rx="1.5" fill="#94A3B8" />
      {/* Checkered Flag */}
      <g transform="translate(13, 10)">
        <rect x="0" y="0" width="7" height="6" fill="#C084FC" />
        <rect x="7" y="0" width="7" height="6" fill="#FFFFFF" />
        <rect x="14" y="0" width="7" height="6" fill="#C084FC" />
        
        <rect x="0" y="6" width="7" height="6" fill="#FFFFFF" />
        <rect x="7" y="6" width="7" height="6" fill="#C084FC" />
        <rect x="14" y="6" width="7" height="6" fill="#FFFFFF" />
        
        <rect x="0" y="12" width="7" height="6" fill="#C084FC" />
        <rect x="7" y="12" width="7" height="6" fill="#FFFFFF" />
        <rect x="14" y="12" width="7" height="6" fill="#C084FC" />
      </g>
    </svg>
  );
}

function RolePlayingIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Crossed Swords */}
      {/* Sword 1 (top-left to bottom-right) */}
      <path d="M12 12L32 32" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
      <path d="M30 30L34 34" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 34L34 26" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
      
      {/* Sword 2 (top-right to bottom-left) */}
      <path d="M36 12L16 32" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 30L14 34" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 34L14 26" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StrategyIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Flag / Tower base */}
      <path d="M22 10V38" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 12H34L29 18L34 24H22" fill="#34D399" />
      <circle cx="22" cy="38" r="6" fill="#059669" />
    </svg>
  );
}

function SportsIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Tennis Racket */}
      <ellipse cx="28" cy="18" rx="10" ry="12" stroke="#EC4899" strokeWidth="3" fill="none" transform="rotate(25 28 18)" />
      <line x1="20" y1="27" x2="10" y2="39" stroke="#DB2777" strokeWidth="3.5" strokeLinecap="round" />
      {/* Yellow Ball */}
      <circle cx="34" cy="34" r="5" fill="#FACC15" />
    </svg>
  );
}

function EntertainmentIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Clapperboard Body */}
      <rect x="8" y="18" width="32" height="20" rx="3" fill="#8B5CF6" />
      {/* Clapper Top with Stripes */}
      <rect x="8" y="10" width="32" height="8" rx="2" fill="#6D28D9" />
      <line x1="14" y1="10" x2="18" y2="18" stroke="#DDD6FE" strokeWidth="2.5" />
      <line x1="22" y1="10" x2="26" y2="18" stroke="#DDD6FE" strokeWidth="2.5" />
      <line x1="30" y1="10" x2="34" y2="18" stroke="#DDD6FE" strokeWidth="2.5" />
      {/* Inner Play Line */}
      <rect x="13" y="24" width="22" height="2.5" rx="1" fill="#C4B5FD" />
      <rect x="13" y="30" width="14" height="2.5" rx="1" fill="#C4B5FD" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Center User */}
      <circle cx="24" cy="17" r="5.5" fill="#F43F5E" />
      <path d="M16 33C16 28 19.5 26 24 26C28.5 26 32 28 32 33V34H16V33Z" fill="#F43F5E" />
      {/* Left User */}
      <circle cx="13" cy="20" r="4" fill="#FDA4AF" />
      <path d="M7 32C7 28 9.5 27 13 27C14.5 27 15.8 27.3 17 28C16.3 29.3 16 30.7 16 32.5V33H7V32Z" fill="#FDA4AF" />
      {/* Right User */}
      <circle cx="35" cy="20" r="4" fill="#FDA4AF" />
      <path d="M41 32C41 28 38.5 27 35 27C33.5 27 32.2 27.3 31 28C31.7 29.3 32 30.7 32 32.5V33H41V32Z" fill="#FDA4AF" />
    </svg>
  );
}

function ProductivityIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Board */}
      <rect x="11" y="10" width="26" height="30" rx="3" fill="#3B82F6" />
      {/* Top Clip */}
      <rect x="18" y="7" width="12" height="5" rx="1.5" fill="#1D4ED8" />
      {/* Checkmarks & Lines */}
      <circle cx="17" cy="19" r="2" fill="#BFDBFE" />
      <rect x="22" y="18" width="11" height="2" rx="1" fill="#BFDBFE" />
      <circle cx="17" cy="26" r="2" fill="#BFDBFE" />
      <rect x="22" y="25" width="11" height="2" rx="1" fill="#BFDBFE" />
      <circle cx="17" cy="33" r="2" fill="#BFDBFE" />
      <rect x="22" y="32" width="11" height="2" rx="1" fill="#BFDBFE" />
    </svg>
  );
}

function CommunicationIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      {/* Chat Bubble */}
      <path
        d="M10 22C10 14.82 16.27 9 24 9C31.73 9 38 14.82 38 22C38 29.18 31.73 35 24 35C21.5 35 19.1 34.4 17 33.3L10 36L11.8 29.8C10.7 27.5 10 24.9 10 22Z"
        fill="#22C55E"
      />
      {/* Speech Dots */}
      <circle cx="18" cy="22" r="2" fill="#DCFCE7" />
      <circle cx="24" cy="22" r="2" fill="#DCFCE7" />
      <circle cx="30" cy="22" r="2" fill="#DCFCE7" />
    </svg>
  );
}

function CameraCategoryIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="9" y="16" width="30" height="22" rx="4" fill="#F97316" />
      <path d="M17 16L19 12H29L31 16H17Z" fill="#EA580C" />
      <circle cx="24" cy="27" r="6" fill="#FFEDD5" />
      <circle cx="24" cy="27" r="3.5" fill="#C2410C" />
      <circle cx="33" cy="20" r="1.5" fill="#FFEDD5" />
    </svg>
  );
}

function ToolsCategoryIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path
        d="M33 13C31 11 28 10.5 25.5 11.5L29 15L27 17L23.5 13.5C22.5 16 23 19 25 21L14 32C13 33 13 34.5 14 35.5C15 36.5 16.5 36.5 17.5 35.5L28.5 24.5C30.5 26.5 33.5 27 36 26L32.5 22.5L34.5 20.5L38 24C39 21.5 38.5 18.5 36.5 16.5L33 13Z"
        fill="#06B6D4"
      />
    </svg>
  );
}

function BusinessIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path d="M18 14C18 11.8 19.8 10 22 10H26C28.2 10 30 11.8 30 14V16H18V14Z" stroke="#475569" strokeWidth="2.5" />
      <rect x="8" y="16" width="32" height="22" rx="4" fill="#2563EB" />
      <path d="M8 16L24 27L40 16" stroke="#1D4ED8" strokeWidth="3" />
      <rect x="22" y="25" width="4" height="5" rx="1" fill="#FBBF24" />
    </svg>
  );
}

function EducationIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <polygon points="24,11 41,19 24,27 7,19" fill="#0284C7" />
      <path d="M14 23V31C14 34.5 18.5 37 24 37C29.5 37 34 34.5 34 31V23" fill="#0369A1" />
      <path d="M37 20V31" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="37" cy="32" r="2" fill="#D97706" />
    </svg>
  );
}

function HealthFitnessIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path
        d="M24 38C24 38 9 28 9 18C9 13.5 12.5 10 17 10C20 10 22.5 11.5 24 14C25.5 11.5 28 10 31 10C35.5 10 39 13.5 39 18C39 28 24 38 24 38Z"
        fill="#E11D48"
      />
      <path
        d="M13 20H18L21 14L25 26L28 18L30 20H35"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShoppingIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="10" y="16" width="28" height="24" rx="4" fill="#7C3AED" />
      <path d="M18 18V13C18 9.7 20.7 7 24 7C27.3 7 30 9.7 30 13V18" stroke="#A78BFA" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="27" r="5" fill="#C4B5FD" />
      <path d="M22 25L26 29" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="29" r="0.75" fill="#5B21B6" />
      <circle cx="26" cy="25" r="0.75" fill="#5B21B6" />
    </svg>
  );
}

function ArtDesignIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path
        d="M24 8C13 8 7 14 7 24C7 33 13 40 22 40C25 40 26 38 26 36C26 34.5 25.5 33.5 25 32C24.5 30.5 24 29 24 27C24 24 26 22 29 22H33C37.5 22 41 18.5 41 14C41 10.7 33.4 8 24 8Z"
        fill="#EC4899"
      />
      <circle cx="16" cy="18" r="3" fill="#FACC15" />
      <circle cx="24" cy="15" r="3" fill="#38BDF8" />
      <circle cx="32" cy="16" r="3" fill="#4ADE80" />
      <circle cx="16" cy="28" r="3" fill="#A855F7" />
    </svg>
  );
}

function MusicAudioIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <circle cx="16" cy="33" r="5" fill="#8B5CF6" />
      <circle cx="32" cy="27" r="5" fill="#8B5CF6" />
      <rect x="19" y="14" width="3" height="19" fill="#7C3AED" />
      <rect x="35" y="8" width="3" height="19" fill="#7C3AED" />
      <polygon points="19,14 38,8 38,14 19,20" fill="#6D28D9" />
    </svg>
  );
}

function FinanceIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="13" width="32" height="24" rx="4" fill="#059669" />
      <path d="M8 19H40" stroke="#047857" strokeWidth="2" />
      <path d="M28 20H38C39.1 20 40 20.9 40 22V28C40 29.1 39.1 30 38 30H28V20Z" fill="#10B981" />
      <circle cx="34" cy="25" r="2" fill="#FBBF24" />
    </svg>
  );
}

function NewsMagazinesIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="9" y="10" width="30" height="28" rx="3" fill="#D97706" />
      <rect x="13" y="14" width="22" height="5" rx="1" fill="#FEF3C7" />
      <rect x="13" y="22" width="9" height="12" rx="1" fill="#FBBF24" />
      <rect x="25" y="22" width="10" height="2" rx="1" fill="#FEF3C7" />
      <rect x="25" y="26" width="10" height="2" rx="1" fill="#FEF3C7" />
      <rect x="25" y="30" width="7" height="2" rx="1" fill="#FEF3C7" />
    </svg>
  );
}

function TravelLocalIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path
        d="M24 8L27 19L39 23V27L27 24V32L31 36V39L24 37L17 39V36L21 32V24L9 27V23L21 19L24 8Z"
        fill="#0284C7"
      />
      <ellipse cx="14" cy="36" rx="6" ry="3" fill="#BAE6FD" />
      <ellipse cx="34" cy="36" rx="6" ry="3" fill="#BAE6FD" />
    </svg>
  );
}

function BooksReferenceIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path d="M24 14C19 12 12 12 8 13V35C12 34 19 34 24 36V14Z" fill="#B45309" />
      <path d="M24 14C29 12 36 12 40 13V35C36 34 29 34 24 36V14Z" fill="#D97706" />
      <line x1="24" y1="14" x2="24" y2="36" stroke="#FEF3C7" strokeWidth="2" />
      <path d="M24 14V24L26.5 21.5L29 24V14H24Z" fill="#EF4444" />
    </svg>
  );
}

function FoodDrinkIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path d="M12 22C12 15.5 17.5 12 24 12C30.5 12 36 15.5 36 22H12Z" fill="#EA580C" />
      <circle cx="18" cy="17" r="1" fill="#FED7AA" />
      <circle cx="24" cy="15" r="1" fill="#FED7AA" />
      <circle cx="30" cy="17" r="1" fill="#FED7AA" />
      <rect x="10" y="24" width="28" height="4" rx="2" fill="#78350F" />
      <polygon points="14,24 34,24 24,28" fill="#FACC15" />
      <rect x="12" y="30" width="24" height="5" rx="2.5" fill="#EA580C" />
    </svg>
  );
}

function MedicalIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="9" y="9" width="30" height="30" rx="8" fill="#DC2626" />
      <rect x="21" y="16" width="6" height="16" rx="2" fill="#FFFFFF" />
      <rect x="16" y="21" width="16" height="6" rx="2" fill="#FFFFFF" />
    </svg>
  );
}

function HouseHomeIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <polygon points="24,10 39,22 35,22 35,36 13,36 13,22 9,22" fill="#D97706" />
      <rect x="20" y="26" width="8" height="10" rx="1.5" fill="#78350F" />
      <rect x="31" y="12" width="4" height="6" fill="#B45309" />
    </svg>
  );
}

function AutoVehiclesIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path d="M10 26L14 18H32L38 26V32H10V26Z" fill="#DC2626" />
      <polygon points="16,25 17,20 23,20 23,25" fill="#FEE2E2" />
      <polygon points="25,25 25,20 31,20 34,25" fill="#FEE2E2" />
      <circle cx="16" cy="32" r="4.5" fill="#1E293B" />
      <circle cx="16" cy="32" r="2" fill="#94A3B8" />
      <circle cx="32" cy="32" r="4.5" fill="#1E293B" />
      <circle cx="32" cy="32" r="2" fill="#94A3B8" />
    </svg>
  );
}

function BeautyIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="15" y="20" width="18" height="18" rx="5" fill="#F43F5E" />
      <rect x="21" y="14" width="6" height="6" fill="#FDA4AF" />
      <rect x="18" y="11" width="12" height="3" rx="1.5" fill="#BE123C" />
      <circle cx="24" cy="29" r="4" fill="#FFE4E6" />
    </svg>
  );
}

function PersonalisationIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <line x1="12" y1="16" x2="36" y2="16" stroke="#A855F7" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="16" r="4.5" fill="#9333EA" />
      <line x1="12" y1="24" x2="36" y2="24" stroke="#A855F7" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="24" r="4.5" fill="#9333EA" />
      <line x1="12" y1="32" x2="36" y2="32" stroke="#A855F7" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="32" r="4.5" fill="#9333EA" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <circle cx="30" cy="18" r="8" fill="#FACC15" />
      <path
        d="M13 32C10.2 32 8 29.8 8 27C8 24.5 9.8 22.4 12.2 22.1C13.2 18.5 16.5 16 20.5 16C24.3 16 27.5 18.3 28.6 21.7C29.1 21.6 29.6 21.5 30 21.5C32.8 21.5 35 23.7 35 26.5C35 29.5 32.5 32 29.5 32H13Z"
        fill="#38BDF8"
      />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="9" y="14" width="30" height="20" rx="3" fill="#E11D48" />
      <circle cx="9" cy="24" r="4" fill="#0F172A" />
      <circle cx="39" cy="24" r="4" fill="#0F172A" />
      <line x1="20" y1="16" x2="20" y2="32" stroke="#FDA4AF" strokeWidth="2" strokeDasharray="2 2" />
      <circle cx="29" cy="24" r="4" fill="#FFE4E6" />
    </svg>
  );
}

function MapsNavigationIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path
        d="M24 9C17.4 9 12 14.4 12 21C12 29.5 24 39 24 39C24 39 36 29.5 36 21C36 14.4 30.6 9 24 9Z"
        fill="#10B981"
      />
      <circle cx="24" cy="20" r="4.5" fill="#FFFFFF" />
    </svg>
  );
}

function LibrariesDemoIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="11" width="32" height="26" rx="4" fill="#0891B2" />
      <path d="M19 19L14 24L19 29" stroke="#E0F2FE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M29 19L34 24L29 29" stroke="#E0F2FE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="26" y1="18" x2="22" y2="30" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ParentingIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <circle cx="19" cy="15" r="5" fill="#F59E0B" />
      <path d="M11 34C11 28 14.5 25 19 25C23.5 25 27 28 27 34V35H11V34Z" fill="#D97706" />
      <circle cx="31" cy="22" r="3.5" fill="#FCD34D" />
      <path d="M26 34C26 30 28 28 31 28C34 28 36 30 36 34V35H26V34Z" fill="#F59E0B" />
    </svg>
  );
}

function DatingIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <path
        d="M20 32C20 32 10 24 10 17C10 13.5 12.5 11 15.5 11C17.5 11 19 12 20 13.5C21 12 22.5 11 24.5 11C27.5 11 30 13.5 30 17C30 24 20 32 20 32Z"
        fill="#F43F5E"
      />
      <path
        d="M28 35C28 35 20 28 20 22C20 19 22 17 24.5 17C26 17 27.5 18 28 19C28.5 18 30 17 31.5 17C34 17 36 19 36 22C36 28 28 35 28 35Z"
        fill="#FDA4AF"
      />
    </svg>
  );
}

function AppCategoryFallbackIcon() {
  return (
    <svg className="w-9 h-9 shrink-0 drop-shadow-xs" viewBox="0 0 48 48" fill="none">
      <rect x="10" y="10" width="11" height="11" rx="3" fill="#3B82F6" />
      <rect x="27" y="10" width="11" height="11" rx="3" fill="#10B981" />
      <rect x="10" y="27" width="11" height="11" rx="3" fill="#F59E0B" />
      <rect x="27" y="27" width="11" height="11" rx="3" fill="#8B5CF6" />
    </svg>
  );
}

function getCategoryIcon(name: string) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('photo') || lower.includes('camera')) return <CameraCategoryIcon />;
  if (lower.includes('tool') || lower.includes('util')) return <ToolsCategoryIcon />;
  if (lower.includes('busin') || lower.includes('office') || lower.includes('work') || lower.includes('corp')) return <BusinessIcon />;
  if (lower.includes('educat') || lower.includes('learn') || lower.includes('study') || lower.includes('school')) return <EducationIcon />;
  if (lower.includes('health') || lower.includes('fit') || lower.includes('workout') || lower.includes('gym')) return <HealthFitnessIcon />;
  if (lower.includes('shop') || lower.includes('buy') || lower.includes('store') || lower.includes('cart')) return <ShoppingIcon />;
  if (lower.includes('art') || lower.includes('design') || lower.includes('draw') || lower.includes('paint') || lower.includes('sketch')) return <ArtDesignIcon />;
  if (lower.includes('music') || lower.includes('audio') || lower.includes('sound') || lower.includes('song') || lower.includes('podcast')) return <MusicAudioIcon />;
  if (lower.includes('financ') || lower.includes('money') || lower.includes('bank') || lower.includes('crypto') || lower.includes('invest')) return <FinanceIcon />;
  if (lower.includes('news') || lower.includes('magazin') || lower.includes('journal') || lower.includes('press') || lower.includes('article')) return <NewsMagazinesIcon />;
  if (lower.includes('travel') || lower.includes('local') || lower.includes('trip') || lower.includes('flight') || lower.includes('tour')) return <TravelLocalIcon />;
  if (lower.includes('book') || lower.includes('refer') || lower.includes('lib') || lower.includes('read') || lower.includes('novel')) return <BooksReferenceIcon />;
  if (lower.includes('food') || lower.includes('drink') || lower.includes('eat') || lower.includes('cook') || lower.includes('recipe')) return <FoodDrinkIcon />;
  if (lower.includes('house') || lower.includes('home') || lower.includes('decor') || lower.includes('interior')) return <HouseHomeIcon />;
  if (lower.includes('medic') || lower.includes('doctor') || lower.includes('clinic') || lower.includes('pharma')) return <MedicalIcon />;
  if (lower.includes('auto') || lower.includes('vehic') || lower.includes('car') || lower.includes('drive')) return <AutoVehiclesIcon />;
  if (lower.includes('beauty') || lower.includes('makeup') || lower.includes('cosmet') || lower.includes('hair')) return <BeautyIcon />;
  if (lower.includes('personali') || lower.includes('custom') || lower.includes('theme') || lower.includes('wallp')) return <PersonalisationIcon />;
  if (lower.includes('weath') || lower.includes('forecast') || lower.includes('climat')) return <WeatherIcon />;
  if (lower.includes('event') || lower.includes('ticket') || lower.includes('festiv') || lower.includes('concert')) return <EventsIcon />;
  if (lower.includes('date') || lower.includes('dating') || lower.includes('match') || lower.includes('romance')) return <DatingIcon />;
  if (lower.includes('parent') || lower.includes('child') || lower.includes('kid') || lower.includes('baby') || lower.includes('family')) return <ParentingIcon />;
  if (lower.includes('map') || lower.includes('navigat') || lower.includes('gps') || lower.includes('transit')) return <MapsNavigationIcon />;
  if (lower.includes('code') || lower.includes('dev') || lower.includes('demo') || lower.includes('sdk')) return <LibrariesDemoIcon />;
  
  // Games categories
  if (lower.includes('action')) return <HelicopterIcon />;
  if (lower.includes('sim')) return <SimulationIcon />;
  if (lower.includes('puzzle')) return <PuzzleIcon />;
  if (lower.includes('adventure')) return <AdventureIcon />;
  if (lower.includes('racing')) return <RacingIcon />;
  if (lower.includes('role') || lower.includes('rpg')) return <RolePlayingIcon />;
  if (lower.includes('strat')) return <StrategyIcon />;
  if (lower.includes('sport')) return <SportsIcon />;
  if (lower.includes('entertain')) return <EntertainmentIcon />;
  if (lower.includes('social')) return <SocialIcon />;
  if (lower.includes('product')) return <ProductivityIcon />;
  if (lower.includes('commun')) return <CommunicationIcon />;

  // Default clean multi-tile app category icon (never a star/sparkle)
  return <AppCategoryFallbackIcon />;
}

// -------------------------------------------------------------
// Component Main Implementation
// -------------------------------------------------------------

export default function ExplorePage({ 
  onOpenSearch, 
  onSearchQuery, 
  onAppClick, 
  onCategoryClick,
  onShowLatestReleases
}: ExplorePageProps) {
  const { allAppListings, apps, isLoadingApps, hasInitialSyncCompleted, isPullRefreshing, refreshCatalogue } = useStoreConfig();

  // Scroll and drag refs for smooth edge-to-edge mouse & touch interactions
  const suggestionsScrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSuggestionsRef = useRef(false);
  const startXSuggestionsRef = useRef(0);
  const scrollLeftSuggestionsRef = useRef(0);
  const hasDraggedSuggestionsRef = useRef(false);

  const suggestedAppsScrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSuggestedAppsRef = useRef(false);
  const startXSuggestedAppsRef = useRef(0);
  const scrollLeftSuggestedAppsRef = useRef(0);
  const hasDraggedSuggestedAppsRef = useRef(false);

  const latestScrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingLatestRef = useRef(false);
  const startXLatestRef = useRef(0);
  const scrollLeftLatestRef = useRef(0);
  const hasDraggedLatestRef = useRef(false);

  // Drag handlers factory
  const createDragHandlers = (
    scrollRef: React.RefObject<HTMLDivElement | null>,
    isDraggingRef: React.MutableRefObject<boolean>,
    startXRef: React.MutableRefObject<number>,
    scrollLeftRef: React.MutableRefObject<number>,
    hasDraggedRef: React.MutableRefObject<boolean>
  ) => ({
    onMouseDown: (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      startXRef.current = e.pageX - scrollRef.current.offsetLeft;
      scrollLeftRef.current = scrollRef.current.scrollLeft;
    },
    onMouseLeave: () => {
      isDraggingRef.current = false;
    },
    onMouseUp: () => {
      isDraggingRef.current = false;
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!isDraggingRef.current || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startXRef.current) * 1.5;
      if (Math.abs(walk) > 5) {
        hasDraggedRef.current = true;
      }
      scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    },
  });

  const suggestionsDrag = createDragHandlers(
    suggestionsScrollRef,
    isDraggingSuggestionsRef,
    startXSuggestionsRef,
    scrollLeftSuggestionsRef,
    hasDraggedSuggestionsRef
  );

  const suggestedAppsDrag = createDragHandlers(
    suggestedAppsScrollRef,
    isDraggingSuggestedAppsRef,
    startXSuggestedAppsRef,
    scrollLeftSuggestedAppsRef,
    hasDraggedSuggestedAppsRef
  );

  const latestDrag = createDragHandlers(
    latestScrollRef,
    isDraggingLatestRef,
    startXLatestRef,
    scrollLeftLatestRef,
    hasDraggedLatestRef
  );

  const clientOS = useMemo(() => detectClientOS(), []);
  const prioritizedListings = useMemo(() => {
    return sortAppsByDeviceCompatibility(allAppListings, clientOS);
  }, [allAppListings, clientOS]);

  // Run the App Distribution Algorithm on real database apps
  const distribution = useMemo(() => {
    return computeExploreDistribution(prioritizedListings, apps);
  }, [prioritizedListings, apps]);

  // Split search suggestions into 2 lines for rich native layout presentation
  const { suggestionsLine1, suggestionsLine2 } = useMemo(() => {
    const items = distribution.whatAreYouLookingFor.items || [];
    if (items.length <= 1) {
      return { suggestionsLine1: items, suggestionsLine2: [] };
    }
    const line1: typeof items = [];
    const line2: typeof items = [];
    items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        line1.push(item);
      } else {
        line2.push(item);
      }
    });
    return { suggestionsLine1: line1, suggestionsLine2: line2 };
  }, [distribution.whatAreYouLookingFor.items]);

  const renderSuggestionPill = (item: (typeof distribution.whatAreYouLookingFor.items)[number]) => {
    const itemIcons = item.icons && item.icons.length > 0 
      ? item.icons.filter(icon => Boolean(icon && icon.trim()))
      : item.iconUrl && item.iconUrl.trim() 
        ? [item.iconUrl.trim()] 
        : [];

    return (
      <button
        key={item.id}
        onClick={() => {
          if (!hasDraggedSuggestionsRef.current) {
            onSearchQuery(item.query);
          }
        }}
        className="group shrink-0 h-[46px] pl-1.5 pr-4 rounded-2xl bg-theme-card flex items-center gap-2.5 cursor-pointer text-left hover:bg-theme-hover/70"
      >
        {itemIcons.length > 1 ? (
          <div className="flex -space-x-4 shrink-0 items-center">
            {itemIcons.slice(0, 3).map((icon, idx) => (
              <img
                key={idx}
                src={icon}
                alt=""
                style={{ zIndex: idx + 1 }}
                className="w-8 h-8 rounded-xl object-cover shadow-xs bg-theme-hover border-2 border-theme-card group-hover:border-theme-hover pointer-events-none select-none relative"
              />
            ))}
          </div>
        ) : itemIcons.length === 1 ? (
          <img
            src={itemIcons[0]}
            alt={item.title}
            className="w-8 h-8 rounded-xl object-cover shrink-0 pointer-events-none select-none"
          />
        ) : null}
        <span className="text-[13px] font-medium text-theme-text whitespace-nowrap">
          {item.title}
        </span>
      </button>
    );
  };

  if (isLoadingApps || !hasInitialSyncCompleted || isPullRefreshing) {
    return (
      <PullToRefresh onRefresh={refreshCatalogue} isRefreshing={isPullRefreshing} earlyDismissDurationMs={360} dismissBeforeEnd={true}>
        <ExploreSkeleton />
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh onRefresh={refreshCatalogue} isRefreshing={isPullRefreshing} earlyDismissDurationMs={360} dismissBeforeEnd={true}>
      <div className="flex flex-col min-h-full bg-theme-bg text-theme-text font-sans pb-24 selection:bg-blue-500/30 w-full overflow-x-hidden">
      
      {/* 1. Search suggestions (On top - Multiple overlapping app icons with 2 lines of suggestions) */}
      {distribution.whatAreYouLookingFor.isVisible && (
        <section className="w-full pt-3 pb-4 overflow-hidden">
          <div className="px-2.5 sm:px-4 md:px-6 mb-3">
            <h2 className="text-[17px] font-medium text-theme-text tracking-tight">
              What are you looking for?
            </h2>
          </div>
          
          <div 
            ref={suggestionsScrollRef}
            {...suggestionsDrag}
            className="flex flex-col gap-2.5 overflow-x-auto scrollbar-hide pb-1 px-2.5 sm:px-4 md:px-6 w-full cursor-grab active:cursor-grabbing select-none overscroll-x-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              overscrollBehaviorX: 'contain',
              overscrollBehaviorY: 'auto',
            }}
          >
            {/* 1st line of search suggestions */}
            <div className="flex gap-2.5 w-max">
              {suggestionsLine1.map(renderSuggestionPill)}
            </div>

            {/* 2nd line of search suggestions */}
            {suggestionsLine2.length > 0 && (
              <div className="flex gap-2.5 w-max">
                {suggestionsLine2.map(renderSuggestionPill)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. "Suggested for You" (Squircle App Row - Hidden if < 2 apps) */}
      {distribution.suggestedForYou.isVisible && (
        <section className="w-full pt-2 pb-5 overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-2.5 sm:px-4 md:px-6">
            <div className="flex flex-col">
              <h2 className="text-[17px] font-medium text-theme-text tracking-tight">
                Suggested for you
              </h2>
              <p className="text-xs text-theme-text-muted mt-0.5">
                Based on your downloads
              </p>
            </div>
          </div>

          <div 
            ref={suggestedAppsScrollRef}
            {...suggestedAppsDrag}
            className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 w-full cursor-grab active:cursor-grabbing select-none overscroll-x-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              overscrollBehaviorX: 'contain',
              overscrollBehaviorY: 'auto',
            }}
          >
            {distribution.suggestedForYou.apps.map(app => (
              <div
                key={`suggested-${app.id}`}
                onClick={() => {
                  if (!hasDraggedSuggestedAppsRef.current) {
                    onAppClick(app.id);
                  }
                }}
                className="w-[84px] sm:w-[92px] shrink-0 flex flex-col items-start cursor-pointer select-none group"
              >
                {/* Native Android Squircle Icon without border */}
                <div className="w-[76px] h-[76px] sm:w-[82px] sm:h-[82px] rounded-[20px] overflow-hidden bg-theme-hover shadow-xs mb-2 flex items-center justify-center">
                  {app.iconUrl && app.iconUrl.trim() ? (
                    <img
                      src={app.iconUrl}
                      alt={app.name}
                      className="w-full h-full object-cover pointer-events-none select-none"
                    />
                  ) : (
                    <span className="text-xl font-bold text-blue-500">{app.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* App Name */}
                <span className="text-[12px] font-normal text-theme-text line-clamp-2 leading-[1.25] h-8 mb-1">
                  {app.name}
                </span>

                {/* Rating Tag */}
                <div className="flex items-center gap-1 text-[11px] text-theme-text-muted font-normal">
                  <span>{typeof app.rating === 'number' && app.rating > 0 ? `${app.rating.toFixed(1)}` : '0.0'}</span>
                  <Star className="w-2.5 h-2.5 fill-theme-text text-theme-text" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. "Trending searches" (Where it belonged - Hidden if not enough real app data to complete full UI) */}
      {distribution.trendingSearches.isVisible && (
        <section className="px-2.5 sm:px-4 md:px-6 pt-1 pb-5">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[17px] font-medium text-theme-text tracking-tight">
              Trending searches
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {distribution.trendingSearches.items.slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => onSearchQuery(item.query || item.title)}
                className="py-3 px-4 rounded-2xl bg-theme-card flex items-center justify-between gap-3 cursor-pointer hover:bg-theme-hover/60 active:bg-theme-hover/90 transition-colors group border-0 border-none outline-none"
              >
                {/* Left Column: Title & Metric */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-theme-text group-hover:text-blue-500 transition-colors truncate capitalize">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span>{item.metric}</span>
                    </span>
                    <span className="text-[12px] text-theme-text-muted truncate">
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                {/* Right Column: Deeply Overlapping Icons without borders */}
                <div className="flex -space-x-5.5 shrink-0 items-center pl-3">
                  {item.icons.filter(icon => Boolean(icon && icon.trim())).map((icon, idx) => (
                    <img
                      key={idx}
                      src={icon}
                      alt=""
                      style={{ zIndex: idx + 1 }}
                      className="w-10 h-10 rounded-xl object-cover shadow-xs bg-theme-hover border-0 border-none pointer-events-none select-none relative"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. "Latest releases" (Must-try style with full screen page - Hidden if < 2 apps) */}
      {distribution.latestReleases.isVisible && (
        <section className="w-full pt-2 pb-5 overflow-hidden">
          <div className="flex justify-between items-center mb-3 px-2.5 sm:px-4 md:px-6">
            <button 
              type="button" 
              onClick={onShowLatestReleases} 
              className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none"
            >
              <h2 className="text-[17px] font-medium text-theme-text tracking-tight group-hover:text-blue-500 transition-colors">
                Latest releases
              </h2>
            </button>
            <button 
              type="button" 
              onClick={onShowLatestReleases} 
              className="text-theme-text-muted hover:text-theme-text p-1.5 bg-theme-card hover:bg-theme-hover rounded-full transition-colors cursor-pointer border border-theme-border/20" 
              aria-label="See all latest releases"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div 
            ref={latestScrollRef}
            {...latestDrag}
            className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 w-full cursor-grab active:cursor-grabbing select-none overscroll-x-contain"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              overscrollBehaviorX: 'contain',
              overscrollBehaviorY: 'auto',
            }}
          >
            {distribution.latestReleases.apps.map((app) => (
              <div 
                key={`latest-${app.id}`} 
                onClick={() => {
                  if (!hasDraggedLatestRef.current) {
                    onAppClick(app.id);
                  }
                }} 
                className="w-[104px] shrink-0 flex flex-col cursor-pointer relative select-none group"
              >
                <div className="w-[104px] h-[104px] rounded-[22px] overflow-hidden shadow-xs mb-2 bg-theme-hover flex items-center justify-center">
                  {app.iconUrl && app.iconUrl.trim() ? (
                    <img 
                      src={app.iconUrl} 
                      alt={app.name} 
                      draggable={false} 
                      className="w-full h-full object-cover select-none pointer-events-none" 
                    />
                  ) : (
                    <span className="text-2xl font-bold text-blue-500">{app.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <h4 className="text-theme-text text-xs font-medium leading-tight line-clamp-1 mb-0.5">
                  {app.name}
                </h4>
                <p className="text-[11px] text-theme-text-muted mb-1 truncate">
                  {getUnifiedAppSize(app)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. "You might like" (Responsive Grid derived from real tags & categories - Hidden if < 2 items) */}
      {distribution.youMightLike.isVisible && (
        <section className="px-2.5 sm:px-4 md:px-6 pt-2 pb-5">
          <h2 className="text-[17px] font-medium text-theme-text mb-3 tracking-tight">
            You might like
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {distribution.youMightLike.items.map(item => (
              <div
                key={item.title}
                onClick={() => onSearchQuery(item.query)}
                className="h-[58px] px-4 rounded-2xl bg-theme-card flex items-center justify-between cursor-pointer group hover:bg-theme-hover/60 border-0"
              >
                <span className="text-[14px] font-medium text-theme-text group-hover:text-blue-500 transition-colors truncate pr-2">
                  {item.title}
                </span>
                <Search className="w-4.5 h-4.5 text-theme-text-muted group-hover:text-blue-500 transition-colors shrink-0 stroke-[2]" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. "Explore games" (Categories that have real games - Hidden if < 2 categories) */}
      {distribution.exploreGames.isVisible && (
        <section className="px-2.5 sm:px-4 md:px-6 pt-1 pb-5">
          <h2 className="text-[17px] font-medium text-theme-text mb-3 tracking-tight">
            Explore games
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {distribution.exploreGames.categories.map(cat => (
              <div
                key={cat.name}
                onClick={() => {
                  if (onCategoryClick) {
                    onCategoryClick(cat.query);
                  } else {
                    onSearchQuery(cat.query);
                  }
                }}
                className="h-[64px] px-4 rounded-2xl bg-theme-card flex items-center justify-between cursor-pointer group hover:bg-theme-hover/60 border-0"
              >
                <span className="text-[14px] font-medium text-theme-text group-hover:text-blue-500 transition-colors truncate pr-2">
                  {cat.name}
                </span>
                <div className="shrink-0">
                  {getCategoryIcon(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. "Explore apps" (Categories that have real apps - Hidden if < 2 categories) */}
      {distribution.exploreApps.isVisible && (
        <section className="px-2.5 sm:px-4 md:px-6 pt-1 pb-5">
          <h2 className="text-[17px] font-medium text-theme-text mb-3 tracking-tight">
            Explore apps
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {distribution.exploreApps.categories.map(cat => (
              <div
                key={cat.name}
                onClick={() => {
                  if (onCategoryClick) {
                    onCategoryClick(cat.query);
                  } else {
                    onSearchQuery(cat.query);
                  }
                }}
                className="h-[64px] px-4 rounded-2xl bg-theme-card flex items-center justify-between cursor-pointer group hover:bg-theme-hover/60 border-0"
              >
                <span className="text-[14px] font-medium text-theme-text group-hover:text-blue-500 transition-colors truncate pr-2">
                  {cat.name}
                </span>
                <div className="shrink-0">
                  {getCategoryIcon(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fallback Empty State if total available apps are not enough to show sections */}
      {!distribution.hasEnoughContent && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-theme-card border border-theme-border/40 flex items-center justify-center mb-4 text-theme-text-muted shadow-xs">
            <Search className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-base font-medium text-theme-text mb-1.5">
            Discover apps & games
          </h3>
          <p className="text-xs text-theme-text-muted max-w-xs mb-5 leading-relaxed">
            Curated categories and recommendations will appear here as apps and games are published to the store.
          </p>
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer transition-colors shadow-xs active:scale-95"
            >
              Search the store
            </button>
          )}
        </div>
      )}

      </div>
    </PullToRefresh>
  );
}
