import { createCommandResult } from "../output/result.js";
import { runValidation } from "../validation/index.js";

export async function runValidateCommand({ args, repoRoot }) {
  const [scopeArg = "instance", target] = args;
  const scope = normalizeScope(scopeArg);

  if (!scope) {
    return createCommandResult({
      ok: false,
      command: "validate",
      scope: "cli",
      message: `invalid validation scope: ${scopeArg}`,
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: "valid scopes: instance, state, index, templates, import, work",
      nextSteps: ["Rerun yxg validate with a supported scope."],
      data: {
        requested_scope: scopeArg
      }
    });
  }

  const validation = await runValidation({ repoRoot, scope, target });

  return createCommandResult({
    ok: validation.ok,
    command: "validate",
    scope,
    message: validation.ok
      ? `validation passed for ${scope}`
      : `validation failed for ${scope}`,
    validation: validation.summary,
    details: buildValidationDetails(validation),
    nextSteps: validation.ok
      ? [`Continue working from the validated ${scope} context.`]
      : ["Review validation findings and fix blocking errors before continuing."],
    data: {
      target: target ?? null,
      findings: validation.findings,
      validation_scope: scope
    },
    meta: {
      target: target ?? null
    }
  });
}

function normalizeScope(scopeArg) {
  if (scopeArg === "instance") return "instance";
  if (scopeArg === "state") return "state";
  if (scopeArg === "index") return "index";
  if (scopeArg === "templates") return "templates";
  if (scopeArg === "import") return "import";
  if (scopeArg === "work") return "work";

  return null;
}

function buildValidationDetails(validation) {
  if (validation.findings.length === 0) {
    return "no findings";
  }

  const preview = validation.findings
    .slice(0, 3)
    .map((finding) => `${finding.rule_id}: ${finding.message}`)
    .join(" | ");

  return preview;
}
