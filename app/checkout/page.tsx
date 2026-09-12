"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/auth-provider";
import { useCart } from "../components/cart-provider";

const CHAPA_PUBLIC_KEY = process.env.NEXT_PUBLIC_CHAPA_PUBLIC_KEY || "";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Dynamically load Chapa.js (the embedded checkout modal library). Returns true
// if the global `Chapa` is available afterwards.
function loadChapaScript(timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Chapa) {
      resolve(true);
      return;
    }
    const src = document.createElement("script");
    src.src = "https://js.chapa.co/v1/plugin.js";
    src.async = true;
    src.onload = () => resolve(Boolean(window.Chapa));
    src.onerror = () => resolve(Boolean(window.Chapa));
    document.head.appendChild(src);
    setTimeout(() => resolve(Boolean(window.Chapa)), timeoutMs);
  });
}

type CartItem = {
  id: number;
  product_id: number;
  quantity: number;
  product_name: string;
  price: number;
  discount: number;
  image_url?: string;
};

type Address = {
  id: number;
  full_name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type: "shipping" | "billing";
  is_default: boolean;
};

type CouponResult = {
  valid: boolean;
  discount: number;
  coupon?: { code: string; discount_type: string };
};

const emptyAddress = {
  full_name: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Ethiopia",
  address_type: "shipping",
  is_default: false,
};

export default function CheckoutPage() {
  const router = useRouter();
  const { loggedIn } = useAuth();
  const { refreshCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [billingId, setBillingId] = useState<number | null>(null);
  const [billingSame, setBillingSame] = useState(true);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [notes, setNotes] = useState("");

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddressType, setNewAddressType] = useState<"shipping" | "billing">("shipping");
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [savingAddress, setSavingAddress] = useState(false);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        const cartData = await apiFetch<{ cart: CartItem[] }>("/cart");
        const addrData = await apiFetch<{ addresses: Address[] }>("/addresses");
        if (!mounted) return;

        const cart = cartData.cart || [];
        setItems(cart);

        const addrs = addrData.addresses || [];
        setAddresses(addrs);

        const shippingDefault = addrs.find((a) => a.address_type === "shipping" && a.is_default);
        const shipping = addrs.find((a) => a.address_type === "shipping");
        if (shipping) setShippingId(shippingDefault?.id || shipping.id);

        const billingDefault = addrs.find((a) => a.address_type === "billing" && a.is_default);
        const billing = addrs.find((a) => a.address_type === "billing");
        if (billing) setBillingId(billingDefault?.id || billing.id);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load checkout");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [loggedIn, router]);

  const subtotal = items.reduce((sum, item) => {
    const unitPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
    return sum + unitPrice * Number(item.quantity);
  }, 0);

  const discountAmount = appliedCoupon ? Math.min(appliedCoupon.discount, subtotal) : 0;
  const shippingCost = 0;
  const taxAmount = subtotal * 0.08;
  const totalAmount = Math.max(0, subtotal + shippingCost + taxAmount - discountAmount);

  function openAddressForm(type: "shipping" | "billing") {
    setNewAddressType(type);
    setAddressForm({ ...emptyAddress, address_type: type });
    setShowAddressForm(true);
  }

  async function validateCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponMessage("");
    try {
      const data = await apiFetch<CouponResult>("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code, subtotal }),
      });
      setAppliedCoupon(data);
      setCouponMessage(
        `Coupon "${data.coupon?.code || code}" applied — ${Number(data.discount).toFixed(2)} off`
      );
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMessage(err instanceof Error ? err.message : "Invalid coupon code");
    }
  }

  async function saveNewAddress() {
    setSavingAddress(true);
    try {
      const data = await apiFetch<{ address: Address }>("/addresses", {
        method: "POST",
        body: JSON.stringify(addressForm),
      });
      const created = data.address;
      const updated = [...addresses, created];
      setAddresses(updated);

      if (created.address_type === "shipping") {
        setShippingId(created.id);
      } else {
        setBillingId(created.id);
      }
      setShowAddressForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add address");
    } finally {
      setSavingAddress(false);
    }
  }

  async function payWithChapa() {
    if (!shippingId || (!billingSame && !billingId)) {
      setPayError("Please choose both a shipping and billing address.");
      return;
    }
    setPaying(true);
    setPayError("");

    const basePayload = JSON.stringify({
      shipping_address_id: shippingId,
      billing_address_id: billingSame ? shippingId : billingId,
      coupon_code: appliedCoupon?.coupon?.code || null,
      notes: notes || null,
    });

    let createdTxRef = "";

    try {
      // 1) Create the order + pending payment first, so we have a tx_ref.
      const orderData = await apiFetch<{
        tx_ref: string;
        amount: number;
        customer: { first_name: string; last_name: string; email: string; phone_number: string };
      }>("/payments/chapa/order", {
        method: "POST",
        body: basePayload,
      });
      createdTxRef = orderData.tx_ref;

      // 2) Preferred: open the embedded Chapa.js payment modal (fields to enter
      //    your account / card right on the site).
      if (CHAPA_PUBLIC_KEY) {
        const loaded = await loadChapaScript();
        if (loaded && typeof window !== "undefined" && window.Chapa) {
          window.Chapa.setPublicKey(CHAPA_PUBLIC_KEY);
          window.Chapa.initialize({
            amount: String(orderData.amount),
            currency: "ETB",
            email: orderData.customer.email,
            first_name: orderData.customer.first_name,
            last_name: orderData.customer.last_name,
            phone_number: orderData.customer.phone_number,
            tx_ref: orderData.tx_ref,
            return_url: `${window.location.origin}/checkout/status`,
            callback_url: `${API_BASE_URL}/payments/chapa/webhook`,
            customization: {
              title: "MyShop",
              description: `Order ${orderData.tx_ref}`,
            },
          });
          // Chapa's modal takes over from here.
          return;
        }
        // Chapa.js could not load — put the order back and fall back to redirect.
        try {
          await apiFetch("/payments/chapa/cancel", {
            method: "POST",
            body: JSON.stringify({ tx_ref: orderData.tx_ref }),
          });
        } catch (_) { /* best effort */ }
      }

      // 3) Fallback: hosted Chapa page redirect.
      const init = await apiFetch<{ checkout_url: string }>("/payments/chapa/initialize", {
        method: "POST",
        body: basePayload,
      });
      if (init.checkout_url) {
        window.location.href = init.checkout_url;
        return;
      }
      throw new Error("Chapa did not return a payment URL.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start payment. Please try again.";
      if (msg.toLowerCase().includes("cart is empty")) {
        if (createdTxRef) {
          try {
            await apiFetch("/payments/chapa/cancel", {
              method: "POST",
              body: JSON.stringify({ tx_ref: createdTxRef }),
            });
          } catch (_) { /* best effort */ }
        }
        router.push(`/cart?msg=Your+cart+is+empty.+Please+add+items+and+try+again.`);
        return;
      }
      setPayError(msg);
      setPaying(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-20 text-slate-500">Loading checkout...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
        <div className="mt-6">
          <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700">
            Login to continue
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">Nothing to check out</h1>
          <p className="mt-3 text-slate-500">Your cart is empty. Add some products first.</p>
          <Link
            href="/products"
            className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Secure checkout</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900">Checkout</h1>
        </div>
        <Link href="/cart" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Back to cart
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Left column: addresses + payment */}
        <div className="space-y-8">
          {/* Shipping address */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                <span className="mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">1</span>
                Shipping address
              </h2>
              <button
                type="button"
                onClick={() => openAddressForm("shipping")}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                + Add address
              </button>
            </div>

            {addresses.filter((a) => a.address_type === "shipping").length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No shipping address yet — add one to continue.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {addresses
                  .filter((a) => a.address_type === "shipping")
                  .map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                        shippingId === addr.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingId === addr.id}
                        onChange={() => setShippingId(addr.id)}
                        className="mt-1 accent-sky-600"
                      />
                      <span className="text-sm">
                        <span className="font-semibold text-slate-900">{addr.full_name}</span>
                        <span className="mt-0.5 block text-slate-500">
                          {addr.street}, {addr.city}, {addr.state} {addr.postal_code} · {addr.country}
                        </span>
                        <span className="mt-0.5 block text-slate-500">{addr.phone}</span>
                      </span>
                    </label>
                  ))}
              </div>
            )}
          </section>

          {/* Billing address */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">2</span>
              Billing address
            </h2>

            <label className="mt-4 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
                className="accent-sky-600"
              />
              <span className="text-sm font-medium text-slate-700">Same as shipping address</span>
            </label>

            {!billingSame && (
              <div className="mt-4">
                {addresses.filter((a) => a.address_type === "billing").length > 0 ? (
                  <div className="space-y-3">
                    {addresses
                      .filter((a) => a.address_type === "billing")
                      .map((addr) => (
                        <label
                          key={addr.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                            billingId === addr.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name="billing"
                            checked={billingId === addr.id}
                            onChange={() => setBillingId(addr.id)}
                            className="mt-1 accent-sky-600"
                          />
                          <span className="text-sm">
                            <span className="font-semibold text-slate-900">{addr.full_name}</span>
                            <span className="mt-0.5 block text-slate-500">
                              {addr.street}, {addr.city}, {addr.state} {addr.postal_code}
                            </span>
                          </span>
                        </label>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No billing address yet.</p>
                )}
                <button
                  type="button"
                  onClick={() => openAddressForm("billing")}
                  className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  + Add billing address
                </button>
              </div>
            )}

            {showAddressForm && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-semibold text-slate-800">Add {newAddressType} address</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={addressForm.full_name}
                    onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="Phone"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    placeholder="Street address"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="City"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    placeholder="State / Region"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addressForm.postal_code}
                    onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                    placeholder="Postal code"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addressForm.country}
                    onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                    placeholder="Country"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={saveNewAddress}
                    disabled={savingAddress}
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    {savingAddress ? "Saving..." : "Save address"}
                  </button>
                  {savingAddress ? null : (
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(false)}
                      className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">3</span>
              Payment
            </h2>
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-2xl font-black text-slate-900">Chapa</span>
              <div className="text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Chapa (ETB)</p>
                <p>Pay securely with Chapa via Telebirr, CBE, bank cards and more.</p>
              </div>
            </div>
            {payError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {payError}
              </div>
            )}
          </section>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Order notes (optional)"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            rows={3}
          />
        </div>

        {/* Right column: order summary */}
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Order summary</h2>

          <ul className="mt-4 space-y-3 divide-y divide-slate-100">
            {items.map((item) => {
              const unitPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700">
                    {item.product_name}
                    <span className="text-slate-400"> × {item.quantity}</span>
                  </span>
                  <span className="font-semibold text-slate-900">
                    ${(unitPrice * item.quantity).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 space-y-3 text-sm">
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
              <span className="font-semibold text-slate-900">${taxAmount.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-emerald-600">
                <span>Coupon ({appliedCoupon.coupon?.code})</span>
                <span className="font-semibold">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between text-lg font-bold text-slate-900">
                <span>Total</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Coupon code"
              className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={validateCoupon}
              className="shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Apply
            </button>
          </div>
          {couponMessage ? (
            <p className={`mt-1 text-xs ${appliedCoupon ? "text-emerald-600" : "text-rose-600"}`}>
              {couponMessage}
            </p>
          ) : null}

          <button
            type="button"
            onClick={payWithChapa}
            disabled={paying}
            className="mt-6 w-full rounded-2xl bg-slate-900 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {paying ? "Contacting Chapa..." : "Pay with Chapa"}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            You'll be redirected to Chapa's secure payment page to complete your order.
          </p>
        </aside>
      </div>
    </div>
  );
}