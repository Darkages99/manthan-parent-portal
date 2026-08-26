"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { recalculateStorageUsage } from "@/app/(staff)/console/storage/actions";
import { Button } from "./button";
import { useToast } from "./toast-provider";

export function RecalculateStorageButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function run() {
    startTransition(async () => {
      try {
        await recalculateStorageUsage();
        toast.success("Storage usage updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't recalculate");
      }
    });
  }

  return (
    <Button onClick={run} loading={isPending} className="px-4 py-2.5">
      Recalculate now
    </Button>
  );
}
