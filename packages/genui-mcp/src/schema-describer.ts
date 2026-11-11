/**
 * Recursively introspects any Zod schema and generates a JSON-Schema-like representation
 * for LLMs, IDEs, and MCP clients.
 */
export function describeZodSchema(zodSchema: unknown, depth = 0): Record<string, unknown> {
  if (!zodSchema || typeof zodSchema !== "object" || depth > 8) {
    return { type: "unknown" };
  }

  const s = zodSchema as {
    description?: string;
    def?: {
      type?: string;
      innerType?: unknown;
      options?: unknown[];
      element?: unknown;
      entries?: Record<string, unknown>;
      values?: unknown[];
      items?: unknown[];
    };
    _zod?: {
      def?: {
        type?: string;
        innerType?: unknown;
        options?: unknown[];
        element?: unknown;
        entries?: Record<string, unknown>;
        values?: unknown[];
        items?: unknown[];
      };
    };
    shape?: Record<string, unknown>;
    options?: unknown[];
    minValue?: number | null;
    maxValue?: number | null;
    minLength?: number | null;
    maxLength?: number | null;
  };

  const def = s.def ?? s._zod?.def ?? {};
  const typeName = def.type ?? (s.shape ? "object" : "unknown");

  const result: Record<string, unknown> = {
    type: typeName,
  };

  if (s.description) {
    result.description = s.description;
  }

  switch (typeName) {
    case "string": {
      if (typeof s.minLength === "number") result.minLength = s.minLength;
      if (typeof s.maxLength === "number") result.maxLength = s.maxLength;
      return result;
    }

    case "number":
    case "int": {
      result.type = typeName === "int" ? "integer" : "number";
      if (typeof s.minValue === "number") result.minimum = s.minValue;
      if (typeof s.maxValue === "number") result.maximum = s.maxValue;
      return result;
    }

    case "boolean": {
      return { type: "boolean" };
    }

    case "enum": {
      const opts = Array.isArray(s.options)
        ? s.options
        : def.entries
          ? Object.values(def.entries)
          : [];
      return { type: "string", enum: opts };
    }

    case "literal": {
      const vals = Array.isArray(def.values) ? def.values : [null];
      return { type: "literal", const: vals[0] };
    }

    case "nullable": {
      const inner = describeZodSchema(def.innerType, depth + 1);
      return { ...inner, nullable: true };
    }

    case "optional": {
      const inner = describeZodSchema(def.innerType, depth + 1);
      return { ...inner, optional: true };
    }

    case "array": {
      return {
        type: "array",
        items: describeZodSchema(def.element, depth + 1),
      };
    }

    case "tuple": {
      const items = Array.isArray(def.items)
        ? def.items.map((item) => describeZodSchema(item, depth + 1))
        : [];
      return {
        type: "array",
        items,
        minItems: items.length,
        maxItems: items.length,
      };
    }

    case "union": {
      const options = Array.isArray(def.options)
        ? def.options.map((opt) => describeZodSchema(opt, depth + 1))
        : [];
      return {
        oneOf: options,
      };
    }

    case "object": {
      const shape = s.shape ?? (def.entries as Record<string, unknown>) ?? {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, propSchema] of Object.entries(shape)) {
        properties[key] = describeZodSchema(propSchema, depth + 1);
        const propDef =
          (propSchema as any)?.def ?? (propSchema as any)?._zod?.def ?? {};
        if (propDef.type !== "optional") {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        required,
      };
    }

    default: {
      if (s.shape && typeof s.shape === "object") {
        return describeZodSchema({ ...s, def: { type: "object" } }, depth);
      }
      return result;
    }
  }
}
