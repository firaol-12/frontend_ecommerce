"use client";

import { useEffect } from "react";
import ErrorState from "../components/error-state";

// Dashboard-scoped error boundary. Catches render/runtime errors from the
// dashboard pages while keeping the overall app shell usable — offers a retry
// without a full reload.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <ErrorState
        code="Dashboard error"
        title="We couldn't load this section"
        description="Something broke while rendering this part of the dashboard. It has been logged — try again, or head back home if the problem persists."
        details={error.message}
        primaryAction={{ label: "Try again", onClick: () => reset() }}
        secondaryAction={{ label: "Back to home", href: "/" }}
        variant="danger"
      />
    </div>
  );
}
