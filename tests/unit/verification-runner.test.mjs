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

test('verification runner executes the unit suite once and observes one portability marker', async () => {
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

  assert.deepEqual(calls.filter((args) => args.length === 1 && args[0] === 'test'), [['test']]);
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
