import { runCancelWorkCommand } from "./cancel-work-command.js";
import { runCleanupCommand } from "./cleanup-command.js";
import { runExecuteCommand } from "./execute-command.js";
import { runHelpCommand } from "./help-command.js";
import { runImportCommand } from "./import-command.js";
import { runInitCommand } from "./init-command.js";
import { runPlanCommand } from "./plan-command.js";
import { runResumeCommand } from "./resume-command.js";
import { runReviewCommand } from "./review-command.js";
import { createStubCommand } from "./stub-command.js";
import { runValidateCommand } from "./validate-command.js";

export const COMMAND_HANDLERS = {
  init: runInitCommand,
  import: runImportCommand,
  plan: runPlanCommand,
  "cancel-work": runCancelWorkCommand,
  execute: runExecuteCommand,
  review: runReviewCommand,
  resume: runResumeCommand,
  cleanup: runCleanupCommand,
  validate: runValidateCommand,
  help: runHelpCommand
};

export const COMMAND_NAMES = Object.keys(COMMAND_HANDLERS).filter((name) => name !== "help");
