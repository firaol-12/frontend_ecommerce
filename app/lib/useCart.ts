"use client";

import { useCart } from "../components/cart-provider";

// Returns an `addToCart(productId, quantity?)` function bound to the shared
// CartProvider. Adding stays on the current page and just updates the navbar
// badge count. Logged-out users are sent to /login first.
export function useAddToCart() {
  const { addToCart } = useCart();
  return addToCart;
}