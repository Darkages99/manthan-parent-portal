import { SkeletonHeader, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading staff">
      <SkeletonHeader withSubtitle />
      <div className="h-40 animate-pulse rounded-sm border border-hairline bg-mist" />
      <TableSkeleton rows={6} />
    </div>
  );
}
