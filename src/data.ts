import { AppListing, AppDetails, SearchTrending, EventItem, RecentSearch, NotificationItem } from './types';

// In-memory registry for app details (populated dynamically from Firestore)
export const appDetailsMock: Record<string, AppDetails> = {};

// Featured Hero App
export const featuredApp: AppListing | null = null;

// Verified Apps in Catalogue (populated dynamically from realtime Firestore)
export const suggestedApps: AppListing[] = [];

// Recommended For You Apps
export const recommendedApps: AppListing[] = [];

// Trending Searches in Explore/Search tab
export const trendingSearches: SearchTrending[] = [
  { id: 'ts-1', title: 'AI Assistant', subtitle: 'Productivity • Rising search' },
  { id: 'ts-2', title: 'Top Free Games', subtitle: 'Action & Arcade' },
  { id: 'ts-3', title: 'Photo & Video Editor', subtitle: 'Creative tools' },
  { id: 'ts-4', title: 'Open Source Utilities', subtitle: 'Tools & Utilities' },
  { id: 'ts-5', title: 'Music & Audio', subtitle: 'Streaming' },
  { id: 'ts-6', title: 'Social & Communication', subtitle: 'Messaging' },
  { id: 'ts-7', title: 'Cloud Storage & Files', subtitle: 'Utilities' },
  { id: 'ts-8', title: 'Productivity Tools', subtitle: 'Office & Tasks' },
  { id: 'ts-9', title: 'Finance & Crypto', subtitle: 'Budgets & Stocks' },
  { id: 'ts-10', title: 'Fitness Tracker', subtitle: 'Health & Workouts' },
];

// Search suggestions
export const searchSuggestedApps: AppListing[] = [];

// Search events
export const searchEvents: EventItem[] = [];

// Recent searches
export const recentSearches: RecentSearch[] = [];

// Top Charts Apps
export const topChartsApps: AppListing[] = [];

// Categories List with Lucide icon keys
export const appCategories = [
  { id: 'cat-art-design', name: 'Art & Design', icon: 'pen-tool' },
  { id: 'cat-auto-vehicles', name: 'Auto & Vehicles', icon: 'car' },
  { id: 'cat-beauty', name: 'Beauty', icon: 'spray-can' },
  { id: 'cat-books-reference', name: 'Books & Reference', icon: 'book-open' },
  { id: 'cat-business', name: 'Business', icon: 'briefcase' },
  { id: 'cat-children', name: 'Children', icon: 'smile' },
  { id: 'cat-comics', name: 'Comics', icon: 'book-marked' },
  { id: 'cat-communication', name: 'Communication', icon: 'message-square' },
  { id: 'cat-dating', name: 'Dating', icon: 'heart' },
  { id: 'cat-education', name: 'Education', icon: 'graduation-cap' },
  { id: 'cat-entertainment', name: 'Entertainment', icon: 'clapperboard' },
  { id: 'cat-events', name: 'Events', icon: 'calendar' },
  { id: 'cat-finance', name: 'Finance', icon: 'wallet' },
  { id: 'cat-food-drink', name: 'Food & Drink', icon: 'utensils' },
  { id: 'cat-games', name: 'Games', icon: 'gamepad-2' },
  { id: 'cat-health-fitness', name: 'Health & Fitness', icon: 'heart-pulse' },
  { id: 'cat-house-home', name: 'House & Home', icon: 'home' },
  { id: 'cat-libraries-demo', name: 'Libraries & Demo', icon: 'code-2' },
  { id: 'cat-lifestyle', name: 'Lifestyle', icon: 'sun' },
  { id: 'cat-maps-navigation', name: 'Maps & Navigation', icon: 'map-pin' },
  { id: 'cat-medical', name: 'Medical', icon: 'stethoscope' },
  { id: 'cat-music-audio', name: 'Music & Audio', icon: 'music' },
  { id: 'cat-news-magazines', name: 'News & Magazines', icon: 'newspaper' },
  { id: 'cat-parenting', name: 'Parenting', icon: 'users' },
  { id: 'cat-personalisation', name: 'Personalisation', icon: 'sliders' },
  { id: 'cat-photography', name: 'Photography', icon: 'camera' },
  { id: 'cat-productivity', name: 'Productivity', icon: 'check-square' },
  { id: 'cat-shopping', name: 'Shopping', icon: 'shopping-bag' },
  { id: 'cat-social', name: 'Social', icon: 'share-2' },
  { id: 'cat-sports', name: 'Sports', icon: 'trophy' },
  { id: 'cat-tools', name: 'Tools', icon: 'wrench' },
  { id: 'cat-travel-local', name: 'Travel & Local', icon: 'plane' },
  { id: 'cat-video-players', name: 'Video Players & Editors', icon: 'video' },
  { id: 'cat-weather', name: 'Weather', icon: 'cloud-sun' },
];

// Similar Apps List
export const similarAppsList: AppListing[] = [];

// Notifications List
export const notificationsList: NotificationItem[] = [];




