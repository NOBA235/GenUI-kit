# Requirements Document: Application #1 — RevOps / FinOps Generative Command Center (`@genui-studio/finops-command`)

## 1. Introduction & Product Vision
The **RevOps / FinOps Generative Command Center** (`apps/finops-command`) is the first production vertical built on top of the `@genui-studio/core` Skeleton Engine. Designed for SaaS founders, finance operators, and Stripe billing engineers, it replaces static 15-tab financial dashboards and text-only chatbots with a guardrailed, real-time Generative UI workspace.

When an operator types a natural-language financial intent or triggers a live operational playbook, the system streams RFC 6902 JSONL patches through `GuardrailedStreamCompiler`, validates every component against a 14-component Zod catalog (`finopsVerifiedCatalog`), binds interactive charts and WCAG-compliant sortable data tables to a seeded 240-account SaaS ledger inside `TimeTravelStateStore`, and executes real financial mutations with one-click Time-Travel Undo/Redo.

---

## 2. EARS Functional & Non-Functional Requirements

### Requirement 1: 14-Component Guardrailed FinOps Catalog & Registry Parity
**User Story:** As a FinOps platform engineer, I want a strictly typed 14-component Zod catalog synchronized 1:1 with React components and fallback props, so that any AI-generated financial workspace renders safely without raw JSX or schema drift.

#### Acceptance Criteria
1. **WHEN** `finopsVerifiedCatalog` is initialized via `createVerifiedCatalog`, **THE SYSTEM SHALL** register at least 14 domain components (`WorkspaceShell`, `SectionGrid`, `KpiMetricCard`, `MrrChurnChart`, `CohortRetentionMatrix`, `AnomalyAlertCard`, `CustomerLedgerTable`, `WebhookStreamTicker`, `IssueRefundCard`, `ExtendTrialCard`, `RetryWebhookCard`, `RetentionDiscountCard`, `RevenueWaterfallCard`, and `AuditTrailBanner`) and 4 typed mutation actions (`issuePartialRefund`, `extendTrialPeriod`, `retryFailedWebhook`, `applyRetentionDiscount`).
2. **WHEN** `auditCatalogRegistryParity` is executed against `finopsVerifiedCatalog` and `createFinOpsRegistry()`, **THE SYSTEM SHALL** report `synchronized: true` with zero missing components, zero extra components, and zero missing actions.
3. **IF** an LLM streams an out-of-bounds number (such as `discountPercent: 999`) or an invalid enum value for any FinOps component, **THEN THE SYSTEM SHALL** clamp or heal the offending property using the component's Zod bounds and `fallbackProps`, render an inspectable `<DiagnosticHealedBadge />`, and preserve sibling rendering.

---

### Requirement 2: Stateful 240-Account SaaS Ledger & Real Financial Mutations
**User Story:** As a SaaS finance operator, I want the generated UI cards and tables to bind to a realistic 240-account subscription ledger that genuinely mutates when I execute a refund, trial extension, webhook retry, or retention discount, with full Time-Travel Undo/Redo support.

#### Acceptance Criteria
1. **WHEN** the application initializes, **THE SYSTEM SHALL** seed a deterministic `TimeTravelStateStore` containing 240 SaaS customer accounts (`acct_1001` through `acct_1240`), 12 months of MRR waterfall history, 6 regional retention cohorts (`NA`, `EMEA`, `APAC`, `LATAM`), live Stripe/Adyen webhook records, and an immutable operator audit log.
2. **WHEN** an operator executes the `IssueRefundCard`, `ExtendTrialCard`, `RetryWebhookCard`, or `RetentionDiscountCard` mutation, **THE SYSTEM SHALL** validate all input constraints, atomically update `/ledger/accounts`, `/ledger/webhooks`, `/ledger/metrics`, and `/ledger/auditLog` inside `TimeTravelStateStore`, and immediately reflect the new Net MRR, Disputed Balance, and Failed Charge counts across all bound KPI cards and tables.
3. **WHEN** an operator clicks **Undo** or **Redo** in the top telemetry bar, **THE SYSTEM SHALL** restore the exact prior or subsequent ledger state snapshot via `TimeTravelStateStore` in $O(1)$ time.

---

### Requirement 3: Accessible Sortable Ledger Table & Post-Interaction Form Validation
**User Story:** As a billing analyst, I want the 240-account ledger table and mutation forms to follow modern web accessibility standards, including ARIA sort states, container-query responsive layouts, light-dismiss confirmation dialogs, and non-premature input validation.

#### Acceptance Criteria
1. **WHILE** rendering `CustomerLedgerTable`, **THE SYSTEM SHALL** place `<button type="button">` elements inside sortable `<th scope="col">` headers, apply `aria-sort="ascending" | "descending"` **only** to the currently active sorted column (omitting `aria-sort` on unsorted columns), sort text via `Intl.Collator`, sort numeric columns via raw numeric values, and wrap the table inside a focusable `<div tabIndex={0} role="region" aria-labelledby={captionId} className="table-wrapper">`.
2. **WHILE** rendering `IssueRefundCard`, `ExtendTrialCard`, and `RetentionDiscountCard`, **THE SYSTEM SHALL** display `.field-hint` constraints above each `<input>` bound via `aria-describedby`, initialize `aria-invalid="false"`, and apply error styling only after user interaction (`:user-invalid` / `.user-invalid-fallback`).
3. **WHEN** a modal `<dialog>` (confirmation gate or Spec & Telemetry X-Ray Drawer) is opened via `showModal()`, **THE SYSTEM SHALL** include `closedby="any"` and attach a programmatic backdrop-click fallback (`getBoundingClientRect()`) for browsers without native `closedBy` support.

---

### Requirement 4: Dual-Mode RFC 6902 JSONL Streaming (Live LLM SSE + Recorded Judge Mode)
**User Story:** As a hackathon judge or enterprise operator, I want the application to support both real LLM API streaming and zero-configuration Recorded Stream Replay / Intent Synthesis Mode so every workspace streams chunk-by-chunk through the real `GuardrailedStreamCompiler` without fake `setTimeout` mock screens.

#### Acceptance Criteria
1. **WHILE** operating in Recorded Judge Mode (default, no API key required), **THE SYSTEM SHALL** stream authentic RFC 6902 JSON Patch lines (`SpecStreamLine`) chunk-by-chunk through `createGuardrailedStreamCompiler` for both preset playbooks and custom natural-language prompts.
2. **WHILE** operating in Live LLM Endpoint Mode with an OpenAI-compatible API key configured, **THE SYSTEM SHALL** compile the deterministic system prompt via `finopsVerifiedCatalog.prompt()` and stream live SSE delta chunks directly into `createGuardrailedStreamCompiler`.

---

### Requirement 5: Built-In Spec & Telemetry X-Ray Drawer & Chaos Packet Injector
**User Story:** As a Kiroween judge evaluating Technological Implementation, I want a toggleable Spec & Telemetry X-Ray Drawer with a one-click "Inject Corrupted / Hallucinated AI Packet" button and an in-browser `fast-check` runner so I can visually verify how `@genui-studio/core` heals bad LLM output and quarantines crashes without breaking the dashboard.

#### Acceptance Criteria
1. **WHEN** the operator opens the Spec & Telemetry X-Ray Drawer, **THE SYSTEM SHALL** display live arriving RFC 6902 JSONL patch frames, real-time `StreamTelemetrySnapshot` counters (`tokensPerSec`, `patchCount`, `lastValidationLatencyMs`, `schemaComplianceRate`, `healedPropsCount`, `severedCyclesCount`), the deterministic `catalogHash`, and an interactive `fast-check` PBT runner button.
2. **WHEN** the operator clicks **"⚡ Inject Corrupted / Hallucinated AI Packet"**, **THE SYSTEM SHALL** push a hostile RFC 6902 JSONL batch into the active `GuardrailedStreamCompiler` containing:
   - A `__proto__` prototype pollution patch (which **SHALL** be blocked at the sanitizer boundary),
   - A cyclic child reference back to the root node (which **SHALL** be severed by `sanitizeSpecGraph`),
   - A `RetentionDiscountCard` with an out-of-bounds `discountPercent: 999` (which **SHALL** be clamped to `50%` and tagged with `<DiagnosticHealedBadge />`), and
   - A throwing leaf component + an unregistered hallucinated component type (both of which **SHALL** be quarantined inside `<ElementFaultCard />` while the parent FinOps Command Center remains 100% interactive).
