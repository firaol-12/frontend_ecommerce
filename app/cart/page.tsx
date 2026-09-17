"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useCart } from "../components/cart-provider";
import ErrorState from "../components/error-state";

type CartItem = {
  id: number;
  product_id: number;
  quantity: number;
  product_name: string;
  price: number;
  discount: number;
  image_url?: string;
};

function CartContent() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState(searchParams.get("msg") || "");
  const { refreshCart } = useCart();

  useEffect(() => {
    let mounted = true;

    const loadCart = async () => {
      try {
        const data = await apiFetch<{ cart: CartItem[] }>("/cart");
        if (!mounted) return;
        setItems(data.cart || []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load cart");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadCart();

    return () => {
      mounted = false;
    };
  }, []);

  async function updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity < 1) return;
    try {
      await apiFetch(`/cart/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: newQuantity }),
      });
      setItems((current) =>
        current.map((i) => (i.id === item.id ? { ...i, quantity: newQuantity } : i))
      );
      await refreshCart();
    } catch (err) {
      console.error("Failed to update quantity", err);
    }
  }

  async function removeItem(itemId: number) {
    try {
      await apiFetch(`/cart/${itemId}`, { method: "DELETE" });
      setItems((current) => current.filter((i) => i.id !== itemId));
      await refreshCart();
    } catch (err) {
      console.error("Failed to remove item", err);
    }
  }

  const subtotal = items.reduce((sum, item) => {
    const unitPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
    return sum + unitPrice * Number(item.quantity);
  }, 0);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">Loading cart...</div>;
  }

  if (error) {
    return (
      <ErrorState
        code="Couldn't load cart"
        title="We couldn't load your cart"
        description={error}
        primaryAction={{ label: "Login to view your cart", href: "/login" }}
        secondaryAction={{ label: "Continue shopping", href: "/products" }}
        variant="danger"
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Your cart</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900">Shopping cart</h1>
        </div>
        <Link href="/products" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Continue shopping
        </Link>
      </div>

      {notice ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {notice}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Your cart is empty</h2>
          <p className="mt-3 text-slate-600">Browse our products and add something you love.</p>
          <Link
            href="/products"
            className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Shop now
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {items.map((item) => {
              const unitPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-500">
                        {item.product_name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <Link
                      href={`/product?slug=${encodeURIComponent(item.product_name.toLowerCase().replace(/\s+/g, "-"))}`}
                      className="text-lg font-semibold text-slate-900 hover:text-sky-700"
                    >
                      {item.product_name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      ${unitPrice.toFixed(2)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item, item.quantity - 1)}
                        className="h-8 w-8 rounded-full bg-white text-lg font-bold text-slate-700"
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center font-semibold text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item, item.quantity + 1)}
                        className="h-8 w-8 rounded-full bg-white text-lg font-bold text-slate-700"
                      >
                        +
                      </button>
                    </div>

                    <p className="min-w-20 text-right text-lg font-bold text-slate-900">
                      ${(unitPrice * item.quantity).toFixed(2)}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-full bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="font-semibold text-slate-900">Free</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax (8%)</span>
                <span className="font-semibold text-slate-900">${(subtotal * 0.08).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between text-lg font-bold text-slate-900">
                  <span>Total</span>
                  <span>${(subtotal * 1.08).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-6 block w-full rounded-full bg-slate-900 px-6 py-3 text-center font-semibold text-white transition hover:bg-slate-700"
            >
              Proceed to checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">
          Loading cart...
        </div>
      }
    >
      <CartContent />
    </Suspense>
  );
}
