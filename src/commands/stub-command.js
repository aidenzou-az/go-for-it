import { createCommandResult } from "../output/result.js";

export function createStubCommand(commandName) {
  return async function runStubCommand() {
    return createCommandResult({
      ok: false,
      command: commandName,
      scope: commandName,
      message: `${commandName} is not implemented yet`,
      validation: { errors: 0, warnings: 0, infos: 1 },
      data: {
        details: "WU-001 and WU-002 provide the CLI shell and shared core only."
      }
    });
  };
}
