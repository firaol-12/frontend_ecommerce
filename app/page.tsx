"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "./lib/api";
import HeroSlider from "./components/hero-slider";
import WishlistButton from "./components/wishlist-button";
import ErrorState from "./components/error-state";
import { useAddToCart } from "./lib/useCart";
import accessoryIcon from "./assets/category/accessory.png";
import bagIcon from "./assets/category/bag.png";
import clothesIcon from "./assets/category/clothes.png";
import electronicsIcon from "./assets/category/electronics.png";
import hatIcon from "./assets/category/hat.png";
import jewelryIcon from "./assets/category/jawelry.png";
import kidsIcon from "./assets/category/kid.png";
import shoeIcon from "./assets/category/shoe.png";

type Category = {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  description?: string | null;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  description: string;
  stock: number;
  category_name?: string;
  main_image?: string;
  image_url?: string;
};

// Local icon for each category, matched by category slug.
type CategoryIcon = typeof clothesIcon;
const categoryIcons: Record<string, CategoryIcon> = {
  clothes: clothesIcon,
  electronics: electronicsIcon,
  shoes: shoeIcon,
  jewelry: jewelryIcon,
  hats: hatIcon,
  bags: bagIcon,
  kids: kidsIcon,
  accessories: accessoryIcon,
};
const fallbackCategoryIcon: CategoryIcon = accessoryIcon;

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const addToCart = useAddToCart();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        const [categoriesData, productsData] = await Promise.all([
          apiFetch<{ categories: Category[] }>("/categories"),
          apiFetch<{ products: Product[] }>("/products?limit=8"),
        ]);

        setCategories(categoriesData.categories || []);
        setProducts(productsData.products || []);
      } catch (error) {
        console.error("Failed to load homepage data", error);
        setLoadError(error instanceof Error ? error.message : "Failed to load homepage data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [retryToken]);

  if (loadError) {
    return (
      <main className="bg-white text-slate-900">
        <ErrorState
          code="Something went wrong"
          title="We couldn't load the store"
          description="The homepage failed to load its data. Please check your connection and try again."
          details={loadError}
          primaryAction={{ label: "Try again", onClick: () => setRetryToken((token) => token + 1) }}
          secondaryAction={{ label: "Browse products", href: "/products" }}
          variant="danger"
        />
      </main>
    );
  }

  return (
    <main className="bg-white text-slate-900">
      <HeroSlider />

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-bold">Shop by category</h2>
          <Link href="/products" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            View all products
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-500">Loading categories...</div>
        ) : (
          <div className="my-5 flex w-full flex-wrap items-center justify-center gap-4 md:gap-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?categoryId=${category.id}`}
                className="flex h-20 w-45 items-center justify-around gap-2 rounded-2xl bg-white px-3 shadow-xl transition hover:shadow-2xl"
              >
                <Image
                  src={categoryIcons[category.slug] || fallbackCategoryIcon}
                  alt={category.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                />
                <p className="text-sm font-semibold text-slate-700">
                  {category.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-bold">Featured products</h2>
          <Link href="/products" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Explore all
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-500">Loading products...</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article key={product.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="relative">
                  <Link href={`/product?slug=${encodeURIComponent(product.slug)}`}>
                    <img
                      src={product.main_image || product.image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80"}
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
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
