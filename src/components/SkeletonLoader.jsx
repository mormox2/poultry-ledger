import React from 'react';

export default function SkeletonLoader() {
  return (
    <div className="space-y-8 animate-pulse text-right">
      {/* HEADER ROW SKELETON */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-850/60 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="space-y-2.5 w-full sm:w-1/3">
          <div className="h-6 bg-slate-800 rounded-lg w-3/4 ml-auto"></div>
          <div className="h-3 bg-slate-800/60 rounded-md w-5/6 ml-auto"></div>
        </div>
        <div className="h-10 bg-slate-800 rounded-xl w-full sm:w-36"></div>
      </div>

      {/* SEARCH AND FILTERS BAR SKELETON */}
      <div className="w-full max-w-md h-10 bg-slate-900/40 border border-slate-850/60 rounded-xl"></div>

      {/* CARDS GRID SKELETON */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i} 
            className="border border-slate-850/60 bg-slate-900/30 backdrop-blur-sm rounded-2xl p-5 shadow-lg flex flex-col justify-between h-[230px]"
          >
            <div>
              {/* Top layout skeleton */}
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 rounded-full bg-slate-800"></div>
                <div className="flex gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800"></div>
                  <div className="w-8 h-8 rounded-lg bg-slate-800"></div>
                </div>
              </div>

              {/* Name and Badges skeleton */}
              <div className="space-y-3">
                <div className="h-4 bg-slate-800 rounded-md w-1/2 ml-auto"></div>
                <div className="space-y-2 mt-4">
                  <div className="h-3 bg-slate-800/60 rounded-md w-3/4 ml-auto"></div>
                  <div className="h-3 bg-slate-800/60 rounded-md w-2/3 ml-auto"></div>
                </div>
              </div>
            </div>

            {/* Footer totals skeleton */}
            <div className="grid grid-cols-3 gap-2 pt-3 mt-6 border-t border-slate-850/60 text-center">
              <div className="space-y-1">
                <div className="h-2 bg-slate-800/40 rounded-sm w-3/4 mx-auto"></div>
                <div className="h-3 bg-slate-800 rounded-md w-2/3 mx-auto"></div>
              </div>
              <div className="space-y-1">
                <div className="h-2 bg-slate-800/40 rounded-sm w-3/4 mx-auto"></div>
                <div className="h-3 bg-slate-800 rounded-md w-2/3 mx-auto"></div>
              </div>
              <div className="space-y-1">
                <div className="h-2 bg-slate-800/40 rounded-sm w-3/4 mx-auto"></div>
                <div className="h-3 bg-slate-800 rounded-md w-2/3 mx-auto"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
