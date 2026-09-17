"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import WishlistButton from "../components/wishlist-button";
import ErrorState from "../components/error-state";
import { useAddToCart } from "../lib/useCart";

type Category = {
  id: number;
  name: string;
  slug: string;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  category_name?: string;
  main_image?: string;
  image_url?: string;
};

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  const addToCart = useAddToCart();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (categoryId) params.set("categoryId", categoryId);
        if (search) params.set("search", search);
        const [data, categoriesData] = await Promise.all([
          apiFetch<{ products: Product[] }>(`/products?${params.toString()}`),
          apiFetch<{ categories: Category[] }>("/categories"),
        ]);
        setProducts(data.products || []);
        setCategories(categoriesData.categories || []);
      } catch (error) {
        console.error("Failed to load products", error);
        setLoadError(error instanceof Error ? error.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [categoryId, search, retryToken]);

  // Reset pagination when the filters change so users always start with 8.
  useEffect(() => {
    setVisibleCount(8);
  }, [categoryId, search]);

  const activeCategory = categories.find(
    (category) => String(category.id) === categoryId
  );
  const heading = search
    ? `Results for "${search}"`
    : activeCategory?.name || "All products";

  // Show 8 products at a time; the "Show more" button reveals 8 more per click.
  const visibleProducts = products.slice(0, visibleCount);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">Loading products...</div>;
  }

  if (loadError) {
    return (
      <ErrorState
        code="Something went wrong"
        title="We couldn't load the products"
        description="The catalog failed to load. Please check your connection and try again."
        details={loadError}
        primaryAction={{ label: "Try again", onClick: () => setRetryToken((token) => token + 1) }}
        secondaryAction={{ label: "Back to home", href: "/" }}
        variant="danger"
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Catalog</p>
          <h1 className="mt-2 break-words text-4xl font-black text-slate-900">
            {heading}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {search ? (
            <Link href="/products" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              Clear search
            </Link>
          ) : null}
          {activeCategory ? (
            <Link href="/products" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              View all
            </Link>
          ) : null}
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Back home
          </Link>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {visibleProducts.map((product) => {
          const image = product.main_image || product.image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80";

          return (
            <article key={product.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="relative">
                <Link href={`/product?slug=${encodeURIComponent(product.slug)}`}>
                  <img
                    src={image}
                    alt={product.name}
                    className="h-64 w-full object-cover"
                  />
                </Link>
                <div className="absolute right-3 top-3">
                  <WishlistButton productId={product.id} />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{product.category_name || "General"}</p>
                <Link href={`/product?slug=${encodeURIComponent(product.slug)}`} className="mt-2 block text-xl font-semibold text-slate-900 hover:text-sky-700">
                  {product.name}
                </Link>
                <div className="relative mt-2">
                  <p className="line-clamp-3 text-sm text-slate-600">{product.description}</p>
                  {(product.description || "").length > 140 ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white"
                    />
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-2xl font-bold text-slate-900">${Number(product.price).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => void addToCart(product.id)}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {visibleProducts.length === 0 ? (
        <div className="py-16 text-center text-slate-500">No products found.</div>
      ) : visibleCount < products.length ? (
        <div className="mt-12 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + 8)}
            className="rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Show more
          </button>
          <p className="text-sm text-slate-500">
            Showing {visibleProducts.length} of {products.length} products
          </p>
        </div>
      ) : (
        products.length > 8 ? (
          <p className="mt-12 text-center text-sm text-slate-500">
            You have seen all {products.length} products
          </p>
        ) : null
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">
          Loading products...
        </div>
      }
    >
      <ProductsPageContent />
    </Suspense>
  );
}