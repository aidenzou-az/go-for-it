import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../src/cli/run-cli.js";

function createBufferIo() {
  const chunks = [];

  return {
    stdout: {
      write(value) {
        chunks.push(value);
      }
    },
    stderr: {
      write(value) {
        chunks.push(value);
      }
    },
    joined() {
      return chunks.join("");
    }
  };
}

test("runCli shows help when no command is provided", async () => {
  const io = createBufferIo();
  const result = await runCli([], { ...io, cwd: process.cwd() });

  assert.equal(result.ok, true);
  assert.equal(result.command, "help");
  assert.match(io.joined(), /available commands:/);
  assert.match(io.joined(), /cancel-work/);
});

test("runCli returns an error for unknown commands", async () => {
  const io = createBufferIo();
  const result = await runCli(["unknown"], { ...io, cwd: process.cwd() });

  assert.equal(result.ok, false);
  assert.equal(result.command, "unknown");
  assert.match(io.joined(), /unknown command: unknown/);
});

test("runCli can validate an instance in json mode", async () => {
  const io = createBufferIo();
  const result = await runCli(["validate", "instance", "--json"], { ...io, cwd: process.cwd() });
  const parsed = JSON.parse(io.joined());

  assert.equal(typeof result.ok, "boolean");
  assert.equal(result.command, "validate");
  assert.equal(parsed.command, "validate");
  assert.equal(typeof parsed.timestamp, "string");
  assert.equal(typeof parsed.artifacts_changed_count, "number");
  assert.equal(typeof parsed.validation.ok, "boolean");
  assert.equal(typeof parsed.validation.findings_count, "number");
});

test("runCli rejects invalid validation scopes explicitly", async () => {
  const io = createBufferIo();
  const result = await runCli(["validate", "potato"], { ...io, cwd: process.cwd() });

  assert.equal(result.ok, false);
  assert.equal(result.command, "validate");
  assert.match(io.joined(), /invalid validation scope: potato/);
});
