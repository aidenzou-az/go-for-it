#!/usr/bin/env node

import { runCli } from "../src/cli/run-cli.js";

const result = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr
});

process.exitCode = result.ok ? 0 : 1;
