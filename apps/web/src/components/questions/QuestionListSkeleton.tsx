export function QuestionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border bg-surface p-4"
        >
          <div className="mb-2 flex gap-2">
            <div className="h-5 w-14 rounded-full bg-border" />
            <div className="h-5 w-24 rounded bg-border" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-border" />
            <div className="h-4 w-3/4 rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
