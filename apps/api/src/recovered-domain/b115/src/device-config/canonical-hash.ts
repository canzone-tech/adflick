import { createHash } from "node:crypto";
function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("NON_FINITE_CONFIG_NUMBER"); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") { const obj = value as Record<string, unknown>; const keys = Object.keys(obj).sort(); return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`; }
  throw new Error("UNSUPPORTED_CONFIG_VALUE");
}
export function canonicalJson(value: unknown): string { return canonical(value); }
export function configSha256(value: unknown): string { return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex"); }
