import { COMMAND_HANDLERS, COMMAND_NAMES } from "../commands/index.js";
import { resolveRepoRoot } from "../fs/paths.js";
import { createCommandResult, formatCommandResult } from "../output/result.js";

export async function runCli(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  const parsed = parseArgv(argv);

  const result = await dispatchCommand(parsed, { cwd, repoRoot: resolveRepoRoot(cwd) });
  const output = formatCommandResult(result, { json: parsed.json });

  if (result.ok) {
    stdout.write(output);
  } else {
    stderr.write(output);
  }

  return result;
}

async function dispatchCommand(parsed, runtimeContext) {
  if (parsed.help || !parsed.commandName) {
    return COMMAND_HANDLERS.help({ commandNames: COMMAND_NAMES });
  }

  const handler = COMMAND_HANDLERS[parsed.commandName];

  if (!handler) {
    return createCommandResult({
      ok: false,
      command: parsed.commandName,
      scope: "cli",
      message: `unknown command: ${parsed.commandName}`,
      validation: { errors: 1, warnings: 0, infos: 0 },
      details: `known commands: ${COMMAND_NAMES.join(", ")}`,
      nextSteps: ["Run yxg --help to inspect the supported command surface."],
      data: {
        known_commands: COMMAND_NAMES
      }
    });
  }

  return handler({
    args: parsed.rest,
    flags: parsed.flags,
    json: parsed.json,
    ...runtimeContext
  });
}

function parseArgv(argv) {
  const flags = {};
  const positional = [];
  let json = false;
  let help = false;

  for (const token of argv) {
    if (token === "--json") {
      json = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }

    if (token.startsWith("--")) {
      const [, rawKey, rawValue] = token.match(/^--([^=]+)(?:=(.*))?$/) ?? [];
      flags[rawKey] = rawValue ?? true;
      continue;
    }

    positional.push(token);
  }

  const [commandName, ...rest] = positional;

  return {
    commandName,
    rest,
    flags,
    json,
    help
  };
}
