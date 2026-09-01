#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORTABILITY_MARKER = 'ICONAMASTER_PORTABILITY_UNIT_MARKER';

const verificationSteps = [
  ['run', 'check:portability'],
  ['run', 'test:setup'],
  ['test'],
  ['run', 'test:content'],
  ['run', 'test:assets'],
  ['run', 'build'],
  ['run', 'test:sites'],
  ['run', 'build:mtw'],
  ['run', 'test:mtw'],
];

function runNpm(args) {
  const npmCli = process.env.npm_execpath ?? path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, ...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => {
      stdout.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr.push(chunk);
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({
      code: code ?? 1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    }));
  });
}

export async function runVerification({ run = runNpm } = {}) {
  for (const args of verificationSteps) {
    const result = await run(args);
    if (result.code !== 0) {
      throw new Error(`Verification step failed: npm ${args.join(' ')} exited ${result.code}.`);
    }
    if (args.length === 1 && args[0] === 'test') {
      const markerLines = result.stdout
        .split(/\r?\n/u)
        .filter((line) => line === `# ${PORTABILITY_MARKER}`);
      if (markerLines.length !== 1) {
        throw new Error(`Unit verification expected exactly one portability marker, observed ${markerLines.length}.`);
      }
    }
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runVerification().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
