import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Download
} from "lucide-react";
import { CommissionRecord } from "../../types/partner";
import { fetchPartnerCommissions } from "../../services/partnerService";

export default function CommissionsTab() {
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPartnerCommissions();
      setCommissions(data);
    } catch (err: any) {
      console.error("[COMMISSIONS_TAB] Error loading commissions:", err);
      setError(err.message || "Failed to load commission ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCSV = () => {
    if (commissions.length === 0) return;
    const headers = ["Date", "Customer", "Transaction_Invoice_ID", "Gross_Sale_USD", "Commission_Rate", "Commission_USD", "Status"];
    const rows = filtered.map(c => [
      c.createdAt ? new Date(c.createdAt).toISOString() : "",
      c.customerEmail || c.customerId || "",
      c.stripeInvoiceId || c.stripeChargeId || c.id || "",
      c.grossAmount.toFixed(2),
      `${Math.round(c.commissionRate <= 1 ? c.commissionRate * 100 : c.commissionRate)}%`,
      c.commissionAmount.toFixed(2),
      c.status
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `threadsworks-commissions-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = commissions.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (c.stripeInvoiceId && c.stripeInvoiceId.toLowerCase().includes(q)) ||
        (c.customerId && c.customerId.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (status: CommissionRecord["status"]) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Paid Out
          </span>
        );
      case "payable":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="h-3 w-3" /> Payable
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Clock className="h-3 w-3" /> Approved
          </span>
        );
      case "reversed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/20">
            <AlertCircle className="h-3 w-3" /> Refunded / Reversed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-border-primary px-2.5 py-0.5 text-xs font-semibold text-text-muted">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="commissions-ledger-tab">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text-primary">
            Auditable Commissions Ledger
          </h2>
          <p className="text-xs text-text-secondary">
            Every 50% recurring commission credited to your partner profile with full Stripe transaction provenance.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={loading || filtered.length === 0}
            className="px-3 py-2 rounded-xl bg-bg-card border border-border-primary hover:bg-bg-card-hover text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Export to CSV"
          >
            <Download className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-bg-card border border-border-primary hover:bg-bg-card-hover text-xs font-semibold text-text-secondary flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by invoice ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border-primary bg-bg-card text-xs text-text-primary focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-bg-card border border-border-primary p-1 text-xs font-semibold shrink-0">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterStatus === "all" ? "bg-purple-600 text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            All ({commissions.length})
          </button>
          <button
            onClick={() => setFilterStatus("payable")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterStatus === "payable" ? "bg-purple-600 text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Payable
          </button>
          <button
            onClick={() => setFilterStatus("paid")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterStatus === "paid" ? "bg-purple-600 text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Paid
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border-primary bg-bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="h-6 w-6 text-purple-600 animate-spin mx-auto" />
            <p className="text-xs text-text-muted">Loading auditable transactions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={loadData}
              className="text-xs font-bold text-purple-600 underline"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <DollarSign className="h-8 w-8 text-text-muted mx-auto opacity-40" />
            <h4 className="text-sm font-bold text-text-primary">No Commissions in this View</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              When someone clicks your referral link and subscribes to ThreadsWorks ($7/mo), your 50% commission ($3.50) will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-primary/50 text-[11px] font-mono uppercase font-bold text-text-muted border-b border-border-primary">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Transaction / Invoice</th>
                  <th className="py-3 px-4">Gross Sale</th>
                  <th className="py-3 px-4">Rate</th>
                  <th className="py-3 px-4">Your Commission</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/50 font-sans">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-bg-card-hover/50 transition">
                    <td className="py-3.5 px-4 font-mono text-text-secondary whitespace-nowrap">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-text-primary font-medium">
                      {item.customerEmail ? item.customerEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3") : `User ${item.customerId?.slice(0, 6)}...`}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-muted text-[11px]">
                      {item.stripeInvoiceId || item.stripeChargeId || item.id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-secondary">
                      ${item.grossAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-purple-600 dark:text-purple-400 font-bold">
                      {Math.round(item.commissionRate <= 1 ? item.commissionRate * 100 : item.commissionRate)}%
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      +${item.commissionAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
