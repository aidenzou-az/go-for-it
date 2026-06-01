export function createValidationSummary(validation = {}, findings = []) {
  const errors = validation.errors ?? 0;
  const warnings = validation.warnings ?? 0;
  const infos = validation.infos ?? 0;

  return {
    ok: errors === 0,
    errors,
    warnings,
    infos,
    findings_count: validation.findings_count ?? findings.length
  };
}

export function createCommandResult({
  ok,
  command,
  scope = "command",
  artifactsChanged = [],
  validation,
  message,
  details = null,
  nextSteps = [],
  data = null,
  meta = null,
  now = null
}) {
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  const normalizedDetails = details ?? data?.details ?? null;
  const normalizedArtifactsChanged = Array.from(new Set(artifactsChanged));
  const normalizedNextSteps = nextSteps.filter(Boolean);

  return {
    ok,
    status: ok ? "ok" : "error",
    command,
    scope,
    timestamp: now ?? new Date().toISOString(),
    artifacts_changed: normalizedArtifactsChanged,
    artifacts_changed_count: normalizedArtifactsChanged.length,
    validation: createValidationSummary(validation, findings),
    message,
    details: normalizedDetails,
    next_steps: normalizedNextSteps,
    data,
    meta
  };
}

export function formatCommandResult(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const status = result.ok ? "OK" : "ERROR";
  const lines = [`${status} ${result.command}: ${result.message}`];
  const { errors, warnings, infos, findings_count: findingsCount } = result.validation;

  if (errors || warnings || infos) {
    lines.push(
      `validation: ${errors} error(s), ${warnings} warning(s), ${infos} info item(s), ${findingsCount} finding(s)`
    );
  }

  if (result.details) {
    lines.push(`details: ${result.details}`);
  }

  if (result.meta?.mode) {
    lines.push(`mode: ${result.meta.mode}`);
  }

  if (result.artifacts_changed.length > 0) {
    lines.push(
      `artifacts changed (${result.artifacts_changed_count}): ${result.artifacts_changed.join(", ")}`
    );
  }

  if (result.next_steps.length > 0) {
    lines.push("next steps:");
    for (const step of result.next_steps) {
      lines.push(`- ${step}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
