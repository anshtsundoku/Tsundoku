// Skeleton loaders. Shimmer animation defined in styles/index.css.
// Use <SkeletonCard /> for feed lists, <SkeletonDomain /> for the home grid.
// Sharp, flat blocks to match the Swiss grid.

export function SkeletonCard() {
  return (
    <div className="bg-elev border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-3 w-10 bg-border skeleton" />
        <div className="h-3 w-24 bg-border skeleton" />
        <div className="h-3 w-8 bg-border skeleton" />
      </div>
      <div className="h-5 w-3/4 bg-border skeleton mb-3" />
      <div className="h-3 w-full bg-border skeleton mb-1.5" />
      <div className="h-3 w-2/3 bg-border skeleton mb-4" />
      <div className="h-32 w-full bg-border skeleton" />
    </div>
  );
}

export function SkeletonDomain() {
  return (
    <div className="domain-cell bg-elev border-r border-b border-line aspect-square p-4 flex flex-col">
      <div className="w-6 h-6 bg-border skeleton" />
      <div className="flex-1" />
      <div className="h-4 w-2/3 bg-border skeleton mb-1.5" />
      <div className="h-3 w-12 bg-border skeleton" />
    </div>
  );
}

export function SkeletonList({ n = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="domain-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-l border-line">
      {Array.from({ length: n }).map((_, i) => <SkeletonDomain key={i} />)}
    </div>
  );
}
