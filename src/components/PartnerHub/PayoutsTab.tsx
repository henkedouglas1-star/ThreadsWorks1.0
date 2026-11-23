import React, { useState, useEffect } from "react";
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Loader2,
  RefreshCw,
  Edit2,
  Save,
  Check,
  Building,
  CreditCard,
  Download
} from "lucide-react";
import { PartnerProfile, PayoutRecord, PayoutMethod } from "../../types/partner";
import {
  fetchPartnerPayouts,
  submitPayoutRequest,
  updatePayoutMethodSetting,
} from "../../services/partnerService";

interface PayoutsTabProps {
  partner: PartnerProfile;
  onRefreshPartner?: () => void;
}

export default function PayoutsTab({ partner, onRefreshPartner }: PayoutsTabProps) {
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payableBalance, setPayableBalance] = useState(partner.payableBalance || 0);
  const [pendingBalance, setPendingBalance] = useState(partner.pendingBalance || 0);
  const [paidBalance, setPaidBalance] = useState(partner.paidBalance || 0);
  const [minimumPayout, setMinimumPayout] = useState(25.00);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | null>(partner.payoutMethod || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Method edit form state
  const [isEditingMethod, setIsEditingMethod] = useState(false);
  const [methodType, setMethodType] = useState<"paypal" | "wise" | "bank_wire">(
    (partner.payoutMethod?.type as any) || "paypal"
  );
  const [methodDetails, setMethodDetails] = useState(
    partner.payoutMethod?.details?.email || partner.payoutMethod?.details?.accountNumber || ""
  );
  const [savingMethod, setSavingMethod] = useState(false);
  const [methodSavedSuccess, setMethodSavedSuccess] = useState(false);

  // Request Payout Modal state
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestingLoading, setRequestingLoading] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPartnerPayouts();
      setPayouts(data.payouts || []);
      setPayableBalance(data.payableBalance || 0);
      setPendingBalance(data.pendingBalance || 0);
      setPaidBalance(data.paidBalance || 0);
      setMinimumPayout(data.minimumPayout || 25.00);
      if (data.payoutMethod) {
        setPayoutMethod(data.payoutMethod);
        setMethodType((data.payoutMethod.type as any) || "paypal");
        setMethodDetails(data.payoutMethod.details?.email || data.payoutMethod.details?.accountNumber || "");
      }
    } catch (err: any) {
      console.error("[PAYOUTS_TAB] Error loading payouts:", err);
      setError(err.message || "Failed to load payouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportCSV = () => {
    if (payouts.length === 0) return;
    const headers = ["Date", "Payout_ID", "Amount_USD", "Method", "Destination", "Provider_Reference", "Status"];
    const rows = payouts.map(p => [
      p.createdAt ? new Date(p.createdAt).toISOString() : "",
      p.id,
      p.amount.toFixed(2),
      p.payoutMethod?.type || "",
      p.payoutMethod?.details?.email || p.payoutMethod?.details?.accountNumber || "",
      p.providerReference || "",
      p.status
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `threadsworks-payouts-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveMethod = async () => {
    if (!methodDetails.trim()) return;
    setSavingMethod(true);
    try {
      const newMethod: PayoutMethod = {
        type: methodType,
        details: methodType === "paypal" ? { email: methodDetails.trim() } : { accountNumber: methodDetails.trim() },
        updatedAt: new Date().toISOString(),
      };
      await updatePayoutMethodSetting(newMethod);
      setPayoutMethod(newMethod);
      setIsEditingMethod(false);
      setMethodSavedSuccess(true);
      setTimeout(() => setMethodSavedSuccess(false), 3000);
      if (onRefreshPartner) onRefreshPartner();
    } catch (err: any) {
      console.error("[PAYOUTS_TAB] Error updating payout method:", err);
      setError(err.message || "Failed to save payout method.");
    } finally {
      setSavingMethod(false);
    }
  };

  const handleRequestPayout = async () => {
    if (payableBalance < minimumPayout) return;
    setRequestingLoading(true);
    setError(null);
    try {
      const payout = await submitPayoutRequest(payoutMethod || undefined);
      setRequestSuccessMsg(`Payout request for $${payout.amount.toFixed(2)} submitted successfully!`);
      setIsRequesting(false);
      await loadData();
      if (onRefreshPartner) onRefreshPartner();
    } catch (err: any) {
      console.error("[PAYOUTS_TAB] Payout request error:", err);
      setError(err.message || "Failed to submit payout request.");
    } finally {
      setRequestingLoading(false);
    }
  };

  const isEligibleForPayout = payableBalance >= minimumPayout && payoutMethod !== null;
  const progressPercent = Math.min(100, Math.round((payableBalance / minimumPayout) * 100));

  return (
    <div className="space-y-6 animate-fade-in" id="partner-payouts-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text-primary">
            Partner Payouts & Balance
          </h2>
          <p className="text-xs text-text-secondary">
            Automatic 50% recurring commissions are released directly to your PayPal or Wise account upon reaching the $25 minimum threshold.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-2 rounded-xl bg-bg-card border border-border-primary hover:bg-bg-card-hover text-xs font-semibold text-text-secondary flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Payouts</span>
        </button>
      </div>

      {requestSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{requestSuccessMsg}</span>
        </div>
      )}

      {/* Balance Summary & Threshold Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Payable Balance Card */}
        <div className="md:col-span-2 p-6 rounded-2xl border border-purple-500/20 bg-bg-card space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono">
                Payable Balance (Available Now)
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono pt-1">
                ${payableBalance.toFixed(2)}
              </div>
            </div>

            <button
              onClick={() => setIsRequesting(true)}
              disabled={payableBalance < minimumPayout || !payoutMethod}
              className={`px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shrink-0 ${
                isEligibleForPayout
                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
                  : "bg-border-primary text-text-muted cursor-not-allowed opacity-60"
              }`}
            >
              <Wallet className="h-4 w-4" />
              <span>Request Payout</span>
            </button>
          </div>

          {/* Progress Bar towards $25 threshold */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-semibold text-text-secondary">
              <span>Payout Threshold Progress:</span>
              <span className="font-mono">${payableBalance.toFixed(2)} / ${minimumPayout.toFixed(2)}</span>
            </div>
            <div className="w-full bg-bg-primary rounded-full h-2.5 overflow-hidden border border-border-primary">
              <div
                className="bg-gradient-to-r from-purple-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-text-muted">
              <span>Minimum required: ${minimumPayout.toFixed(2)}</span>
              <span>{progressPercent}% Met</span>
            </div>
          </div>
        </div>

        {/* Lifetime Payout Stats */}
        <div className="p-6 rounded-2xl border border-border-primary bg-bg-card space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono">
            Payout Balances
          </span>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending Processing:
              </span>
              <span className="font-mono font-bold text-text-primary">${pendingBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Total Paid to Date:
              </span>
              <span className="font-mono font-bold text-text-primary">${paidBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Method Settings Box */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              Payout Method & Account
            </h3>
            <p className="text-xs text-text-secondary">
              Where your approved 50% commission payouts will be sent.
            </p>
          </div>

          {!isEditingMethod && (
            <button
              onClick={() => setIsEditingMethod(true)}
              className="px-3 py-1.5 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-card-hover text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>{payoutMethod ? "Change Method" : "Add Payout Method"}</span>
            </button>
          )}
        </div>

        {methodSavedSuccess && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>Payout method updated successfully.</span>
          </div>
        )}

        {!isEditingMethod ? (
          payoutMethod ? (
            <div className="p-4 rounded-xl bg-bg-primary border border-border-primary flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  {payoutMethod.type === "paypal" ? "PP" : (payoutMethod.type === "wise" ? "W" : "BK")}
                </div>
                <div>
                  <div className="font-bold text-text-primary capitalize">{payoutMethod.type}</div>
                  <div className="font-mono text-text-muted">
                    {payoutMethod.details?.email || payoutMethod.details?.accountNumber}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
              </span>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between">
              <span>No payout method configured yet. Add your PayPal or Wise account to receive payouts.</span>
              <button
                onClick={() => setIsEditingMethod(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold"
              >
                Configure
              </button>
            </div>
          )
        ) : (
          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold font-mono text-text-secondary uppercase">
                  Payout Type:
                </label>
                <select
                  value={methodType}
                  onChange={(e) => setMethodType(e.target.value as any)}
                  className="w-full rounded-xl border border-border-primary bg-bg-card px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
                >
                  <option value="paypal">PayPal</option>
                  <option value="wise">Wise (TransferWise)</option>
                  <option value="bank_wire">Direct Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold font-mono text-text-secondary uppercase">
                  {methodType === "paypal" ? "PayPal Email Address:" : "Account Number / Email:"}
                </label>
                <input
                  type={methodType === "paypal" ? "email" : "text"}
                  value={methodDetails}
                  onChange={(e) => setMethodDetails(e.target.value)}
                  placeholder={methodType === "paypal" ? "you@paypal.com" : "Wise tag or account ID"}
                  className="w-full rounded-xl border border-border-primary bg-bg-card px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditingMethod(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMethod}
                disabled={savingMethod || !methodDetails.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {savingMethod ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Method</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {isRequesting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-bg-card border border-border-primary p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">Confirm Payout Request</h3>
              <p className="text-xs text-text-secondary">
                You are requesting a payout for your available payable balance.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Payout Amount:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ${payableBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Destination:</span>
                <span className="font-mono font-semibold text-text-primary capitalize">
                  {payoutMethod?.type} ({payoutMethod?.details?.email || payoutMethod?.details?.accountNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Estimated Processing:</span>
                <span className="font-semibold text-text-primary">1–3 business days</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRequesting(false)}
                disabled={requestingLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPayout}
                disabled={requestingLoading}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {requestingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                <span>Confirm Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payouts History Table */}
      <div className="rounded-2xl border border-border-primary bg-bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-primary flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Payout Request History</h3>
          {payouts.length > 0 && (
            <button
              onClick={handleExportCSV}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-bg-primary border border-border-primary hover:bg-bg-card text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Export CSV</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 text-purple-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-text-muted">Loading payout history...</p>
          </div>
        ) : payouts.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">
            No payouts requested yet. Once your commissions reach $25.00, you can request a payout here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-primary/50 text-[11px] font-mono uppercase font-bold text-text-muted border-b border-border-primary">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payout ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/50 font-sans">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-bg-card-hover/50 transition">
                    <td className="py-3.5 px-4 font-mono text-text-secondary whitespace-nowrap">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-muted text-[11px]">
                      {p.id.slice(0, 10)}...
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      ${p.amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-text-primary">
                      {p.payoutMethod?.type || "PayPal"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-muted text-[11px]">
                      {p.providerReference || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </span>
                      ) : p.status === "processing" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <Clock className="h-3 w-3" /> Processing
                        </span>
                      ) : p.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3" /> Pending Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/20">
                          <AlertCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
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
