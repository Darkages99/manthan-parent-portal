import { SkeletonHeader, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading attendance">
      <SkeletonHeader withSubtitle />
      <TableSkeleton rows={8} />
    </div>
  );
}
