import { pathExists } from "../fs/exists.js";
import { getYxgRoot } from "../fs/paths.js";
import { createCommandResult } from "../output/result.js";
import { runValidation } from "../validation/index.js";
import { bootstrapFrameworkInstance } from "./bootstrap-instance.js";
import { appendLogEntry } from "./shared-artifacts.js";

const ROOT_ARTIFACTS = ["MANIFEST.md", "PROJECT.md", "STATE.md", "INDEX.md", "LOG.md"];

export async function runInitCommand({ repoRoot, flags }) {
  const yxgRoot = getYxgRoot(repoRoot);
  const exists = await pathExists(yxgRoot);
  const mode = flags.reinit ? "reinit" : flags.merge ? "merge" : "default";

  if (exists && mode === "default") {
    return createCommandResult({
      ok: false,
      command: "init",
      scope: "instance",
      message: ".yxg already exists; use --reinit or --merge",
      validation: { errors: 1, warnings: 0, infos: 0 }
    });
  }

  const bootstrap = await bootstrapFrameworkInstance(repoRoot, {
    mode,
    nextSafeAction: "Fill PROJECT.md and create the first work unit with yxg plan."
  });
  const date = new Date().toISOString().slice(0, 10);
  const logPath = await appendLogEntry(repoRoot, {
    date,
    eventId: "init",
    summary: "framework instance initialized",
    bullets: [
      "Initialized the yxg scaffold for a greenfield repository.",
      "Next safe action: define project intent in PROJECT.md before planning the first work unit."
    ]
  });
  const changed = Array.from(new Set([...bootstrap.changed, logPath]));

  const validation = await runValidation({ repoRoot, scope: "instance" });

  return createCommandResult({
    ok: validation.ok,
    command: "init",
    scope: "instance",
    artifactsChanged: changed,
    validation: validation.summary,
    message: validation.ok ? "initialized .yxg scaffold" : "initialized scaffold with validation errors",
    details:
      bootstrap.changed.length > 0
        ? `materialized or refreshed ${changed.length} scaffold artifact(s)`
        : "scaffold already present",
    nextSteps: [
      "Use yxg init for new or greenfield projects that are starting with yxg from day one.",
      "For an existing repository, prefer yxg import as the onboarding entry point."
    ],
    data: {
      findings: validation.findings,
      mode,
      root_artifacts: ROOT_ARTIFACTS.map((filename) => `.yxg/${filename}`),
      template_write_mode: bootstrap.templateWriteMode
    },
    meta: {
      mode,
      template_write_mode: bootstrap.templateWriteMode
    }
  });
}
