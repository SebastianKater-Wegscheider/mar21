# mar21 Glossary

**Workspace**  
A self-contained marketing “instance” for a brand/client: context + secrets + memory + runs.

**Run**  
The unit of work. A run is a folder containing inputs, outputs, logs, approvals, and a ChangeSet.

**Plan** (`outputs/plan.md`)  
The executable plan for a run: goal, KPI tree, hypotheses, tasks, measurement, guardrails.

**Report** (`outputs/report.md`)  
The narrative explanation: what changed, why, what we’ll do, risks, next checkpoint.

**ChangeSet** (`changeset.yaml`)  
The machine-actionable list of operations to perform (tool-scoped, risk-labeled, approval-aware).

**Skill**  
A typed, code-first unit of marketing work. It consumes inputs + connector capabilities and produces validated outputs and artifacts.

**Connector**  
The integration boundary to external tools (auth + API calls + capability declarations + safety).

**Capability**  
A stable, named operation a connector provides (e.g. `ga4.read.report.run`). Skills reference capabilities.

**Mode**  
Run-level safety mode: `advisory`, `supervised` (default), or `autonomous` (allowlist only).

**Autopilot**  
A loop runner that executes scheduled runs (daily/weekly/monthly) while respecting mode and allowlists.

**Memory**  
Human-readable files that store learnings, winners/losers, exclusions, and durable marketing knowledge that compounds across runs.

