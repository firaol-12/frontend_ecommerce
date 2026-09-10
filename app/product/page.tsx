"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import WishlistButton from "../components/wishlist-button";
import { useAddToCart } from "../lib/useCart";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_name?: string;
  images?: Array<{ image_url: string; alt_text?: string }>;
  main_image?: string;
  image_url?: string;
};

function SingleProductContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const addToCart = useAddToCart();

  useEffect(() => {
    async function loadProduct() {
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch<{ product: Product }>(
          `/products/slug/${encodeURIComponent(slug)}`
        );
        setProduct(data.product);
        setActiveImage(0);
      } catch (error) {
        console.error("Failed to load product", error);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">
        Product not found.
      </div>
    );
  }

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : [
          {
            image_url:
              product.main_image ||
              product.image_url ||
              "",
          },
        ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
            <img
              src={gallery[activeImage] ? gallery[activeImage].image_url : gallery[0].image_url}
              alt={product.name}
              className="h-120 w-full object-cover"
            />
            <div className="absolute right-4 top-4">
              <WishlistButton productId={product.id} />
            </div>
          </div>

          {gallery.length > 1 ? (
            <div className="grid grid-cols-3 gap-4">
              {gallery.map((image, index) => (
                <button
                  key={`${image.image_url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`overflow-hidden rounded-2xl border-2 transition ${
                    activeImage === index
                      ? "border-sky-500 ring-2 ring-sky-200"
                      : "border-transparent hover:border-slate-300"
                  }`}
                >
                  <img
                    src={image.image_url}
                    alt={`${product.name} ${index + 1}`}
                    className="h-28 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">
            {product.category_name || "Featured item"}
          </p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 md:text-5xl">
            {product.name}
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            {product.description}
          </p>

          <div className="mt-6 flex items-center gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                Price
              </p>
              <p className="mt-2 text-4xl font-bold text-slate-900">
                ${Number(product.price).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
                Stock
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-700">
                {product.stock} available
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-2">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="h-10 w-10 rounded-full bg-white text-xl font-bold text-slate-700"
              >
                -
              </button>
              <span className="min-w-10 text-center text-lg font-semibold text-slate-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
                className="h-10 w-10 rounded-full bg-white text-xl font-bold text-slate-700"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => void addToCart(product.id, quantity)}
              className="rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Add to cart
            </button>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Product details
            </h2>
            <p className="mt-3 text-slate-600">{product.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SingleProductPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">
          Loading product...
        </div>
      }
    >
      <SingleProductContent />
    </Suspense>
  );
}