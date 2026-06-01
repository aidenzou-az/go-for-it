import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCanonicalTemplatesRoot } from "../fs/paths.js";

export async function loadCanonicalTemplate(repoRoot, templateName) {
  const templatePath = path.join(getCanonicalTemplatesRoot(repoRoot), templateName);
  return readFile(templatePath, "utf8");
}

export function fillDatePlaceholders(content, date) {
  return content.replaceAll("YYYY-MM-DD", date);
}

export function applyFrontmatterValues(content, values) {
  let updated = content;

  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^(${escapeRegExp(key)}:\\s*)(.*)$`, "m");
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, `$1${value}`);
    }
  }

  return updated;
}

export function prepareTemplate(content, { date, frontmatter = {} } = {}) {
  let prepared = content;

  if (date) {
    prepared = fillDatePlaceholders(prepared, date);
  }

  if (Object.keys(frontmatter).length > 0) {
    prepared = applyFrontmatterValues(prepared, frontmatter);
  }

  return prepared;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
