import { AppListing } from '../types';

export type StoreSectionType = 'column' | 'landscape' | 'video';

export interface DynamicStoreSection {
  id: string;
  type: StoreSectionType;
  title: string;
  tag: string;
  apps: AppListing[];
  clusterKey: string;
}

/**
 * Derives a dynamic, human-friendly marketplace section title and tag
 * strictly based on the actual apps present in the collection.
 */
export function deriveDynamicSectionTitle(
  apps: AppListing[],
  sectionType: StoreSectionType,
  waveIndex: number = 0,
  themeHint?: string
): { title: string; subtitle?: string; tag: string } {
  if (!apps || apps.length === 0) {
    return { title: 'Featured Applications', subtitle: 'Featured', tag: 'Apps • Verified' };
  }

  // 1. Analyze dominant category
  const categoryCounts = new Map<string, number>();
  let totalRating = 0;
  let ratedCount = 0;
  const tagCounts = new Map<string, number>();
  let hasVideoCount = 0;
  let hasOfflineCount = 0;

  apps.forEach(app => {
    const cat = (app.category || '').trim();
    if (cat) {
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }
    if (app.rating && app.rating > 0) {
      totalRating += app.rating;
      ratedCount++;
    }
    const tags = ((app as any).tags || []) as string[];
    tags.forEach(t => {
      const lower = t.toLowerCase();
      tagCounts.set(lower, (tagCounts.get(lower) || 0) + 1);
      if (lower.includes('offline')) hasOfflineCount++;
    });
    if ((app as any).promoVideoUrl || app.featureGraphicUrl) {
      hasVideoCount++;
    }
  });

  // Sort categories by frequency
  const sortedCategories = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const primaryCat = sortedCategories.length > 0 ? sortedCategories[0][0] : 'Featured';
  const secondaryCat = sortedCategories.length > 1 ? sortedCategories[1][0] : '';
  const avgRating = ratedCount > 0 ? (totalRating / ratedCount) : 0;

  // Find top tag that is informative
  const sortedTags = Array.from(tagCounts.entries())
    .filter(([t]) => !['app', 'game', 'android', 'apk', 'free'].includes(t))
    .sort((a, b) => b[1] - a[1]);
  const topTag = sortedTags.length > 0 ? sortedTags[0][0] : '';

  const catLower = primaryCat.toLowerCase();
  const isGame = catLower.includes('game') || catLower.includes('action') || catLower.includes('arcade') ||
    catLower.includes('puzzle') || catLower.includes('strategy') || catLower.includes('simulation') ||
    catLower.includes('role') || catLower.includes('racing') || catLower.includes('adventure');

  // Title variations array based on content
  let titleOptions: string[] = [];

  let defaultSubtitle = primaryCat;

  if (themeHint === 'offline' || hasOfflineCount >= Math.ceil(apps.length / 3)) {
    titleOptions = [
      `Play Offline: ${primaryCat} Games`,
      `Offline ${primaryCat} Favorites`,
      `No Wi-Fi Needed: ${primaryCat}`,
      `Relaxing Offline ${primaryCat} Hits`
    ];
  } else if (themeHint === 'top_rated' || avgRating >= 4.4) {
    titleOptions = [
      'Top Rated Apps & Games',
      `Top Rated ${primaryCat} ${isGame ? 'Games' : 'Apps'}`,
      `Players' Choice: ${primaryCat}`,
      `Community Favorites: ${primaryCat}`
    ];
    defaultSubtitle = '4.0+ ★ based on player reviews';
  } else if (catLower.includes('productivity') || catLower.includes('business') || catLower.includes('work') || catLower.includes('office')) {
    titleOptions = [
      'Stay organized & get things done',
      'Tools to organize your life & work',
      'Focus, workflow & get things done',
      'Essential productivity tools for you'
    ];
    defaultSubtitle = 'Productivity';
  } else if (catLower.includes('tool') || catLower.includes('utility') || catLower.includes('utilities')) {
    titleOptions = [
      'Tools to simplify everyday tasks',
      'Handy utilities & everyday tools',
      'Useful tools to simplify your day',
      'Everyday tools you can rely on'
    ];
    defaultSubtitle = 'Tools';
  } else if (catLower.includes('music') || catLower.includes('audio') || catLower.includes('podcast')) {
    titleOptions = [
      'Listen to music, podcasts & audio',
      'Top music, audio & podcast picks',
      'Soundtracks, beats & podcast shows',
      'Listen to your favorite sounds'
    ];
    defaultSubtitle = 'Music & Audio';
  } else if (catLower.includes('entertainment') || catLower.includes('video') || catLower.includes('movie') || catLower.includes('stream') || catLower.includes('tv')) {
    titleOptions = [
      'Stream movies, shows & videos',
      'Top streaming, videos & entertainment',
      'Binge-watch movies & popular series',
      'Entertainment picks for your downtime'
    ];
    defaultSubtitle = 'Entertainment';
  } else if (catLower.includes('communication') || catLower.includes('social') || catLower.includes('message') || catLower.includes('chat')) {
    titleOptions = [
      'Stay connected with friends and family',
      'Chat, call & stay connected',
      'Connect with friends, family & groups',
      'Social picks to stay in touch'
    ];
    defaultSubtitle = 'Communication';
  } else if (catLower.includes('action') || catLower.includes('racing') || catLower.includes('arcade') || catLower.includes('fighting')) {
    titleOptions = [
      'Action-packed games you might enjoy',
      'High-octane action & adventure games',
      'Fast-paced games to test your reflexes',
      'Exciting action & thrilling battles'
    ];
    defaultSubtitle = 'Action';
  } else if (catLower.includes('puzzle') || catLower.includes('casual') || catLower.includes('brain') || catLower.includes('trivia') || catLower.includes('board') || catLower.includes('card') || catLower.includes('word')) {
    titleOptions = [
      'Relax with puzzles & casual games',
      'Unwind with casual brain challenges',
      'Relaxing puzzles to pass the time',
      'Fun casual games & smart puzzles'
    ];
    defaultSubtitle = 'Casual';
  } else if (catLower.includes('finance') || catLower.includes('wallet') || catLower.includes('money')) {
    titleOptions = [
      'Manage your money & investments',
      'Smart budgeting, finance & wallets',
      'Manage accounts & daily finance',
      'Financial tools to track your goals'
    ];
    defaultSubtitle = 'Finance';
  } else if (catLower.includes('health') || catLower.includes('fitness') || catLower.includes('workout')) {
    titleOptions = [
      'Build healthy habits & stay fit',
      'Daily wellness, fitness & workout picks',
      'Stay active & track your progress',
      'Healthy routines for your day'
    ];
    defaultSubtitle = 'Health & Fitness';
  } else if (catLower.includes('art') || catLower.includes('photo') || catLower.includes('video') || catLower.includes('design')) {
    titleOptions = [
      'Capture moments & unleash creativity',
      'Creative studios & photo tools',
      'Photo, video & design picks',
      'Capture & create with top tools'
    ];
    defaultSubtitle = 'Photography';
  } else if (secondaryCat && sortedCategories[0][1] < apps.length * 0.7) {
    titleOptions = [
      `Top Picks in ${primaryCat} & ${secondaryCat}`,
      `Discover ${primaryCat} & ${secondaryCat}`,
      `Popular ${primaryCat} Downloads`,
      `Recommended for you in ${primaryCat}`
    ];
  } else {
    titleOptions = [
      isGame ? `Exciting ${primaryCat} games you might enjoy` : `Great ${primaryCat} apps tailored for you`,
      `Popular in ${primaryCat}`,
      `Discover New ${primaryCat} Favorites`,
      `Recommended for you in ${primaryCat}`
    ];
  }

  // Adjust wording by UI Archetype for visual harmony
  if (sectionType === 'video') {
    const videoPrefixes = ['Watch & Play: ', 'Highlights: ', 'Trailers & Gameplay: '];
    const prefix = videoPrefixes[waveIndex % videoPrefixes.length];
    // If not already prefixed, we can keep the title crisp and clean
    if (waveIndex > 1) {
      titleOptions = titleOptions.map(t => `${t} (Watch & Play)`);
    }
  }

  const selectedTitle = titleOptions[waveIndex % titleOptions.length];

  // Dynamic tag construction
  const capitalizedTag = topTag ? topTag.charAt(0).toUpperCase() + topTag.slice(1) : (isGame ? 'Verified Game' : 'Verified App');
  const ratingStr = avgRating >= 4.0 ? `${avgRating.toFixed(1)} ★` : 'Top Pick';
  const tag = `${primaryCat} • ${capitalizedTag} • ${ratingStr}`;

  return { title: selectedTitle, subtitle: defaultSubtitle, tag };
}

/**
 * Builds coherent app clusters from the full store catalogue.
 */
export function clusterStoreApps(
  allApps: AppListing[],
  appsMap: Record<string, AppListing>
): {
  categoryClusters: Map<string, AppListing[]>;
  offlineCluster: AppListing[];
  topRatedCluster: AppListing[];
  mediaRichCluster: AppListing[];
  popularCluster: AppListing[];
} {
  const categoryClusters = new Map<string, AppListing[]>();
  const offlineCluster: AppListing[] = [];
  const topRatedCluster: AppListing[] = [];
  const mediaRichCluster: AppListing[] = [];
  const popularCluster: AppListing[] = [...allApps].sort((a, b) => (b.downloadsCount || 0) - (a.downloadsCount || 0));

  allApps.forEach(app => {
    const full = appsMap[app.id] || app;
    const cat = (app.category || full.category || '').trim();
    if (cat) {
      const list = categoryClusters.get(cat) || [];
      list.push(app);
      categoryClusters.set(cat, list);
    }

    const tags = (((app as any).tags || (full as any)?.tags || []) as string[]).map(t => t.toLowerCase());
    const nameLower = app.name.toLowerCase();

    // Offline & Casual
    if (
      tags.includes('offline') ||
      nameLower.includes('offline') ||
      tags.includes('casual') ||
      tags.includes('arcade') ||
      tags.includes('runner')
    ) {
      offlineCluster.push(app);
    }

    // Top rated
    const r = app.rating || full.rating || 0;
    if (r >= 4.0) {
      topRatedCluster.push(app);
    }

    // Media rich (trailer or graphic)
    if (full.promoVideoUrl || (full as any).videoThumbnailUrl || full.featureGraphicUrl || (full.screenshots && full.screenshots.length > 0)) {
      mediaRichCluster.push(app);
    }
  });

  return {
    categoryClusters,
    offlineCluster,
    topRatedCluster,
    mediaRichCluster,
    popularCluster
  };
}

/**
 * Generates an endless, perfectly stable series of dynamic sections
 * cycling across the 3 UI archetypes ('column', 'landscape', 'video')
 * with completely dynamic titles matching the apps inside each section.
 */
export function generateInfiniteFeedSections(
  allApps: AppListing[],
  appsMap: Record<string, AppListing>,
  totalSectionsNeeded: number
): DynamicStoreSection[] {
  if (!allApps || allApps.length === 0) return [];

  const {
    categoryClusters,
    offlineCluster,
    topRatedCluster,
    mediaRichCluster,
    popularCluster
  } = clusterStoreApps(allApps, appsMap);

  // Collect distinct themes/clusters to rotate through
  type ClusterCandidate = {
    key: string;
    apps: AppListing[];
    preferredType?: StoreSectionType;
    hint?: string;
  };

  const candidatePool: ClusterCandidate[] = [];

  // 1. Media Rich cluster (great for video cards)
  if (mediaRichCluster.length >= 2) {
    candidatePool.push({
      key: 'media-highlights',
      apps: mediaRichCluster,
      preferredType: 'video',
      hint: 'media'
    });
  }

  // 2. Add each category cluster with >= 2 apps
  categoryClusters.forEach((apps, catName) => {
    if (apps.length >= 2) {
      const catLower = catName.toLowerCase();
      let pref: StoreSectionType = 'column';
      if (catLower.includes('action') || catLower.includes('racing') || catLower.includes('arcade')) {
        pref = 'video';
      } else if (catLower.includes('simulation') || catLower.includes('rpg') || catLower.includes('fantasy') || catLower.includes('adventure')) {
        pref = 'landscape';
      }
      candidatePool.push({
        key: `cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        apps,
        preferredType: pref
      });
    }
  });

  // 3. Offline cluster
  if (offlineCluster.length >= 2) {
    candidatePool.push({
      key: 'offline-picks',
      apps: offlineCluster,
      preferredType: 'column',
      hint: 'offline'
    });
  }

  // 4. Top rated cluster
  if (topRatedCluster.length >= 2) {
    candidatePool.push({
      key: 'top-rated',
      apps: topRatedCluster,
      preferredType: 'landscape',
      hint: 'top_rated'
    });
  }

  // 5. Popular cluster
  if (popularCluster.length >= 2) {
    candidatePool.push({
      key: 'popular-trending',
      apps: popularCluster,
      preferredType: 'column'
    });
  }

  // Fallback: If candidatePool is empty or small, use partitioned allApps chunks
  if (candidatePool.length === 0) {
    candidatePool.push({
      key: 'all-catalog',
      apps: allApps,
      preferredType: 'column'
    });
  }

  // Repeating UI archetype sequence
  const sectionTypeSequence: StoreSectionType[] = ['column', 'landscape', 'video'];

  const results: DynamicStoreSection[] = [];

  for (let secIndex = 0; secIndex < totalSectionsNeeded; secIndex++) {
    const clusterIdx = secIndex % candidatePool.length;
    const waveNumber = Math.floor(secIndex / candidatePool.length);
    const candidate = candidatePool[clusterIdx];

    // Alternate section type smoothly, respecting preferred type on earlier waves
    const defaultSeqType = sectionTypeSequence[secIndex % sectionTypeSequence.length];
    const sectionType: StoreSectionType = (waveNumber === 0 && candidate.preferredType) 
      ? candidate.preferredType 
      : defaultSeqType;

    // Rotate apps order slightly on repeated waves so the front cards change dynamically
    const rotationOffset = (waveNumber * 3) % candidate.apps.length;
    const rotatedApps = [
      ...candidate.apps.slice(rotationOffset),
      ...candidate.apps.slice(0, rotationOffset)
    ];

    // Ensure we have enough apps for visual richness (min 4 for carousels, min 6 for 3-row column)
    let sectionApps = rotatedApps;
    if (sectionApps.length < (sectionType === 'column' ? 6 : 4) && allApps.length > sectionApps.length) {
      // Append other apps gracefully to guarantee full shelf width
      const existingIds = new Set(sectionApps.map(a => a.id));
      const fillers = allApps.filter(a => !existingIds.has(a.id));
      sectionApps = [...sectionApps, ...fillers];
    }

    const { title, tag } = deriveDynamicSectionTitle(sectionApps, sectionType, waveNumber, candidate.hint);

    results.push({
      id: `dyn-feed-${candidate.key}-w${waveNumber}-t${secIndex}-${sectionType}`,
      type: sectionType,
      title,
      tag,
      apps: sectionApps,
      clusterKey: candidate.key
    });
  }

  return results;
}
