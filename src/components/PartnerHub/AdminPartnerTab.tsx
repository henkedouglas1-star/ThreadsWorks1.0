import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Search,
  RefreshCw,
  Loader2,
  Lock,
  Unlock,
  Check,
  X,
  History,
  Download,
  Settings,
  Sliders,
  Wallet
} from "lucide-react";
import { PartnerProfile, PartnerAuditLog, PartnerProgramConfig } from "../../types/partner";
import {
  adminFetchAllPartners,
  adminUpdatePartnerStatus,
  adminProcessPayoutRequest,
  adminFetchAuditLogs,
  fetchPartnerProgramConfig,
  adminUpdateProgramConfig,
} from "../../services/partnerService";

export default function AdminPartnerTab() {
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<PartnerAuditLog[]>([]);
  const [config, setConfig] = useState<PartnerProgramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<"partners" | "audit" | "config">("partners");

  // Config editor state
  const [minPayoutInput, setMinPayoutInput] = useState<number>(25);
  const [cookieDaysInput, setCookieDaysInput] = useState<number>(60);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedSuccess, setConfigSavedSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [partnersData, logsData, cfgData] = await Promise.all([
        adminFetchAllPartners().catch(e => { console.warn(e); return []; }),
        adminFetchAuditLogs().catch(e => { console.warn(e); return []; }),
        fetchPartnerProgramConfig().catch(e => { console.warn(e); return null; }),
      ]);
      setPartners(partnersData);
      setAuditLogs(logsData);
      if (cfgData) {
        setConfig(cfgData);
        setMinPayoutInput(cfgData.minimumPayout || 25);
        setCookieDaysInput(cfgData.attributionCookieDays || 60);
      }
    } catch (err: any) {
      console.error("[ADMIN_PARTNER_TAB] Error loading partners:", err);
      setError(err.message || "Failed to load partner administrative data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (partnerId: string, currentStatus: "active" | "suspended") => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    setActionLoading(partnerId);
    try {
      await adminUpdatePartnerStatus(partnerId, newStatus);
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? { ...p, status: newStatus } : p))
      );
      // Reload audit logs after status modification
      const updatedLogs = await adminFetchAuditLogs();
      setAuditLogs(updatedLogs);
    } catch (err: any) {
      console.error("[ADMIN_PARTNER_TAB] Toggle status error:", err);
      setError(err.message || "Failed to update partner status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await adminUpdateProgramConfig({
        minimumPayout: Number(minPayoutInput),
        attributionCookieDays: Number(cookieDaysInput),
      });
      setConfig(updated);
      setConfigSavedSuccess(true);
      setTimeout(() => setConfigSavedSuccess(false), 3000);
      const updatedLogs = await adminFetchAuditLogs();
      setAuditLogs(updatedLogs);
    } catch (err: any) {
      console.error("[ADMIN_PARTNER_TAB] Save config error:", err);
      setError(err.message || "Failed to save configuration.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExportPartnersCSV = () => {
    if (partners.length === 0) return;
    const headers = [
      "Partner_ID",
      "Name",
      "Email",
      "Referral_Code",
      "Total_Clicks",
      "Total_Signups",
      "Active_Subscribers",
      "MRR_USD",
      "Total_Earned_USD",
      "Payable_Balance_USD",
      "Paid_Balance_USD",
      "Status",
      "Created_At"
    ];
    const rows = filteredPartners.map(p => [
      p.id,
      p.name || "",
      p.userEmail || "",
      p.referralCode || "",
      p.totalClicks || 0,
      p.totalSignups || 0,
      p.activeCustomers || 0,
      ((p.activeCustomers || 0) * 3.50).toFixed(2),
      (p.totalEarned || 0).toFixed(2),
      (p.payableBalance || 0).toFixed(2),
      (p.paidBalance || 0).toFixed(2),
      p.status,
      p.createdAt ? new Date(p.createdAt).toISOString() : ""
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `threadsworks-partners-admin-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPartners = partners.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.userEmail && p.userEmail.toLowerCase().includes(q)) ||
      (p.referralCode && p.referralCode.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in" id="admin-partner-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ShieldCheck className="h-3.5 w-3.5" /> Administrative Controls
          </div>
          <h2 className="text-xl font-bold text-text-primary">
            Partner Program Management & Audit
          </h2>
          <p className="text-xs text-text-secondary">
            Manage registered partners, monitor program liabilities, inspect the immutable audit log, and adjust parameters.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeAdminSubTab === "partners" && partners.length > 0 && (
            <button
              onClick={handleExportPartnersCSV}
              className="px-3 py-2 rounded-xl bg-bg-card border border-border-primary hover:bg-bg-card-hover text-xs font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Export CSV</span>
            </button>
          )}

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

      {/* Overview Metric Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-text-muted">Total Partners</span>
          <div className="text-2xl font-extrabold text-text-primary font-mono">{partners.length}</div>
        </div>

        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-text-muted">Active Referrals</span>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            {partners.reduce((sum, p) => sum + (p.activeCustomers || 0), 0)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-text-muted">Payable Liability</span>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ${partners.reduce((sum, p) => sum + (p.payableBalance || 0), 0).toFixed(2)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-text-muted">Total Paid Out</span>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            ${partners.reduce((sum, p) => sum + (p.paidBalance || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Admin Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-border-primary pb-3">
        <button
          onClick={() => setActiveAdminSubTab("partners")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeAdminSubTab === "partners"
              ? "bg-purple-600 text-white"
              : "bg-bg-card text-text-secondary hover:text-text-primary border border-border-primary"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Partners Roster ({partners.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab("audit")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeAdminSubTab === "audit"
              ? "bg-purple-600 text-white"
              : "bg-bg-card text-text-secondary hover:text-text-primary border border-border-primary"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab("config")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeAdminSubTab === "config"
              ? "bg-purple-600 text-white"
              : "bg-bg-card text-text-secondary hover:text-text-primary border border-border-primary"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Program Parameters</span>
        </button>
      </div>

      {/* Tab 1: Partners List Table */}
      {activeAdminSubTab === "partners" && (
        <div className="rounded-2xl border border-border-primary bg-bg-card overflow-hidden shadow-sm space-y-4">
          <div className="p-4 border-b border-border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search partner by email or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border-primary bg-bg-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="h-6 w-6 text-purple-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-text-muted">Loading partner list...</p>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-muted">
              No partners found matching query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-primary/50 text-[11px] font-mono uppercase font-bold text-text-muted border-b border-border-primary">
                  <tr>
                    <th className="py-3 px-4">Partner</th>
                    <th className="py-3 px-4">Referral Code</th>
                    <th className="py-3 px-4">Clicks / Signups</th>
                    <th className="py-3 px-4">Active MRR</th>
                    <th className="py-3 px-4">Payable Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/50 font-sans">
                  {filteredPartners.map((p) => (
                    <tr key={p.id} className="hover:bg-bg-card-hover/50 transition">
                      <td className="py-3.5 px-4 font-medium text-text-primary">
                        <div>{p.name || p.userEmail}</div>
                        <div className="text-[10px] text-text-muted font-mono">{p.userEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
                        {p.referralCode}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-text-secondary">
                        {p.totalClicks || 0} / {p.totalSignups || 0}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-text-primary font-bold">
                        ${((p.activeCustomers || 0) * 3.50).toFixed(2)}/mo
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        ${(p.payableBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.status === "active" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/20">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(p.id, p.status)}
                          disabled={actionLoading === p.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            p.status === "active"
                              ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20"
                          }`}
                        >
                          {actionLoading === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : p.status === "active" ? (
                            "Suspend"
                          ) : (
                            "Reinstate"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Immutable Audit Log Trail */}
      {activeAdminSubTab === "audit" && (
        <div className="rounded-2xl border border-border-primary bg-bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border-primary">
            <h3 className="text-sm font-bold text-text-primary">System & Administrative Audit Trail</h3>
            <p className="text-xs text-text-secondary">
              Immutable ledger of all administrative actions, financial approvals, status changes, and parameter updates.
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-muted">
              No administrative audit entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-primary/50 text-[11px] font-mono uppercase font-bold text-text-muted border-b border-border-primary">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Admin</th>
                    <th className="py-3 px-4">Target Partner / ID</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/50 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-bg-card-hover/50 transition">
                      <td className="py-3 px-4 font-mono text-text-secondary whitespace-nowrap">
                        {log.createdAt || log.timestamp ? new Date(log.createdAt || log.timestamp).toLocaleString() : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-purple-600 dark:text-purple-400 uppercase text-[11px]">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-text-primary text-[11px]">
                        {log.adminEmail || log.adminId || "System"}
                      </td>
                      <td className="py-3 px-4 font-mono text-text-muted text-[11px]">
                        {log.targetPartnerId || log.targetPayoutId || "-"}
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Program Parameters */}
      {activeAdminSubTab === "config" && (
        <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-6 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text-primary">Global Partner Program Parameters</h3>
            <p className="text-xs text-text-secondary">
              Tune financial and operational thresholds. Changes are immediately recorded in the administrative audit log.
            </p>
          </div>

          {configSavedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Program parameters updated and recorded to audit trail.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-xs font-bold font-mono text-text-secondary uppercase">
                Minimum Payout Threshold (USD):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted font-mono">$</span>
                <input
                  type="number"
                  min="5"
                  step="1"
                  value={minPayoutInput}
                  onChange={(e) => setMinPayoutInput(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border-primary bg-bg-primary text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>
              <p className="text-[11px] text-text-muted">Default: $25.00 minimum for partners to request payout.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold font-mono text-text-secondary uppercase">
                Attribution Window (Days):
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={cookieDaysInput}
                onChange={(e) => setCookieDaysInput(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-border-primary bg-bg-primary text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-purple-500"
              />
              <p className="text-[11px] text-text-muted">Standard rule: 60 days cookie duration + permanent user binding.</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Save Parameters</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
