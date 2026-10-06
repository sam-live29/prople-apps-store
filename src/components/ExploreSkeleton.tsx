import React from 'react';

export default function ExploreSkeleton() {
  return (
    <div className="flex flex-col bg-theme-bg min-h-[100dvh] w-full font-sans pb-24 overflow-x-hidden animate-pulse select-none">
      
      {/* 1. "What are you looking for?" (Dual Line Search Suggestions) */}
      <section className="w-full pt-3 pb-4 overflow-hidden">
        <div className="px-2.5 sm:px-4 md:px-6 mb-3">
          <div className="h-[20px] sm:h-[22px] w-52 sm:w-60 rounded-md bg-theme-hover" />
        </div>

        <div className="flex flex-col gap-2.5 overflow-x-auto scrollbar-hide pb-1 px-2.5 sm:px-4 md:px-6 w-full">
          {/* Row 1 */}
          <div className="flex gap-2.5 w-max">
            {[140, 160, 150, 170, 130].map((width, idx) => (
              <div
                key={idx}
                style={{ width: `${width + 60}px` }}
                className="h-[46px] pl-2 pr-4 rounded-full bg-theme-card flex items-center gap-2.5 shrink-0 shadow-xs border-0"
              >
                <div className="flex -space-x-3 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-theme-hover" />
                  <div className="w-8 h-8 rounded-full bg-theme-hover/80" />
                  <div className="w-8 h-8 rounded-full bg-theme-hover/60" />
                </div>
                <div className="h-3.5 w-full rounded bg-theme-hover/80" />
              </div>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex gap-2.5 w-max">
            {[150, 130, 165, 145, 155].map((width, idx) => (
              <div
                key={idx}
                style={{ width: `${width + 60}px` }}
                className="h-[46px] pl-2 pr-4 rounded-full bg-theme-card flex items-center gap-2.5 shrink-0 shadow-xs border-0"
              >
                <div className="flex -space-x-3 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-theme-hover" />
                  <div className="w-8 h-8 rounded-full bg-theme-hover/80" />
                  <div className="w-8 h-8 rounded-full bg-theme-hover/60" />
                </div>
                <div className="h-3.5 w-full rounded bg-theme-hover/80" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. "Suggested for you" (Squircle App Row) */}
      <section className="w-full pt-2 pb-5 overflow-hidden">
        <div className="flex items-center justify-between mb-3 px-2.5 sm:px-4 md:px-6">
          <div className="flex flex-col space-y-1">
            <div className="h-[20px] sm:h-[22px] w-36 sm:w-44 rounded-md bg-theme-hover" />
            <div className="h-3 w-28 sm:w-32 rounded-md bg-theme-hover/70" />
          </div>
        </div>

        <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 w-full">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="w-[84px] sm:w-[92px] shrink-0 flex flex-col items-start"
            >
              <div className="w-[76px] h-[76px] sm:w-[82px] sm:h-[82px] rounded-[20px] bg-theme-hover shadow-xs mb-2 shrink-0" />
              <div className="h-3.5 w-20 rounded bg-theme-hover mb-1" />
              <div className="flex items-center gap-1 w-full">
                <div className="h-3 w-7 rounded bg-theme-hover/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-theme-hover/60 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. "Trending searches" */}
      <section className="px-2.5 sm:px-4 md:px-6 pt-1 pb-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="h-[20px] sm:h-[22px] w-40 sm:w-48 rounded-md bg-theme-hover" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="py-3 px-4 rounded-2xl bg-theme-card flex items-center justify-between gap-3 shadow-xs border-0"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-32 rounded bg-theme-hover" />
                <div className="h-3 w-40 rounded bg-theme-hover/70" />
              </div>
              <div className="flex -space-x-5.5 shrink-0 items-center pl-3">
                <div className="w-10 h-10 rounded-xl bg-theme-hover shadow-xs" />
                <div className="w-10 h-10 rounded-xl bg-theme-hover/80 shadow-xs" />
                <div className="w-10 h-10 rounded-xl bg-theme-hover/60 shadow-xs" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. "Latest releases" */}
      <section className="w-full pt-2 pb-5 overflow-hidden">
        <div className="flex justify-between items-center mb-3 px-2.5 sm:px-4 md:px-6">
          <div className="h-[20px] sm:h-[22px] w-36 sm:w-44 rounded-md bg-theme-hover" />
          <div className="w-7 h-7 rounded-full bg-theme-card border border-theme-border/20 shrink-0" />
        </div>

        <div className="flex gap-3.5 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 px-2.5 sm:px-4 md:px-6 w-full">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="w-[104px] shrink-0 flex flex-col"
            >
              <div className="w-[104px] h-[104px] rounded-[22px] bg-theme-hover shadow-xs mb-2 shrink-0" />
              <div className="h-3.5 w-20 rounded bg-theme-hover mb-1" />
              <div className="h-3 w-12 rounded bg-theme-hover/60" />
            </div>
          ))}
        </div>
      </section>

      {/* 5. "You might like" */}
      <section className="px-2.5 sm:px-4 md:px-6 pt-2 pb-5">
        <div className="h-[20px] sm:h-[22px] w-36 sm:w-44 rounded-md bg-theme-hover mb-3" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((idx) => (
            <div
              key={idx}
              className="h-[58px] px-4 rounded-2xl bg-theme-card flex items-center justify-between shadow-xs border-0"
            >
              <div className="h-4 w-24 sm:w-28 rounded bg-theme-hover" />
              <div className="w-4.5 h-4.5 rounded-full bg-theme-hover/70 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* 6. "Explore games" */}
      <section className="px-2.5 sm:px-4 md:px-6 pt-1 pb-5">
        <div className="h-[20px] sm:h-[22px] w-36 sm:w-44 rounded-md bg-theme-hover mb-3" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
            <div
              key={idx}
              className="h-[64px] px-4 rounded-2xl bg-theme-card flex items-center justify-between shadow-xs border-0"
            >
              <div className="h-4 w-20 sm:w-24 rounded bg-theme-hover" />
              <div className="w-9 h-9 rounded-xl bg-theme-hover shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* 7. "Explore apps" */}
      <section className="px-2.5 sm:px-4 md:px-6 pt-1 pb-5">
        <div className="h-[20px] sm:h-[22px] w-36 sm:w-44 rounded-md bg-theme-hover mb-3" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
            <div
              key={idx}
              className="h-[64px] px-4 rounded-2xl bg-theme-card flex items-center justify-between shadow-xs border-0"
            >
              <div className="h-4 w-20 sm:w-24 rounded bg-theme-hover" />
              <div className="w-9 h-9 rounded-xl bg-theme-hover shrink-0" />
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
