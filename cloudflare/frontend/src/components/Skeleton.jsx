// Skeleton loaders. Shimmer animation defined in styles/index.css.
// Use <SkeletonCard /> for feed lists, <SkeletonDomain /> for the home grid.

export function SkeletonCard() {
  return (
    <div className="bg-elev border border-border rounded-xl p-4 shadow-soft">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-3 w-10 bg-border rounded skeleton" />
        <div className="h-3 w-24 bg-border rounded skeleton" />
        <div className="h-3 w-8 bg-border rounded skeleton" />
      </div>
      <div className="h-5 w-3/4 bg-border rounded skeleton mb-3" />
      <div className="h-3 w-full bg-border rounded skeleton mb-1.5" />
      <div className="h-3 w-2/3 bg-border rounded skeleton mb-4" />
      <div className="h-32 w-full bg-border rounded skeleton" />
    </div>
  );
}

export function SkeletonDomain() {
  return (
    <div className="bg-elev border border-border rounded-xl aspect-square p-3 shadow-soft flex flex-col">
      <div className="w-6 h-6 bg-border rounded skeleton" />
      <div className="flex-1" />
      <div className="h-4 w-2/3 bg-border rounded skeleton mb-1" />
      <div className="h-3 w-12 bg-border rounded skeleton" />
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
    <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: n }).map((_, i) => <SkeletonDomain key={i} />)}
    </div>
  );
}
