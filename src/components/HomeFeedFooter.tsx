import React from 'react';
import { appCategories } from '../data';
import { slugifyAppName } from '../utils/shareUtils';

interface HomeFeedFooterProps {
  onCategoryClick?: (categoryId: string) => void;
  onNavigateToTopCharts?: () => void;
  onNavigateToCategories?: () => void;
}

export default function HomeFeedFooter({
  onCategoryClick,
}: HomeFeedFooterProps) {
  // Show a selection of popular categories
  const previewCategories = appCategories.slice(0, 10);

  return (
    <footer className="w-full pt-4 pb-12 px-2 sm:px-4 mt-2 flex flex-col items-center select-none text-center">
      {/* Explore more categories title */}
      <h3 className="text-sm font-semibold text-theme-text mb-3">
        Explore more categories
      </h3>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        {previewCategories.map((cat) => (
          <a
            key={cat.id}
            href={`/categories/${encodeURIComponent(slugifyAppName(cat.name))}`}
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                onCategoryClick?.(cat.id);
              }
            }}
            className="px-3.5 py-1.5 rounded-full bg-theme-card hover:bg-theme-hover border-0 border-none text-theme-text text-xs font-medium transition-all active:scale-95 cursor-pointer no-underline inline-block"
          >
            {cat.name}
          </a>
        ))}
      </div>
    </footer>
  );
}
