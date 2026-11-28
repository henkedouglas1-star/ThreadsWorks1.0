import React, { useEffect, useState } from "react";
import { MEMBERSHIP_PLANS } from "../../data/membershipCatalog";
import { ecosystemFetch } from "../../services/ecosystemClient";

type Access = { planIds: string[]; appIds: string[]; checkoutEnabled: boolean };
export function MembershipPanel({ onOpenThreadsWorksPricing }: { onOpenThreadsWorksPricing: () => void }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setError(""); setAccess(null);
    ecosystemFetch<Access>("/api/ecosystem/memberships/access").then(value => {
      if (current) setAccess(value);
    }).catch(() => { if (current) setError("Membership status could not be verified. Refresh to retry."); });
    return () => { current = false; };
  }, [revision]);

  async function purchase(planId: string) {
    if (busy || !access?.checkoutEnabled) return;
    setBusy(planId); setError("");
    try {
      const result = await ecosystemFetch<{url: string}>("/api/ecosystem/memberships/checkout", {method: "POST", body: {planId}});
      const url = new URL(result.url);
      if (url.origin !== "https://buy.stripe.com" || url.username || url.password) throw new Error("Invalid checkout destination.");
      window.location.assign(url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout unavailable.");
    } finally { setBusy(null); }
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Memberships</h2><p className="text-sm text-slate-600 dark:text-zinc-300">Choose the access that fits your business.</p></div>
      <button type="button" onClick={()=>setRevision(n=>n+1)} className="rounded-lg border border-slate-300 dark:border-zinc-700 px-3 py-2 text-sm">Refresh access</button>
    </div>
    {!access && !error && <p role="status" className="text-sm">Checking membership status…</p>}
    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {MEMBERSHIP_PLANS.filter(plan=>!plan.id.startsWith("app-")).map(plan => {
        const active = access?.planIds.includes(plan.id) || (plan.id === "contentpaysclub" && access?.appIds.includes("club"));
        const existing = plan.checkout === "existing";
        return <article key={plan.id} className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3">
          <h3 className="font-bold">{plan.name}</h3>
          <p><span className="text-2xl font-bold">${(plan.monthlyCents || 0)/100}</span><span className="text-sm"> / month</span></p>
          <p className="text-sm flex-1">{plan.value}</p>
          {plan.id === "free" ? <p className="text-sm">Available to all signed-in members</p> : active ? <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Included in your membership</p> : existing ?
            <button type="button" onClick={onOpenThreadsWorksPricing} className="rounded-lg bg-indigo-600 px-3 py-2 text-white text-sm font-semibold">View ThreadsWorks plans</button> :
            <button type="button" onClick={()=>purchase(plan.id)} disabled={!access?.checkoutEnabled || Boolean(busy)} className="rounded-lg bg-indigo-600 px-3 py-2 text-white text-sm font-semibold disabled:opacity-50">{busy === plan.id ? "Opening checkout…" : access?.checkoutEnabled ? "Subscribe with Stripe" : "Not available for purchase yet"}</button>}
        </article>;
      })}
    </div>
    <p className="text-xs text-slate-600 dark:text-zinc-300">New paid plans will be available after their features and billing are verified. Individual app pricing is not finalized. Access is confirmed by the server, not by a checkout redirect.</p>
  </section>;
}
