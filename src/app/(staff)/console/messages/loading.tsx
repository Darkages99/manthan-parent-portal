import { SkeletonHeader, ListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading messages">
      <SkeletonHeader withSubtitle />
      <ListSkeleton rows={5} />
    </div>
  );
}
