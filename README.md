# mar21
**AI-native Marketing Operating System** — an open-source boilerplate for *one-person marketing* from GTM strategy to operational execution and reporting.

`mar21` is not “a few automations”. It is a **repository convention + skill system + connector interfaces + CLI agent surface** that lets an operator run marketing as an **auditable engine**:

- **Context-first**: persistent marketing context lives in versioned YAML (company, model, KPIs, constraints, risk).
- **Run-based**: work happens in runs that always emit **Plan + Report + ChangeSet**.
- **Supervised-by-default**: the agent proposes changes; you approve (or opt-in to safe autopilot).
- **Connector-driven**: first-class interfaces to typical marketing tools (v1: GSC, GA4, Meta Ads, HubSpot, Shopify, WordPress, Slack, Klaviyo).
- **Own your AI**: keep competence, memory, and decision logic in *your* repo; still leverage platform-native AI where helpful.
- **Moving target**: this repo is designed to evolve with the space—one step at a time, with stable interfaces.

## What’s in this repo (today)
Docs are the product for v0: the manifesto + the decision-complete interfaces you’ll build against.

- `docs/presentation/index.html` — pitch deck (open locally in a browser)
- `docs/MANIFESTO.md` — beliefs, principles, anti-patterns
- `docs/ARCHITECTURE.md` — system decomposition + repo layout (TypeScript/Node monorepo)
- `docs/SPECS.md` — canonical file formats and contracts (context, skills, connectors, ChangeSet YAML, runs, memory)
- `docs/WORKFLOWS.md` — operator playbook (8 workflows + daily/weekly/monthly loops)
- `docs/CONNECTORS.md` — per-tool integration boundaries and capabilities (v1 tools)
- `docs/connectors/README.md` — exhaustive per-tool capability catalogs (v1)
- `docs/SECURITY.md` — secrets, approvals, redaction, retention (GDPR-first)
- `docs/ROADMAP.md` — how `mar21` evolves (interfaces stable, implementations iterate)
- `docs/GLOSSARY.md` — shared vocabulary (runs, skills, ChangeSets, capabilities)
- `docs/EXAMPLES.md` — concrete example artifacts (context, run, ChangeSet)
- `docs/CLI.md` — CLI UX spec (commands, prompts, exit codes)
- `docs/DATA_MODEL.md` — canonical metrics, joins, attribution disclaimers
- `docs/EVALS.md` — quality gates and golden-run fixtures
- `docs/DEV.md` — implementation guide (Node 20 + pnpm, `_cfg/` overrides)
- `docs/VERSIONING.md` — compatibility policy for the stable surface
- `docs/SCHEMAS.md` — schema strategy + mapping
- `docs/GOVERNANCE.md` — maintainer model + security reporting
- `docs/STRUCTURE_PATTERNS.md` — standardized repo patterns (`_cfg/`, manifests, runs)
- `docs/BEST_PRACTICES.md` — evidence-based marketing principles encoded into the OS
- `docs/BACKLOG.md` — concept gaps turned into concrete spec backlog
- `docs/CREATIVE.md` — creative briefs, asset manifests, fatigue, distinctive assets
- `docs/DISTRIBUTION.md` — owned/earned/paid distribution planning and repurposing
- `docs/TASKS.md` — task system (`todos.yaml` + `mar21.todo.*` ops) for non-API work
- `CONTRIBUTING.md` — contribution guidelines (docs-first, interface stability)

## Mental model
1) **You** declare what “good marketing” means (KPIs, constraints, budget, voice, risk tolerance).
2) **Connectors** fetch reality (GSC/GA4/Ads/CRM/Commerce/CMS).
3) **Skills** turn reality into decisions (analysis → hypotheses → actions).
4) **Runs** persist everything (inputs, outputs, logs, approvals).
5) **ChangeSets** encode concrete actions (tool-scoped operations) that can be reviewed and applied.

## Proposed CLI surface (spec)
This repo specifies an opinionated CLI, even before code exists:

```bash
mar21 init --workspace acme
mar21 plan gtm --workspace acme

mar21 analyze week --workspace acme
mar21 report weekly --workspace acme

mar21 run daily --workspace acme
mar21 run weekly --workspace acme
mar21 autopilot start --profile daily --workspace acme
```

## License
Apache-2.0 — see `LICENSE`.

## Contributing
See `CONTRIBUTING.md`.

## Next
Start with the docs:
- Read `docs/MANIFESTO.md`
- Then `docs/ARCHITECTURE.md`
- Then build to `docs/SPECS.md`
- Operate via `docs/WORKFLOWS.md`
- Deep-dive integrations in `docs/CONNECTORS.md`
