"use client";

import { useEffect } from "react";
import ErrorState from "./components/error-state";

// Next.js route-level error boundary: catches render/runtime errors in the
// dashboard-free app shell and offers a retry without a full reload.
export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <ErrorState
      code="Something went wrong"
      title="An unexpected error occurred"
      description="We hit a snag while loading this page. It has been logged — try again, or head back home if the problem persists."
      details={error.message}
      primaryAction={{ label: "Try again", onClick: () => reset() }}
      secondaryAction={{ label: "Back to home", href: "/" }}
      variant="danger"
    />
  );
}
