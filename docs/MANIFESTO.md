# mar21 Manifesto

`mar21` is an **AI-native Marketing Operating System**: a repo-first, skill-driven way to run marketing as a **repeatable, inspectable engine**.

This is a manifesto *and* an implementation stance. The “operating system” is not a metaphor—it's a set of conventions, contracts, and run artifacts that make marketing work **programmable** without making it **opaque**.

## What `mar21` is optimizing for
- **One-person marketing**: a single operator can go from GTM strategy to day-to-day execution and reporting.
- **End-to-end value creation**: strategy → planning → instrumentation → acquisition → activation → retention → revenue → learning.
- **Cross-channel truth**: combine insights from SEO, analytics, ads, CRM, commerce, CMS, and lifecycle into one coherent decision loop.
- **Self-owned AI competence**: move “AI features” from vendors into *your* system, while still leveraging platform-native AI where it’s useful.
- **Auditability over vibes**: every run produces artifacts you can read, diff, and trust.

## The shift `mar21` is betting on
Marketing work is increasingly split into:
- **strategy and judgment** (human-owned, AI-augmented via deep research + sparring),
- **execution and operations** (repeatable, tool-driven),
- **learning loops** (measurement → insight → iteration).

`mar21` moves day-to-day work toward an **agent-driven engine**: not “AI does marketing”, but “marketing becomes a system that can be orchestrated safely”.

AI’s role in `mar21` strategy is explicit:
- **Deep research**: synthesize market/category signals, competitor positioning, and funnel evidence into a *research pack*.
- **Sparring**: pressure-test assumptions, propose counter-positions, and surface “what would have to be true” for a plan to work.

The operator remains accountable, and that accountability is captured as artifacts (decisions, assumptions, guardrails).

## Core beliefs (non-negotiables)
1) **Context is the source of truth.** Marketing work without a durable context file degenerates into prompt roulette.
2) **Runs are the unit of work.** Every meaningful action happens inside a run with captured inputs, outputs, logs, and approvals.
3) **Plans must be executable.** A plan is only “done” if it includes measurement, ownership, timeline, and the ChangeSet representing the work.
4) **Insights must be connected.** SEO ≠ Ads ≠ CRM ≠ Shopify. The value emerges in the *joins*.
5) **Supervised-by-default is a feature.** Marketing mistakes are expensive; safe autonomy is earned via guardrails, not asserted.
6) **Your AI is an asset.** Your memory, playbooks, and decision logic compound. They should live in your repo, not in a vendor UI.
7) **Interfaces beat prompts.** Skills and connectors are contracts. Prompts are implementation details inside those contracts.
8) **Moving target, stable surface.** The space evolves; `mar21` evolves. But the public interfaces (Context, Skill I/O, ChangeSet) stay stable.

## What “own your AI” means
Owning your AI does **not** mean “ignore vendor AI”.

It means:
- Vendor AI can be **a capability** behind a connector.
- Your system defines **goals, constraints, risk tolerance, and approval policy**.
- Your repo stores **memory**, **evaluations**, and **decision traces**.
- Switching providers should not destroy your operating model.

## Anti-patterns (explicitly rejected)
- **Black-box autopilot**: “trust me” changes without artifacts, approvals, or rollback hints.
- **Single-tool marketing**: optimizing one platform while ignoring downstream conversion and revenue.
- **Unversioned context**: strategy lives in heads, decks, or chat logs (and disappears).
- **Vanity KPI worship**: traffic/CTR without a KPI tree and conversion accounting.
- **Prompt-first workflows**: untyped inputs/outputs that can’t be tested, replayed, or automated safely.
- **Permanent firefighting**: no loops, no baselines, no “what changed” narratives.

## How `mar21` evolves (moving target)
`mar21` treats marketing ops as a product:
- We start with **one tool per angle** (v1) and add depth iteratively.
- We keep the system **composable** so new tools and agents can be added without rewriting the core.
- We prefer **small, safe automations** that earn trust, then expand autonomy.

## Non-goals (for clarity)
- `mar21` is not a replacement for human strategy; it is a **strategy engine (research + sparring) and execution engine**.
- `mar21` is not “LLM wrappers everywhere”; it is **interfaces + evidence + control**.
- `mar21` is not “marketing done for you”; it is **marketing done with leverage**.
