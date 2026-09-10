"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type Order = {
  id: number;
  order_number?: string;
  status?: string;
  total_amount?: number;
  created_at?: string;
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
};

const orderStatuses = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let mounted = true;

    const loadOrders = async () => {
      try {
        const data = await apiFetch<{ orders: Order[] }>("/orders");
        if (!mounted) return;
        setOrders(data.orders || []);
      } catch (error) {
        console.error("Failed to load orders", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const customer = `${order.user?.first_name || ""} ${order.user?.last_name || ""}`.trim();
      const matchesSearch =
        (order.order_number || "").toLowerCase().includes(search.toLowerCase()) ||
        customer.toLowerCase().includes(search.toLowerCase()) ||
        (order.user?.email || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (order.status || "pending").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  async function updateStatus(order: Order, newStatus: string) {
    try {
      await apiFetch(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, status: newStatus } : item
        )
      );
    } catch (error) {
      console.error("Failed to update order status", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-violet-600">Sales</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Orders</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order, customer or email..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500 md:max-w-md"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-500"
          >
            <option value="all">All statuses</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-6 text-slate-500">Loading orders...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-slate-500">No orders found.</td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-200">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">{order.order_number || `#${order.id}`}</p>
                          <p className="text-xs text-slate-500">Order #{order.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div>
                          <p className="font-medium text-slate-800">
                            {order.user?.first_name || "Customer"} {order.user?.last_name || ""}
                          </p>
                          <p className="text-xs text-slate-500">{order.user?.email || "—"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-900">
                        ${Number(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          order.status === "delivered"
                            ? "bg-emerald-100 text-emerald-700"
                            : order.status === "cancelled"
                              ? "bg-rose-100 text-rose-700"
                              : order.status === "shipped"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-amber-100 text-amber-700"
                        }`}>
                          {order.status || "pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status || "pending"}
                          onChange={(event) => updateStatus(order, event.target.value)}
                          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-500"
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}