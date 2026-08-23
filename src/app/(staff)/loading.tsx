// Instant loading fallback shown while a staff console route streams in.
import { SkeletonHeader, CardGridSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      <SkeletonHeader />
      <CardGridSkeleton />
    </div>
  );
}
