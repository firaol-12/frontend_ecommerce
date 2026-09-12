"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type VerifyResult = {
  status: "pending" | "completed" | "failed";
  order_number?: string;
  verified?: boolean;
};

export default function CheckoutStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const txRef = searchParams.get("tx_ref") || searchParams.get("trxref") || searchParams.get("txref") || "";

  const [checking, setChecking] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!txRef) return;
    let mounted = true;
    let attempts = 0;
    const maxAttempts = 6;

    // Chapa may need a moment to settle the transaction, so we poll a few times
    // before giving up on a "pending" state.
    const poll = async () => {
      try {
        const data = await apiFetch<VerifyResult>(`/payments/chapa/verify/${encodeURIComponent(txRef)}`);
        if (!mounted) return;
        if (data.status === "pending" && attempts < maxAttempts) {
          attempts += 1;
          setTimeout(poll, 2000);
          return;
        }
        setResult(data);
        setChecking(false);
      } catch (err) {
        if (!mounted) return;
        if (attempts < maxAttempts) {
          attempts += 1;
          setTimeout(poll, 2000);
          return;
        }
        setError(err instanceof Error ? err.message : "Could not verify your payment.");
        setChecking(false);
      }
    };

    const id = setTimeout(() => void poll(), 800);
    return () => {
      mounted = false;
      clearTimeout(id);
    };
  }, [txRef]);

  if (!txRef) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">Missing payment reference</h1>
          <p className="mt-3 text-slate-500">
            We couldn't find your payment reference. This usually means Chapa's redirect didn't carry it.
          </p>
          <div className="mt-6 flex gap-4">
            <Link href="/cart" className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700">
              Back to cart
            </Link>
            <Link href="/products" className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <p className="mb-2 text-sm font-medium uppercase tracking-[0.25em] text-sky-600">
        Payment {checking ? "verification" : "result"}
      </p>

      {checking ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
          <h1 className="mt-6 text-2xl font-black text-slate-900">Verifying your payment…</h1>
          <p className="mt-2 text-slate-500">
            We're confirming your transaction with Chapa. This takes a few seconds.
          </p>
        </div>
      ) : result && result.status === "completed" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl font-bold text-white">✓</div>
          <h1 className="mt-6 text-3xl font-black text-slate-900">Payment successful</h1>
          <p className="mt-3 text-slate-600">
            Your order{result.order_number ? ` ${result.order_number}` : ""} has been placed and paid for. Thank you!
          </p>
          <div className="mt-6 flex gap-4">
            <Link href="/products" className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700">
              Continue shopping
            </Link>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Go home
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-3xl font-bold text-white">!</div>
          <h1 className="mt-6 text-3xl font-black text-slate-900">Payment not completed</h1>
          <p className="mt-3 text-slate-600">
            {error || "Your payment was not completed. No charge was made — you can try again."}
          </p>
          <div className="mt-6 flex gap-4">
            <Link href="/checkout" className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700">
              Return to checkout
            </Link>
            <Link href="/cart" className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100">
              View cart
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}