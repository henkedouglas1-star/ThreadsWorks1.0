# ThreadsWorks AI Writer — acceptance test

This is a **manual product test**, not a claim that automated unit tests measure creativity. Run against the updated Google AI Studio preview only **after** CI passes and the reviewed branch is merged or a safe branch preview is available.

## Setup
- Sign in with a test creator account; confirm creator profile, tone, audience and content pillars are populated.
- Use the normal **Content Engine** generation flow, without publishing or scheduling.
- Capture the input, output, and any errors. Do not expose credentials or personal data.

## Three representative prompts
1. **Concrete creator insight:** "Most creators don't struggle with ideas. They struggle with turning their ideas into finished content."
2. **Personal experience:** "I spent a shift restocking a busy coffee shop while handling interruptions and prioritizing customers." (Only use this as first-person fact if present in the test creator's supplied background.)
3. **Practical teaching:** "Explain how to turn one idea into three distinct Threads posts without repeating the same hook."

For each prompt, generate the normal batch twice. Check that the posts respect the actual account settings and limits.

## Review rubric (score each dimension 1–5)
| Dimension | 1 = fails | 3 = usable | 5 = excellent |
| --- | --- | --- | --- |
| Specificity | Vague platitudes | One concrete insight | Sharp, grounded, memorable |
| Hook | Generic opener | Clear reason to read | Distinctive, immediately compelling |
| Variety | Repeated ideas | Some differentiation | Clearly different angles and structures |
| Creator fit | Generic or invented identity | Mostly on-brand | Matches stated audience, voice, and expertise |
| Publishability | Extensive rewrite | Minor edits | Ready to post as-is |

**Hard failures regardless of score:** fabricated personal experiences, invented metrics, unsupported claims, copied background instructions, duplicated hooks, broken links, content exceeding Threads character limits, wrong creator identity, and missing posts.

## Acceptance
- All three prompts complete without errors and without hard failures.
- Every dimension averages **at least 4/5** across the tested posts.
- The two batches do not recycle hooks or angles.
- Compare a few outputs against the currently deployed writer to verify an actual quality improvement, not merely successful compilation.

Record failed examples verbatim, with the test input and creator settings, before changing prompts. Do not merge solely on this scorecard: CI must pass separately.
