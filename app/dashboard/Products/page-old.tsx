"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import Image from "next/image";

type Category = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  category_id?: number;
  category_name?: string;
  stock?: number;
  is_active?: boolean;
  image_url?: string;
};

type ProductFormData = {
  name: string;
  description: string;
  price: string;
  category_id?: number;
  category_name: string;
  stock: string;
  is_active: boolean;
  image_url: string;
  slug?: string;
};

const emptyProduct: ProductFormData = {
  name: "",
  description: "",
  price: "",
  category_id: undefined,
  category_name: "",
  stock: "",
  is_active: true,
  image_url: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyProduct);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          apiFetch<{ products: Product[] }>("/products"),
          apiFetch<{ categories: Category[] }>("/categories"),
        ]);

        if (!mounted) return;

        setProducts(productsResponse.products || []);
        setCategories(categoriesResponse.categories || []);
      } catch (error) {
        console.error("Failed to load products or categories", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.description || "").toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" ||
        String(product.category_id) === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  function openCreateForm() {
    setFormData(emptyProduct);
    setEditingProductId(null);
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      price: String(product.price || ""),
      category_id: product.category_id,
      category_name: product.category_name || "",
      stock: String(product.stock || ""),
      is_active: product.is_active ?? true,
      image_url: product.image_url || "",
    });
    setEditingProductId(product.id);
    setShowForm(true);
  }

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      ...formData,
      category_id: Number(formData.category_id || categories[0]?.id),
      price: Number(formData.price || 0),
      stock: Number(formData.stock || 0),
    };

    try {
      if (editingProductId) {
        const response = await apiFetch<{ product: Product }>(`/products/${editingProductId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setProducts((current) =>
          current.map((product) => (product.id === editingProductId ? response.product : product))
        );
      } else {
        const response = await apiFetch<{ product: Product }>("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setProducts((current) => [response.product, ...current]);
      }

      setShowForm(false);
      setFormData(emptyProduct);
      setEditingProductId(null);
    } catch (error) {
      console.error("Failed to save product", error);
      alert(`Error: ${error instanceof Error ? error.message : "Failed to save product"}`);
    }
  }

  async function deleteProduct(productId: number) {
    if (!window.confirm("Delete this product?")) return;

    try {
      await apiFetch(`/products/${productId}`, { method: "DELETE" });
      setProducts((current) => current.filter((product) => product.id !== productId));
    } catch (error) {
      console.error("Failed to delete product", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-600">Catalog</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Products</h1>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          + Add product
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 md:max-w-md"
          />

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-6 text-slate-500">Loading products...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-slate-500">No products found.</td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="border-t border-slate-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                            {product.image_url ? (
                              <Image src={product.image_url} alt={product.name} width={44} height={44} className="h-full w-full object-cover" />
                            ) : (
                              product.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-500">{product.slug || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{product.category_name || "Uncategorized"}</td>
                      <td className="px-6 py-4 text-slate-900">${Number(product.price || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-600">{product.stock ?? 0}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(product.id)}
                            className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {editingProductId ? "Edit product" : "Add new product"}
            </h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">
              Close
            </button>
          </div>

          <form className="grid gap-5 md:grid-cols-2" onSubmit={submitProduct}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Product name</span>
              <input
                required
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(event) => setFormData((current) => ({ ...current, price: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Stock</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={formData.stock}
                onChange={(event) => setFormData((current) => ({ ...current, stock: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Category</span>
              {categories.length === 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  No categories available. Please create categories first from the admin panel.
                </div>
              ) : (
                <select
                  value={formData.category_id ?? ""}
                  onChange={(event) => setFormData((current) => ({ ...current, category_id: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
                >
                  <option value="">-- Select a category --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Image URL</span>
              <input
                value={formData.image_url}
                onChange={(event) => setFormData((current) => ({ ...current, image_url: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>

            <label className="flex items-center gap-3 pt-8">
              <input
                type="checkbox"
                checked={Boolean(formData.is_active)}
                onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">Active product</span>
            </label>

            <div className="md:col-span-2 flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500"
              >
                {editingProductId ? "Save changes" : "Create product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}