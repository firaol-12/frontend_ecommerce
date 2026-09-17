"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useAuth } from "./auth-provider";

type CartContextValue = {
  cartCount: number;
  setCartCount: (count: number) => void;
  addToCart: (productId: number, quantity?: number) => Promise<boolean>;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue>({
  cartCount: 0,
  setCartCount: () => {},
  addToCart: async () => false,
  refreshCart: async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!loggedIn) {
      setCartCount(0);
      return;
    }

    try {
      const data = await apiFetch<{
        cart: Array<{ quantity: number }>;
      }>("/cart");
      setCartCount(
        (data.cart || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        )
      );
    } catch (error) {
      console.error("Failed to load cart", error);
      setCartCount(0);
    }
  }, [loggedIn]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  // Adds an item to the cart and updates the navbar count. No navigation —
  // the user stays where they are and the badge reflects the new count.
  const addToCart = useCallback(
    async (productId: number, quantity = 1) => {
      if (!loggedIn) {
        router.push("/login");
        return false;
      }

      try {
        await apiFetch("/cart", {
          method: "POST",
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        await refreshCart();
        return true;
      } catch (error) {
        console.error("Failed to add item to cart", error);
        alert(
          error instanceof Error ? error.message : "Failed to add item to cart"
        );
        return false;
      }
    },
    [loggedIn, refreshCart, router]
  );

  const value = useMemo<CartContextValue>(
    () => ({ cartCount, setCartCount, addToCart, refreshCart }),
    [cartCount, addToCart, refreshCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}