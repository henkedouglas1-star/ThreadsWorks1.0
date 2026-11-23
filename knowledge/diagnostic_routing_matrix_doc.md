# Cash Machine AI — Diagnostic Routing Matrix

Phase 3 implementation artifact. This matrix routes user situations toward relevant Cash Machine knowledge. It is a routing layer, not a replacement for the source material.

| Domain | Core Question | Classes | Routing Logic |
| :--- | :--- | :--- | :--- |
| **Demand / Market** | Is there demand? Is the market worth serving? | 15–30, 49–64 | Validate problem, demand, market, accessibility, fit. |
| **Buyer** | Who has the problem and how do they decide? | 1–14, 31–36 | Clarify buyer, motivation, awareness, criteria, constraints, risk. |
| **Research** | What evidence exists? | 37–48 | Research customers, language, patterns, needs, objections. |
| **Positioning** | Does the buyer understand relevance and differentiation? | 65–78 | Clarify category, position, differentiation, specificity, consistency. |
| **Offer** | Is the offer clear, valuable, appropriate, and low-friction? | 79–98 | Diagnose problem, outcome, transformation, value, risk, price, CTA, buying experience. |
| **Acquisition** | Are the right people finding and entering the system? | 99–132 | Diagnose prospecting, channels, organic/paid acquisition, leads, lead magnets, content, nurturing. |
| **Qualification** | Are interested people becoming genuine opportunities? | 102, 130, 178, 198, 207 | Evaluate fit, need, importance, timing, ability, decision process, readiness. |
| **Conversation / Sales** | Are conversations creating movement toward a decision? | 99–120, 133–149 | Diagnose questions, listening, emotion, uncertainty, value, objections, negotiation, close, follow-up. |
| **Conversion** | Where are buyers dropping out? | 89–98, 118–119, 163, 168–169, 201–202, 209–210 | Locate stage loss, then investigate trust, value, risk, friction, clarity. |
| **Customer / Retention** | Is delivery creating continued value? | 150–159 | Diagnose onboarding, delivery, experience, problems, refunds, retention, repeat purchase, referrals. |
| **Economics** | Does the sales system make financial sense? | 160–167, 190–193, 212 | Evaluate conversion, AOV, CAC, LTV, sales cycle, revenue targets, forecasting. |
| **Operations / Scale** | Can the system repeat and handle more volume? | 170–205, 213, 220 | Evaluate pipeline, process, activity, bottlenecks, capacity, automation, scaling, repeatability. |
| **Ethics / Fit** | Should the sale happen at all, and is the approach ethical? | 140–149, 219 | Protect buyer autonomy, value, reputation, fit, and truthful communication. |

**Routing principle:**
stated symptom → evidence → diagnostic domain → relevant classes → framework → decision → output → ThreadsWorks execution → metric → next diagnosis.
