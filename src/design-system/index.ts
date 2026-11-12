import raw from "../../docs/design-system/COMPONENT_REGISTRY.json";
import { registrySchema, type ComponentEntry } from "./registry";

export * from "./registry";

/** Validated component registry (ADR-004). Throws at import time if the JSON is invalid. */
export const registry = registrySchema.parse(raw);

const byId = new Map(registry.components.map((c) => [c.id, c]));

export function getComponent(id: string): ComponentEntry | undefined {
  return byId.get(id);
}
