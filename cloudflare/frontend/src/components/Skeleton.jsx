// Skeleton loaders. Shimmer animation defined in styles/index.css.
// Use <SkeletonCard /> for feed lists, <SkeletonDomain /> for the home grid.
// Sharp, flat blocks to match the Swiss grid.

export function SkeletonCard() {
  return (
    <div className="bg-elev border border-border p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="h-3 w-10 bg-border skeleton" />
        <div className="h-3 w-24 bg-border skeleton" />
        <div className="flex-1" />
        <div className="h-3 w-8 bg-border skeleton" />
      </div>
      <div className="h-5 w-3/4 bg-border skeleton mb-2.5" />
      <div className="h-3 w-full bg-border skeleton mb-1.5" />
      <div className="h-3 w-2/3 bg-border skeleton mb-4" />
      {/* quiet action-row hint */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <div className="h-3 w-10 bg-border skeleton" />
        <div className="flex-1" />
        <div className="h-4 w-4 bg-border skeleton" />
        <div className="h-4 w-4 bg-border skeleton" />
        <div className="h-4 w-4 bg-border skeleton" />
      </div>
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

// Full home shell: shelf overview, the type-pill row, and the domain grid.
// Mirrors the live Home layout so the load -> content swap doesn't jump.
export function SkeletonHome({ n = 8 }) {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <div className="h-3 w-20 bg-border skeleton mb-3" />
        <div className="h-8 w-56 bg-border skeleton mb-3" />
        <div className="h-3 w-40 bg-border skeleton" />
      </div>

      {/* start-reading card */}
      <div className="flex items-center gap-4 mb-9 sm:mb-11 bg-elev border border-border rounded-xl shadow-soft p-5 sm:p-6">
        <div className="w-7 h-7 bg-border skeleton shrink-0" />
        <div className="flex-1">
          <div className="h-3 w-16 bg-border skeleton mb-2.5" />
          <div className="h-5 w-40 bg-border skeleton mb-2" />
          <div className="h-3 w-24 bg-border skeleton" />
        </div>
      </div>

      <div className="mb-8 sm:mb-10">
        <div className="h-3 w-36 bg-border skeleton mb-3 pb-2 border-b border-border" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-border skeleton" />
          ))}
        </div>
      </div>

      <div className="h-3 w-24 bg-border skeleton mb-3 pb-2 border-b border-border" />
      <SkeletonGrid n={n} />
    </div>
  );
}
