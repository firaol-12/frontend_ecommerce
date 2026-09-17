// Reusable modern error display. Used by the 404 page, the global error
// boundary, and in-page failures (e.g. "Product not found").

import Link from "next/link";

type Action = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type ErrorStateProps = {
  /** Eyebrow text above the title, e.g. "404 — Page not found". */
  code?: string;
  title: string;
  description?: string;
  /**
   * Optional technical details (e.g. the underlying error message) rendered
   * GitHub-style in a monospace box so users/devs can see what went wrong.
   */
  details?: string;
  /** Primary button. Defaults to "Back to home" when omitted. */
  primaryAction?: Action;
  /** Optional secondary button (rendered as an outline button). */
  secondaryAction?: Action;
  /** Visual variant: "warning" (amber) or "danger" (rose). */
  variant?: "warning" | "danger";
};

function ErrorIllustration({ variant }: { variant: "warning" | "danger" }) {
  const accent = variant === "danger" ? "text-rose-500" : "text-amber-500";
  const glow = variant === "danger" ? "bg-rose-100" : "bg-amber-100";
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
      <span className={`absolute inset-0 rounded-full ${glow}`} />
      <span
        className={`absolute inset-0 animate-ping rounded-full ${glow} opacity-60`}
        aria-hidden="true"
      />
      <svg
        className={`relative h-14 w-14 ${accent}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Warning triangle with a pulsing exclamation mark */}
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  );
}

function ActionButton({
  action,
  primary,
}: {
  action: Action;
  primary: boolean;
}) {
  const className = primary
    ? "rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
    : "rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export default function ErrorState({
  code,
  title,
  description,
  details,
  primaryAction = { label: "Back to home", href: "/" },
  secondaryAction,
  variant = "warning",
}: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg">
        {/* Soft gradient wash in the card corners */}
        <div
          className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-sky-100/60 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-rose-100/60 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative">
          <ErrorIllustration variant={variant} />

          {code ? (
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              {code}
            </p>
          ) : null}
          <h1 className="mt-2 break-words text-3xl font-black text-slate-900 md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-3 max-w-md break-words text-slate-500">
              {description}
            </p>
          ) : null}

          {details ? (
            <details className="mx-auto mt-5 max-w-md rounded-xl border border-slate-200 bg-slate-50 text-left">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 select-none hover:text-slate-700">
                Technical details
              </summary>
              <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 font-mono text-xs break-words whitespace-pre-wrap text-slate-600">
                {details}
              </pre>
            </details>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {primaryAction ? (
              <ActionButton action={primaryAction} primary />
            ) : null}
            {secondaryAction ? (
              <ActionButton action={secondaryAction} primary={false} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
