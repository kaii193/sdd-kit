#!/usr/bin/env node
import { run } from '../lib/cli.js';

process.exitCode = await run(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  cwd: process.cwd(),
  env: process.env,
});
