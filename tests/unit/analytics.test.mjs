import assert from 'node:assert/strict';
import test from 'node:test';
import { trackGoal } from '../../src/lib/analytics.js';

test('trackGoal leaves navigation unblocked when Metrica is unavailable', () => {
  assert.equal(trackGoal('contact_phone', {}), false);
});

test('trackGoal sends the configured counter and WhatsApp goal to Metrica', () => {
  const calls = [];
  const windowLike = { ym: (...args) => calls.push(args) };

  assert.equal(trackGoal('contact_whatsapp', windowLike), true);
  assert.deepEqual(calls, [[112185835, 'reachGoal', 'contact_whatsapp']]);
});

test('trackGoal rejects unsupported goals before dispatching', () => {
  const windowLike = { ym() {} };

  assert.throws(() => trackGoal('unknown_goal', windowLike), /Unsupported Metrica goal/u);
});

test('trackGoal leaves navigation unblocked when Metrica dispatch throws', () => {
  const windowLike = { ym() { throw new Error('Metrica unavailable'); } };

  assert.equal(trackGoal('contact_email', windowLike), false);
});
