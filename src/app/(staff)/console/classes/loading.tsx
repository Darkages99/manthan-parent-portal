import { SkeletonHeader, CardGridSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading classes">
      <SkeletonHeader withSubtitle />
      <CardGridSkeleton count={9} />
    </div>
  );
}
