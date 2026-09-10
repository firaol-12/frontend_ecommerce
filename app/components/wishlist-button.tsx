"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "./wishlist-provider";

type WishlistButtonProps = {
  productId: number;
  className?: string;
};

export default function WishlistButton({
  productId,
  className = "",
}: WishlistButtonProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const active = isWishlisted(productId);

  return (
    <button
      type="button"
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      title={active ? "Remove from wishlist" : "Add to wishlist"}
      onClick={() => toggleWishlist(productId)}
      className={`rounded-full bg-white/95 p-2 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 ${className}`}
    >
      <Heart
        size={20}
        className={active ? "text-rose-500" : "text-slate-400"}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}