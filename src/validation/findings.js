export function createFinding({ level, ruleId, artifact, message, suggestedFix }) {
  return {
    level,
    rule_id: ruleId,
    artifact,
    message,
    suggested_fix: suggestedFix
  };
}

export function summarizeFindings(findings) {
  const summary = {
    errors: 0,
    warnings: 0,
    infos: 0
  };

  for (const finding of findings) {
    if (finding.level === "error") summary.errors += 1;
    if (finding.level === "warning") summary.warnings += 1;
    if (finding.level === "info") summary.infos += 1;
  }

  return summary;
}

export function createValidationResult(scope, findings) {
  const summary = summarizeFindings(findings);

  return {
    ok: summary.errors === 0,
    scope,
    summary,
    findings
  };
}
