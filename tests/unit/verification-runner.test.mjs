import assert from 'node:assert/strict';
import test from 'node:test';

const runnerUrl = new URL('../../scripts/run-verification.mjs', import.meta.url);

async function loadRunner() {
  try {
    return await import(runnerUrl.href);
  } catch (error) {
    assert.fail(`verification runner is unavailable: ${error.message}`);
  }
}

test('verification runner executes the static SEO gate immediately after its build', async () => {
  const { PORTABILITY_MARKER, runVerification } = await loadRunner();
  const calls = [];
  await runVerification({
    run: async (args) => {
      calls.push(args);
      return {
        code: 0,
        stdout: args.length === 1 && args[0] === 'test'
          ? `# ${PORTABILITY_MARKER}\n`
          : '',
        stderr: '',
      };
    },
  });

  assert.deepEqual(calls, [
    ['run', 'check:portability'],
    ['run', 'test:setup'],
    ['test'],
    ['run', 'test:content'],
    ['run', 'test:assets'],
    ['run', 'build'],
    ['run', 'test:static'],
    ['run', 'test:sites'],
    ['run', 'build:mtw'],
    ['run', 'test:mtw'],
  ]);
});

test('verification runner rejects duplicate portability execution markers', async () => {
  const { PORTABILITY_MARKER, runVerification } = await loadRunner();
  await assert.rejects(
    runVerification({
      run: async (args) => ({
        code: 0,
        stdout: args.length === 1 && args[0] === 'test'
          ? `# ${PORTABILITY_MARKER}\n# ${PORTABILITY_MARKER}\n`
          : '',
        stderr: '',
      }),
    }),
    /expected exactly one portability marker, observed 2/u,
  );
});
