# Property-Based Testing (PBT) & Invariant Specification

**Spec ID:** `core-skeleton/correctness`  
**Verification Engine:** `fast-check` (`^4.10.2`) + `vitest` (`^3.0.0`)  
**Target Package:** `@genui-studio/core` (`packages/genui-core`)

---

## 1. Motivation: Why Unit Tests Fail Generative UI
In traditional UI engineering, component trees are statically authored by developers and checked by TypeScript at build time. In **Generative UI**, an LLM emits an untrusted, progressive RFC 6902 JSONL patch stream over an unpredictable network transport. Standard example-based unit tests fail to catch:
1. **Arbitrary TCP/SSE Chunk Boundary Splits:** Multi-line or mid-token UTF-8 / `\r\n` splits across stream chunks, or streams lacking a trailing `\n` before EOF.
2. **Adversarial & Hallucinated Topologies:** Cyclic parent-child pointers (`A -> B -> A`), self-loops (`A -> A`), diamond shared-key aliasing (`A -> C` and `B -> C`), prototype-pollution paths (`/__proto__/isAdmin`), non-finite IEEE-754 floats (`NaN`, `Infinity`, `-0`), and `javascript:` XSS URIs.
3. **Order-Dependent State & Prompt Drift:** Concurrent or out-of-order JSON Pointer state updates where parent/child paths collide (e.g. updating `/form` and `/form/email` in a batch), or non-deterministic LLM system prompt generation caused by JavaScript object key ordering.

To establish **high-confidence empirical coverage**, `@genui-studio/core` translates any registered `@json-render/core` Zod Catalog into a composable `fast-check` Arbitrary (`catalogToSpecArbitrary`) and tests runtime invariants across randomized and shrunk inputs.

---

## 2. Property-Based Invariants

### Property 1: Stream Chunking Invariance (`INV-PBT-01`)
Let $S$ be any valid `Spec` generated from a registered `VerifiedCatalog` $\mathcal{C}$, and let $L = \text{specToJsonlStream}(S)$ be its serialized RFC 6902 JSONL patch stream of byte/character length $N = |L|$.

For any random partition vector $P = (p_1, p_2, \dots, p_k)$ where $0 < p_1 < p_2 < \dots < p_k < N$, define the chunk sequence $c_i = L[p_{i-1} \dots p_i)$.

$$\forall S \in \text{ValidSpecs}(\mathcal{C}), \forall P \in \text{Partitions}(|L|): \quad \text{Finalize}\left(\bigoplus_{i=1}^{k+1} \text{Push}(c_i)\right).\text{spec} \equiv \text{CompileBatch}(L).\text{spec} \equiv S$$

Here $\text{CompileBatch}(L)$ is a single `push(L)` followed by `finalize()` on a fresh compiler.

**What this tests:**
- Line buffering inside `GuardrailedStreamCompiler` is invariant to arbitrary network packet fragmentation, 1-byte drips, `\r\n` vs `\n` line endings, and missing trailing newlines at EOF (`invariants.fuzz.test.ts` "Invariant 1", which asserts both equivalences). SSE `data:` framing and the byte caps are covered separately in `hardening.test.ts`.
- The reusable suite property `INV-PBT-01` in `runCatalogInvariantSuite` checks the first equivalence (chunked ≡ batch) only.

---

### Property 2: Adversarial Payload Resilience & Total Non-Crash Guarantee (`INV-PBT-02`)
Let $\Sigma^*$ be the universe of arbitrary, corrupted, or adversarial string chunks and mutated `Spec` objects containing:
- Prototype pollution vectors: `__proto__`, `constructor`, `prototype` in JSON Patch paths or element keys.
- Non-finite and boundary numbers: `NaN`, `+Infinity`, `-Infinity`, `-0`, `Number.MAX_SAFE_INTEGER + 1`, out-of-range `.min()`/`.max()` numbers.
- Graph pathologies: Direct self-cycles (`u -> u`), multi-hop cycles (`u -> v -> w -> u`), slot cycles (`slots.header -> u`), duplicate sibling keys (`children: ["x", "x"]`), dangling references, and deep chains ($d > \text{maxDepth}$).
- XSS & injection payloads: `javascript:alert(1)`, `data:text/html,<script>`, `vbscript:`.

$$\forall x \in \Sigma^*: \quad \text{ Evaluate}(x) \implies \neg\text{Throws}(x) \;\land\; \text{Object.prototype.polluted} = \text{undefined} \;\land\; \text{IsDAG}(\text{Result}(x).\text{spec})$$

Furthermore, for any sanitized spec $S' = \text{sanitizeSpecGraph}(S).\text{spec}$:
1. **Acyclicity:** $\text{inspectSpecGraph}(S').\text{hasCycles} = \text{false}$.
2. **Bounded Depth & Budget:** $\text{depth}(S') \le \text{maxDepth} \;\land\; |S'.\text{elements}| \le \text{maxElements}$.
3. **Idempotence:** $\text{sanitizeSpecGraph}(S').\text{spec} \equiv S'$.

---

### Property 3: State Pointer Idempotency, Determinism & Session Isolation (`INV-PBT-03`)
Let $\mathcal{M}_1, \mathcal{M}_2$ be two independent `TimeTravelStateStore` instances initialized with state $S_0$.

1. **Pointer Idempotency:** Applying the same value $v$ at JSON Pointer path $p$ twice produces zero redundant state transitions or history entries:
   $$\mathcal{M}_1.\text{set}(p, v); \; h_1 = |\mathcal{M}_1.\text{getHistory}()|; \; \mathcal{M}_1.\text{set}(p, v) \implies |\mathcal{M}_1.\text{getHistory}()| = h_1$$
2. **Batch Permutation Determinism:** For any set of pairwise-disjoint JSON Pointer updates $U = \{(p_1, v_1), \dots, (p_m, v_m)\}$ and any permutation $\pi \in S_m$:
   $$\text{Apply}(\mathcal{M}_1, U) \implies \mathcal{M}_1.\text{getSnapshot}() \equiv \text{Apply}(\mathcal{M}_2, \pi(U)).\text{getSnapshot}()$$
3. **Structural Sharing & Isolation:** Mutating $\mathcal{M}_1$ at path `/a/b` never mutates $\mathcal{M}_2$ and preserves strict `===` object reference equality on all disjoint branches `/c` in $\mathcal{M}_1$.
4. **Time-Travel Invertibility:** Performing $k$ mutations followed by $k$ `undo()` calls restores a snapshot deeply equal to $S_0$, and $k$ subsequent `redo()` calls restore the exact terminal snapshot.

All four sub-properties are asserted by `invariants.fuzz.test.ts` "Invariant 3". The reusable suite property `INV-PBT-03` covers 1, 2 and session isolation; it does not check `===` sharing or undo/redo.

---

### Property 4: Catalog-to-Prompt & Fingerprint Determinism (`INV-PBT-04`)
Let $\mathcal{C}_A$ and $\mathcal{C}_B$ be two catalog definitions containing the exact same set of component schemas and action definitions, but constructed with arbitrary key insertion permutations $\pi_{\text{comp}}, \pi_{\text{props}}, \pi_{\text{act}}$.

$$\forall \pi_{\text{comp}}, \pi_{\text{props}}, \pi_{\text{act}}: \quad \text{createVerifiedCatalog}(\mathcal{C}_A).\text{metadata.catalogHash} === \text{createVerifiedCatalog}(\mathcal{C}_B).\text{metadata.catalogHash}$$
$$\land \quad \text{createVerifiedCatalog}(\mathcal{C}_A).\text{prompt}(\text{opts}) === \text{createVerifiedCatalog}(\mathcal{C}_B).\text{prompt}(\text{opts})$$

**What this tests:**
- System prompt compilation and synchronous FIPS 180-4 SHA-256 schema fingerprinting over canonical UTF-8 JSON are deterministic and immune to V8 key-insertion order variance (`invariants.fuzz.test.ts` "Invariant 4" permutes component, prop and action keys; `hardening.test.ts` checks hash order invariance and SHA-256 against `node:crypto`).
- The reusable suite property `INV-PBT-04` is narrower: it reverses the `customRules` order on one catalog and checks that every component name appears in the prompt. No test asserts that every prop key and action name appears in the prompt.

---

## 3. Real Edge-Case Bugs Caught by `fast-check` Shrinking (Engineering Log)

During Phase 2 development of `@genui-studio/core`, `fast-check` shrinking uncovered **5 subtle edge-case bugs** in standard JSON Patch and spec handling that traditional unit tests missed:

| Bug ID | Shrunk Counterexample Discovered by `fast-check` | Root Cause | Fix Implemented in `@genui-studio/core` |
| :--- | :--- | :--- | :--- |
| **BUG-PBT-01** | Stream chunk ending without trailing `\n` on final line: `{"op":"add","path":"/root","value":"el-0"}` | `@json-render/core`'s `createSpecStreamCompiler().push()` buffers lines until `\n` is seen; if an LLM stream closes at EOF without a trailing newline, the final patch stays trapped in the internal buffer. | `GuardrailedStreamCompiler` keeps its own line buffer (it does not wrap `createSpecStreamCompiler`). `finalize()` splits any residual un-newlined buffer on `\n` and processes those lines before running final DAG sanitization. |
| **BUG-PBT-02** | `applySpecStreamPatch` given `{"op":"replace","path":"/elements/card-1/props/count","value":-0}` or `NaN` | `JSON.stringify(-0)` yields `"0"`, and `NaN`/`Infinity` serialize to `null` in JSON, causing round-trip state mismatch (`Object.is(-0, +0) === false`) and broken numeric comparisons in UI components. | `deepCloneAndSanitizeValue()` (used by both `sanitizeSpecGraph` and `TimeTravelStateStore`) canonicalizes `-0 -> 0` and heals `NaN`/`Infinity` to `0`, incrementing `healedNumbersCount` and recording a `healed_non_finite_number` issue. |
| **BUG-PBT-03** | Diamond / duplicate child reference: `elements["root"].children = ["item-1", "item-1"]` | Standard 3-color cycle detection (`GRAY` check) only catches ancestor back-edges (`A -> B -> A`), allowing the same child key `"item-1"` to be visited twice (`BLACK`) under the same parent or across two parents, causing React duplicate `key` collisions and shared state corruption. | Upgraded `sanitizeSpecGraph` to track a global `mountedNodes: Set<string>` in addition to the recursion-stack `GRAY` set, deduplicating repeated sibling keys and preventing multi-parent node aliasing. |
| **BUG-PBT-04** | Batch `store.update({ "/a/b": 1, "/a": { b: 2 } })` vs `{ "/a": { b: 2 }, "/a/b": 1 }` | JavaScript object key iteration order follows insertion order; applying a parent path `/a` after child path `/a/b` overwrote the child path depending on key order. | `TimeTravelStateStore.update()` sorts all JSON Pointers by path depth (shallowest first), then by `a.localeCompare(b)`, before applying `immutableSetByPath`, guaranteeing 100% permutation-independent determinism. |
| **BUG-PBT-05** | Throwing leaf component (`MetricGauge` with `TRIGGER_CRASH`) rendered via `renderToStaticMarkup` in Node/SSR | React's `react-dom/server` renderer does not invoke class `ErrorBoundary.getDerivedStateFromError` during synchronous SSR passes, causing a leaf throw to abort the entire SSR tree. | Upgraded `wrapRegistryWithTelemetry()` to combine a synchronous `try / catch` invocation around the `@json-render/react` component function with a client-side `<GenUIElementErrorBoundary>` class boundary, guaranteeing leaf fault quarantine in both SSR and client DOM. |
