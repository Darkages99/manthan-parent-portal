"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

export default function StaffError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      onRetry={unstable_retry}
      message="We couldn't load this console view. This is usually temporary — try again in a moment."
      digest={error.digest}
    />
  );
}
