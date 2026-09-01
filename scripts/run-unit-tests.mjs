#!/usr/bin/env node
import { spawn } from 'node:child_process';

const child = spawn(process.execPath, [
  '--test',
  ...process.argv.slice(2),
  'tests/unit',
], {
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: true,
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Unit tests terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
