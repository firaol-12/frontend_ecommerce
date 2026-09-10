"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "./auth-provider";

type WishlistContextValue = {
  isWishlisted: (productId: number) => boolean;
  toggleWishlist: (productId: number) => void;
  wishlistCount: number;
  refreshWishlist: () => Promise<void>;
  loggedIn: boolean;
};

const WishlistContext = createContext<WishlistContextValue>({
  isWishlisted: () => false,
  toggleWishlist: () => {},
  wishlistCount: 0,
  refreshWishlist: async () => {},
  loggedIn: false,
});

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());

  const refreshWishlist = useCallback(async () => {
    if (!loggedIn) {
      setWishlist(new Set());
      return;
    }

    try {
      const data = await apiFetch<{ wishlist: Array<{ product_id: number }> }>(
        "/wishlist"
      );
      setWishlist(new Set((data.wishlist || []).map((item) => item.product_id)));
    } catch (error) {
      console.error("Failed to load wishlist", error);
      setWishlist(new Set());
    }
  }, [loggedIn]);

  useEffect(() => {
    void refreshWishlist();
  }, [refreshWishlist]);

  const isWishlisted = useCallback(
    (productId: number) => wishlist.has(productId),
    [wishlist]
  );

  const toggleWishlist = useCallback(
    (productId: number) => {
      if (!loggedIn) {
        window.location.href = "/login";
        return;
      }

      const exists = wishlist.has(productId);

      if (exists) {
        apiFetch(`/wishlist/${productId}`, { method: "DELETE" })
          .then(() => {
            setWishlist((prev) => {
              const next = new Set(prev);
              next.delete(productId);
              return next;
            });
          })
          .catch((error) => {
            console.error("Failed to remove from wishlist", error);
          });
      } else {
        apiFetch("/wishlist", {
          method: "POST",
          body: JSON.stringify({ product_id: productId }),
        })
          .then(() => {
            setWishlist((prev) => new Set(prev).add(productId));
          })
          .catch((error) => {
            console.error("Failed to add to wishlist", error);
          });
      }
    },
    [loggedIn, wishlist]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      isWishlisted,
      toggleWishlist,
      wishlistCount: wishlist.size,
      refreshWishlist,
      loggedIn,
    }),
    [isWishlisted, toggleWishlist, wishlist, refreshWishlist, loggedIn]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  return useContext(WishlistContext);
}