import React from "react";
import { FileText, ShieldCheck, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";

export default function ProgramTermsTab() {
  return (
    <div className="space-y-6 animate-fade-in" id="partner-terms-tab">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text-primary">
          Partner Program Terms & Operational Policies
        </h2>
        <p className="text-xs text-text-secondary">
          Official guidelines governing the ThreadsWorks Partner Program.
        </p>
      </div>

      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-6 shadow-sm text-xs leading-relaxed text-text-secondary">
        {/* Section 1: 50% Recurring Commission */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            1. Commission Structure (50% Recurring)
          </h3>
          <p>
            Partners earn a 50% recurring commission on all eligible gross subscription revenue received by ThreadsWorks ($7.00/month or $59.00/year) from referred customers. This recurring commission is credited on every successful renewal invoice for as long as the referred customer maintains an active paying subscription.
          </p>
        </div>

        {/* Section 2: Attribution Window & Account Binding */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            2. Attribution & Tracking Cookie
          </h3>
          <p>
            Referral links place a 60-day tracking cookie in the prospective user's browser. When the referred visitor signs up for an account, their user ID is permanently bound to the referring Partner in the ThreadsWorks database. Subsequent checkout sessions initiated by that customer are credited to the partner.
          </p>
        </div>

        {/* Section 3: Payout Terms */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            3. Payout Schedule & Minimum Balance
          </h3>
          <p>
            The minimum payout threshold is $25.00 USD. Once your payable balance reaches or exceeds $25.00, you can submit a payout request directly from the Partner Hub. Payouts are reviewed and disbursed via PayPal or Wise within 1 to 3 business days.
          </p>
        </div>

        {/* Section 4: Prohibited Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            4. Prohibited Marketing & Self-Referrals
          </h3>
          <p>
            Partners may not purchase ThreadsWorks subscriptions through their own referral links (self-referrals). Partners may not run paid search advertisements targeting ThreadsWorks trademark terms (e.g. 'ThreadsWorks', 'ThreadsWorks review'). Unsolicited spam, automated DM bots, or deceptive practices are strictly prohibited and result in immediate account termination.
          </p>
        </div>

        {/* Section 5: Refunds & Chargebacks */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-text-primary">
            5. Refunds, Cancellations & Chargebacks
          </h3>
          <p>
            If a customer's subscription payment is refunded or disputed via chargeback, any associated unpaid commission is reversed. Active recurring commissions cease upon customer subscription cancellation.
          </p>
        </div>
      </div>
    </div>
  );
}
