# mar21 Best Practices (Evidence-Based Principles)

`mar21` is a marketing OS, not a tool wrapper. That means we encode **principles** into:
- workspace context fields,
- skills and workflow defaults,
- evaluation rubrics,
- and mandatory run artifacts (evidence, sources, decision logs).

This doc lists the **non-negotiable marketing principles** `mar21` should reflect, and how we weave them into the boilerplate foundation.

## 1) Balance long-term brand building and short-term activation
**Principle**: sustainable growth requires investing in both long-term effects (brand) and short-term effects (activation), measured and planned explicitly.

**Evidence**: IPA summary presentation “The Long and the Short of It” (Binet & Field) summarizes principles including integrating brand and activation, share of voice, and measuring short + long-term effects. [R1]

**How `mar21` encodes it**
- Context: add a budget split and time-horizon policy (brand vs activation; 90-day vs 12-month goals).
- Workflows: monthly loop must produce a “brand vs activation” section and a spend allocation rationale.
- Evals: reports must include “short vs long-term effects” notes and planned measurement windows.

## 2) Reach category buyers; don’t over-index on narrow targeting
**Principle**: growth usually comes from reaching a broad set of category buyers, not only hyper-targeted segments.

**Evidence**: IPA “The Long and the Short of It” includes “Talk to all your prospects” as a key principle. [R1]

**How `mar21` encodes it**
- Context: capture the “targeting posture” (broad reach vs narrow) as an explicit choice with guardrails.
- Paid workflows: require a “reach vs precision” tradeoff statement and a test plan.

## 3) Create helpful, people-first content; treat E‑E‑A‑T as quality alignment
**Principle**: content should be created for people (beneficial purpose), and demonstrate trust through experience/expertise/authority signals appropriate to the topic.

**Evidence**: Google’s “Creating helpful, reliable, people-first content” explains E‑E‑A‑T, states trust is most important, and clarifies E‑E‑A‑T is not a single ranking factor but a useful concept for aligning with signals. [R2]

**How `mar21` encodes it**
- Artifacts: for strategy and content work, require `outputs/research_pack.md` with attributable sources and `outputs/decision_log.md`.
- Content skills: include an `content.eeat_review` step that checks “Who/How/Why” clarity and trustworthiness fit for purpose.
- Evals: research packs require citations; reports must link claims to evidence.

## 4) Trust is primary; reputation and independent evidence matter
**Principle**: trust is not only on-page copy—reputation and independent evidence affect perceived quality and decisions.

**Evidence**: Google’s Search Quality Rater Guidelines emphasize trust as the most important part of E‑E‑A‑T, and recommend evaluating what creators say, what others say (independent sources), and what’s visible/testable on the page. [R3]

**How `mar21` encodes it**
- Research workflow: explicitly includes “what others say” sources (public press, reviews, third-party analysis) when applicable.
- Memory: store reputational learnings and recurring objections in `memory/learnings.yaml`.

## 5) SEO fundamentals: crawlability and comprehension before tactics
**Principle**: SEO starts with eligibility (crawl/index/understand), then content and presentation; avoid superstition tactics.

**Evidence**: Google’s SEO Starter Guide focuses on crawlability, descriptive URLs, and calls out common misconceptions. [R4]

**How `mar21` encodes it**
- SEO workflow outputs: include a “technical blockers first” checklist and evidence from GSC.
- Skills: `seo.technical_readiness_check` and `seo.snippet_quality_check` produce evidence artifacts and a ChangeSet of safe tasks.

## 6) Writing must be scannable and understandable (plain language)
**Principle**: web users scan; plain language increases comprehension and reduces friction.

**Evidence**: U.S. government guidance defines plain language as communication your audience can understand the first time they read or hear it; usability research shows users scan and skim web pages. [R5] [R8]

**How `mar21` encodes it**
- Copy skills: `copy.plain_language_check` and `copy.scannability_check` become default gates for landing pages and emails.
- Evals: plan/report templates require “first-time comprehension” checks and simplified CTA language.

## 7) Measure what matters: avoid proxy traps
**Principle**: optimize for business outcomes, not proxies that can be gamed (CTR, sessions) without profit impact.

**Evidence**: Experimentation research highlights the risk of over-relying on proxy metrics and flawed heuristics; Goodhart-like dynamics show how targets can corrupt measures. [R6] [R7]

**How `mar21` encodes it**
- Context: define primary KPI and allowed proxy KPIs per workflow.
- Evals: reports must include a KPI tree and state which node the proposed actions target.

## 8) Join data across tools; always disclose attribution reality
**Principle**: channel data is partial; decisions must use joins (UTM + naming) and disclose uncertainty/unattributed share.

**Evidence**: Google guidance emphasizes user-first content and transparency; `mar21` operationalizes this through explicit evidence links and “Measurement Reality” disclosures. [R2] [R4]

**How `mar21` encodes it**
- Data model: canonical metrics/dimensions and join confidence in `docs/DATA_MODEL.md`.
- Reports: mandatory attribution disclaimer section and unattributed share.

## 9) Deep research + sparring is part of strategy (AI-augmented)
**Principle**: strategy is human-owned but should be AI-augmented via deep research and sparring that pressure-tests assumptions.

**Evidence**: Google’s guidance and rater framework stress trust, original helpfulness, and aligning with what people seek; `mar21` extends this into strategy artifacts with sources and explicit assumptions. [R2] [R3]

**How `mar21` encodes it**
- Workflow: `deep_research_sparring` produces `research_pack.md` (sources) and `decision_log.md`.
- Drive: private-doc ingestion allowed by default (supervised) with caps and redaction.

## 10) Build and protect distinctive assets (consistency compounds)
**Principle**: being recognized quickly and consistently reduces friction and increases effectiveness across channels.

**Evidence**: IPA “The Long and the Short of It” emphasizes the role of distinctive brand assets and creative consistency for effectiveness. [R1]

**How `mar21` encodes it**
- Context: store `brand.distinctiveAssets` and category entry points; require using them in briefs/copy.
- Memory: persist “winning” assets and variations with evidence links.
- Evals: content and ad drafts must include the declared assets unless the plan explicitly justifies deviation.

## 11) Creativity is an efficiency lever (not decoration)
**Principle**: creative quality is a first-order driver of marketing efficiency; treat it as measurable work.

**Evidence**: IPA “The Long and the Short of It” includes “Creativity is the key to effectiveness” and “Creativity increases efficiency”. [R1]

**How `mar21` encodes it**
- Workflows: ads and content workflows must output a creative test plan (what will be varied, why, how measured).
- Evals: plans must state the creative hypothesis and primary success metric (not only CTR).

## Boilerplate weaving checklist (implementation-facing)
When we start coding `repo/`, these principles must appear as:
1) Context fields (explicit choices, constraints, budgets, measurement)
2) Default workflow steps (research → evidence → plan → changeset)
3) Skill gates (plain language, E‑E‑A‑T fit-for-purpose, technical eligibility checks)
4) Evals (schema + rubric compliance; citations required for research)

## References
- [R1] IPA — “The long and the Short of it presentation” (Binet & Field): https://ipa.co.uk/knowledge/documents/the-long-and-the-short-of-it-presentation
- [R2] Google Search Central — “Creating helpful, reliable, people-first content”: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- [R3] Google — Search Quality Evaluator Guidelines (PDF): https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf
- [R4] Google Search Central — “SEO Starter Guide: The Basics”: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- [R5] Digital.gov — “An introduction to plain language”: https://digital.gov/resources/an-introduction-to-plain-language
- [R6] “Profit over Proxies: A Scalable Bayesian Decision Framework for Optimizing Multi-Variant Online Experiments” (arXiv): https://arxiv.org/abs/2509.22677
- [R7] Goodhart’s law (summary): https://en.wikipedia.org/wiki/Goodhart%27s_law
- [R8] Nielsen Norman Group — “How Users Read on the Web”: https://www.nngroup.com/articles/how-users-read-on-the-web/
