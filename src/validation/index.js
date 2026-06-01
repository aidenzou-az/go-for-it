import {
  validateImport,
  validateIndex,
  validateInstance,
  validateState,
  validateTemplates,
  validateWork
} from "./instance-validator.js";

export async function runValidation({ repoRoot, scope, target }) {
  if (scope === "instance") return validateInstance(repoRoot);
  if (scope === "state") return validateState(repoRoot);
  if (scope === "index") return validateIndex(repoRoot);
  if (scope === "templates") return validateTemplates(repoRoot);
  if (scope === "import") return validateImport(repoRoot);
  if (scope === "work") return validateWork(repoRoot, target);

  throw new Error(`Unsupported validation scope: ${scope}`);
}
