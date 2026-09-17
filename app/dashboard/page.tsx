"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import ErrorState from "../components/error-state";

type DashboardSummary = {
  users: number;
  products: number;
  orders: number;
  revenue: number;
};

type OrderRow = {
  id: number;
  order_number?: string;
  status?: string;
  payment_status?: string;
  total_amount?: number;
  created_at?: string;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>({ users: 0, products: 0, orders: 0, revenue: 0 });
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const data = await apiFetch<{ summary: DashboardSummary; recentOrders: OrderRow[] }>("/admin/dashboard");
        if (!mounted) return;

        setSummary(data.summary || { users: 0, products: 0, orders: 0, revenue: 0 });
        setRecentOrders(data.recentOrders || []);
        setLoadError(null);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : "Failed to load dashboard data");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [retryToken]);

  if (loadError) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Overview</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Admin dashboard</h1>
        </div>
        <ErrorState
          code="Something went wrong"
          title="We couldn't load the dashboard"
          description="The dashboard data failed to load. Please check your connection and try again."
          details={loadError}
          primaryAction={{ label: "Try again", onClick: () => setRetryToken((token) => token + 1) }}
          secondaryAction={{ label: "Back to home", href: "/" }}
          variant="danger"
        />
      </div>
    );
  }

  const stats = [
    { label: "Total customers", value: summary.users, accent: "bg-sky-500" },
    { label: "Products", value: summary.products, accent: "bg-violet-500" },
    { label: "Orders", value: summary.orders, accent: "bg-emerald-500" },
    { label: "Revenue", value: `$${Number(summary.revenue).toFixed(2)}`, accent: "bg-amber-500" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Overview</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Admin dashboard</h1>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">Loading dashboard data...</div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`mb-4 h-2.5 w-14 rounded-full ${stat.accent}`} />
                <p className="text-sm text-slate-500">{stat.label}</p>
                <h2 className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</h2>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-900">Recent orders</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-sm text-slate-500">No recent orders found.</td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-200">
                        <td className="px-6 py-4 font-medium text-slate-900">{order.order_number || `#${order.id}`}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {order.status || "pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{order.payment_status || "pending"}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">${Number(order.total_amount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-slate-600">{order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}