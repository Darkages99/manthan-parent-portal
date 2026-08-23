import { SkeletonHeader, CardGridSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading PTMs">
      <SkeletonHeader withSubtitle />
      <div className="h-40 animate-pulse rounded-sm border border-hairline bg-mist" />
      <CardGridSkeleton />
    </div>
  );
}
