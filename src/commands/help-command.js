import { createCommandResult } from "../output/result.js";

export async function runHelpCommand({ commandNames }) {
  return createCommandResult({
    ok: true,
    command: "help",
    scope: "cli",
    message: `available commands: ${commandNames.join(", ")}`,
    validation: { errors: 0, warnings: 0, infos: 0 },
    nextSteps: [
      "Use yxg init for a new or greenfield project.",
      "Use yxg import to onboard an existing repository into yxg."
    ]
  });
}
