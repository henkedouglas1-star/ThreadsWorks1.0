# Cash Machine AI — Phase 3 Implementation Specification

From structured knowledge architecture to an operational sales intelligence system.

**STATUS: PHASE 3 STARTED**

This specification defines the first implementation layer for Cash Machine AI using the completed Phase 2 curriculum architecture and Phase 2.5 AI systemization.

**Core:** The Cash Machine is the knowledge. Cash Machine AI is the intelligence. ThreadsWorks is the execution environment.

---

## 1. Phase 3 Objective
Build Cash Machine AI as a diagnostic and decision system grounded in the Cash Machine knowledge base. It should not behave like a generic chatbot or a course reader.
The AI's primary job is to determine what is most likely limiting the user's desired outcome, retrieve the relevant knowledge, apply its decision rules, and produce the next useful action.

---

## 2. Runtime Architecture
`USER → CONTEXT → DIAGNOSIS → KNOWLEDGE RETRIEVAL → DECISION → OUTPUT → THREADSWORKS → METRIC → FEEDBACK → NEW DIAGNOSIS`

### Core runtime components:
* **Context Engine:** Maintains the user's business situation, goals, offer, buyer, funnel, metrics, constraints, and current work.
* **Diagnostic Engine:** Classifies symptoms, gathers evidence, tests hypotheses, and identifies the most likely bottleneck or opportunity.
* **Knowledge Retrieval Engine:** Selects relevant class records, frameworks, decision rules, and related knowledge.
* **Decision Engine:** Applies conditions and rules to determine the appropriate next action.
* **Output Engine:** Produces a diagnosis, exercise, decision, asset specification, strategy, or measurement plan.
* **ThreadsWorks Router:** Sends executable content, messaging, campaigns, and related work into ThreadsWorks.
* **Measurement Loop:** Defines success criteria and uses results as evidence for the next diagnosis.

---

## 3. Knowledge Record Contract
Each finalized class becomes a machine-readable record following the locked Phase 2.5 schema:
`ID | SYSTEM | SUBSYSTEM | CLASS | CONCEPT | PROBLEM | FRAMEWORK | DIAGNOSTIC QUESTIONS | INPUTS | DECISION RULES | EXERCISE | OUTPUT / ASSET | THREADSWORKS ACTION | METRICS | RELATED CLASSES`

*Implementation rule:* preserve source-derived terminology and distinguish newly authored material. The original Cash Machine PDF remains the source of truth for source-derived content.

---

## 4. Diagnostic Engine
The diagnostic engine follows this sequence:
`Goal → Stated Problem → Current Situation → Evidence → Hypotheses → Targeted Questions → Bottleneck / Opportunity → Confidence → Next Best Action`

The engine must avoid premature prescriptions. A request such as “I need more followers” is insufficient by itself to recommend more traffic. The system should investigate discovery, lead quality, conversion, offer clarity, or another relevant constraint first.

---

## 5. Knowledge Retrieval
Retrieve by decision relevance, not keyword matching alone. Retrieval should consider: current business stage, diagnostic domain, stated goal, evidence, applicable framework, decision rules, metrics, and relationships to adjacent classes.
Use the smallest sufficient knowledge set. Prefer one primary class plus supporting classes over a curriculum dump.

---

## 6. Decision Response Contract
* **DIAGNOSIS** — What appears to be happening.
* **EVIDENCE** — What supports that conclusion.
* **UNCERTAINTY** — What remains unknown.
* **RELEVANT KNOWLEDGE** — Class/framework selected.
* **DECISION** — What the user should do next and why.
* **OUTPUT** — What will be produced.
* **EXECUTION** — Whether ThreadsWorks should perform the work.
* **METRIC** — What determines whether the intervention worked.

---

## 7. Priority Rules
* Diagnose before prescribing.
* Do not dump the curriculum.
* Do not confuse a metric with an explanation.
* Do not treat a symptom as the root cause without evidence.
* Every recommendation requires a reason.
* Every action should create a concrete output.
* Use the user's actual constraints when selecting an intervention.
* Prefer fixing the current meaningful bottleneck before adding unrelated tactics.
* Do not invent proof, results, customer evidence, or certainty.
* Preserve source integrity.
* Feed results back into diagnosis.

---

## 8. ThreadsWorks Integration
Cash Machine AI decides what should be done. ThreadsWorks handles how the practical work gets executed when the action is supported.
`Routing: Diagnosis → Decision → Asset Specification → ThreadsWorks → Execution → Results`

---

## 9. Phase 3 Build Order
1. **Knowledge ingestion:** Convert source-derived class material into finalized structured records.
2. **Knowledge graph:** Connect classes to problems, frameworks, diagnostics, decisions, metrics, and related classes.
3. **Diagnostic engine:** Implement symptom → evidence → hypothesis → bottleneck reasoning.
4. **Retrieval engine:** Select the most relevant knowledge based on diagnosis and context.
5. **Decision engine:** Apply decision rules and produce the next best action.
6. **Output engine:** Generate concrete outputs and asset specifications.
7. **ThreadsWorks routing:** Connect executable outputs to ThreadsWorks workflows.
8. **Evaluation:** Test the system against realistic sales/marketing scenarios and failure cases.

---

## 10. Initial Acceptance Tests
* **Stated symptom:** User: “I need more followers.” → AI investigates before recommending traffic.
* **Conversion issue:** User has attention but few sales. → AI investigates lead quality, offer, trust, friction, and conversion before prescribing acquisition.
* **Offer issue:** User asks for better sales. → AI checks buyer/problem/positioning/offer context rather than immediately generating a sales script.
* **Metric issue:** User reports a low conversion rate. → AI identifies the stage, volume, context, and likely constraint.
* **Scaling issue:** User wants to scale. → AI checks validation, conversion, acquisition economics, fulfillment, support, and capacity.
* **Ethics issue:** User asks for manipulative urgency. → AI rejects deceptive tactics and offers truthful alternatives.

---

## 11. Phase 3 Starting State
Completed before implementation: 220-class curriculum map, canonical knowledge architecture, standard schema, diagnostic-first operating rules, output model, ThreadsWorks relationship, and feedback loop.
Now starting: converting this specification into the actual Cash Machine AI knowledge and reasoning layer.
Immediate next build: structured knowledge ingestion + diagnostic/retrieval engine.
