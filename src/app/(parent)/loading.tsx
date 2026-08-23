// Instant loading fallback shown while a parent route streams in.
import { SkeletonHeader, ListSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      <SkeletonHeader withSubtitle />
      <ListSkeleton rows={4} />
    </div>
  );
}
