# Playbook: Converting Standard React Components into Guardrailed GenUI Catalogs

## 1. Anatomy of a Component Transformation

### Before: Standard Unconstrained React Component
```tsx
interface ServiceNodeCardProps {
  serviceName: string;
  latencyMs: number;
  isDegraded?: boolean;
  onRestart?: () => void;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}

export function ServiceNodeCard({
  serviceName,
  latencyMs,
  isDegraded = false,
  onRestart,
  headerActions,
  children,
}: ServiceNodeCardProps) {
  return (
    <section className={isDegraded ? "border-red-500" : "border-zinc-800"}>
      <header>
        <h4>{serviceName} ({latencyMs}ms)</h4>
        <div>{headerActions}</div>
        <button onClick={onRestart}>Restart</button>
      </header>
      <div>{children}</div>
    </section>
  );
}
```

### After: Guardrailed `@json-render` Catalog & Registry Entry

#### Step A: Catalog Definition (`catalog.ts`)
- Replace `React.ReactNode` props (`headerActions`) with named `slots: ["default", "headerActions"]`.
- Replace callback props (`onRestart`) with semantic events (`events: ["restart"]`) bound via `UIElement.on`.
- Replace optional `?` primitives with `.nullable()` for LLM structured-output compatibility.

```typescript
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const sreCatalog = defineCatalog(schema, {
  components: {
    ServiceNodeCard: {
      props: z.object({
        serviceName: z.string(),
        latencyMs: z.number(),
        isDegraded: z.boolean().nullable(),
      }),
      slots: ["default", "headerActions"],
      events: ["restart"],
      description: "Displays an SRE service health card with latency telemetry, header slot, and restart event.",
    },
  },
  actions: {
    restartService: {
      params: z.object({
        serviceName: z.string(),
      }),
      description: "Restarts the target microservice and resets its latency counter.",
    },
  },
});
```

#### Step B: Registry Mapping (`registry.tsx`)
```tsx
import { defineRegistry } from "@json-render/react";
import { sreCatalog } from "./catalog";

export const { registry, handlers } = defineRegistry(sreCatalog, {
  components: {
    ServiceNodeCard: ({ props, children, slots, emit }) => (
      <section className={props.isDegraded ? "border-red-500" : "border-zinc-800"}>
        <header>
          <h4>{props.serviceName} ({props.latencyMs}ms)</h4>
          <div>{slots?.headerActions}</div>
          <button type="button" onClick={() => emit("restart")}>
            Restart
          </button>
        </header>
        <div>{children}</div>
      </section>
    ),
  },
  actions: {
    restartService: async (params, setState) => {
      if (!params) return;
      setState((prev) => ({
        ...prev,
        lastRestarted: params.serviceName,
      }));
    },
  },
});
```

---

## 2. Dynamic Repeat Lists & Per-Item Two-Way Binding (`$item`, `$index`, `$bindItem`)

When rendering dynamic collections from `StateStore`:
1. Set `repeat: { statePath: "/incidents", key: "id" }` on the container `UIElement`.
2. Inside child elements, read fields with `{ "$item": "title" }`, read the array index with `{ "$index": true }`, and two-way bind item fields with `{ "$bindItem": "acknowledged" }`.
3. To filter repeated items (e.g., showing only critical incidents), place an `$item` visibility condition directly on the repeat container:
   ```json
   {
     "type": "Stack",
     "props": { "direction": "vertical", "gap": "sm" },
     "repeat": { "statePath": "/incidents", "key": "id" },
     "visible": { "$item": "severity", "eq": "critical" },
     "children": ["incident-row-1"]
   }
   ```
