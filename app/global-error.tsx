"use client";

import { useEffect } from "react";
import ErrorState from "./components/error-state";

// Global error boundary — the last line of defense. Only fires when an error
// escapes the root layout itself, so this component MUST render its own
// <html> and <body> tags (there is no layout around it at that point).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50">
        <ErrorState
          code="Critical error"
          title="Something went seriously wrong"
          description="The application failed to start. It has been logged — try again, or head back home if the problem persists."
          details={error.message}
          primaryAction={{ label: "Try again", onClick: () => reset() }}
          secondaryAction={{ label: "Back to home", href: "/" }}
          variant="danger"
        />
      </body>
    </html>
  );
}
