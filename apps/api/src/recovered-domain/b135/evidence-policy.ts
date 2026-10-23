import type { EvidenceItem } from "./types";

export interface EvidencePolicy {
  allowedMimeTypes: string[];
  maxFileBytes: number;
  maxFiles: number;
}

function hasUnsafeFileName(fileName: string): boolean {
  return fileName.trim() === ""
    || fileName.includes("/")
    || fileName.includes("\\")
    || [...fileName].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f);
}

export function validateEvidence(items: EvidenceItem[], policy: EvidencePolicy): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(policy.maxFiles) || policy.maxFiles < 0) errors.push("Evidence file-count policy is invalid.");
  if (!Number.isSafeInteger(policy.maxFileBytes) || policy.maxFileBytes <= 0) errors.push("Evidence file-size policy is invalid.");
  if (items.length > policy.maxFiles) errors.push(`Maximum ${policy.maxFiles} evidence files allowed.`);

  const allowedMimeTypes = new Set(policy.allowedMimeTypes.map((mimeType) => mimeType.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  for (const item of items) {
    if (!allowedMimeTypes.has(item.mimeType.trim().toLowerCase())) errors.push(`${item.fileName}: file type is not allowed.`);
    if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || item.sizeBytes > policy.maxFileBytes) {
      errors.push(`${item.fileName}: file size is invalid or exceeds the limit.`);
    }
    if (seen.has(item.id)) errors.push(`Duplicate evidence id: ${item.id}.`);
    seen.add(item.id);
    if (hasUnsafeFileName(item.fileName)) errors.push("File name must be a plain name, not a path or control-character payload.");
  }
  return errors;
}
