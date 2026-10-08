import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareOrders } from '../../scripts/prepare-orders.mjs';
import { canRequestIcon, orderRequestApi, validateOrderFields } from '../../src/lib/order-requests.js';

test('only published available icons offer order enquiries', () => {
  assert.equal(canRequestIcon({ published: true, availability: 'В наличии' }), true);
  for (const icon of [null, { availability: 'Продано' }, { availability: 'Наличие уточняется' }, { availability: 'В наличии', published: false }]) assert.equal(canRequestIcon(icon), false);
});

test('MTW package includes the endpoint and authenticated inbox without public request data', async context => {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-orders-package-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await prepareOrders(root);
  const endpointSource = await readFile(path.join(root, 'order-request.php'), 'utf8');
  assert.match(endpointSource, /dirname\(\$root\)\.'\/\.iconamaster-order-requests'/u);
  assert.match(endpointSource, /HTTP_ORIGIN/u);
  assert.match(endpointSource, /order_csrf/u);
  const admin = await readFile(path.join(root, 'corona/admin/orders/admin.php'), 'utf8');
  assert.match(admin, /\$_SESSION\['ADMINUS'\]!==\s*'ok'/u);
  assert.match(admin, /oq_escape\(\$record\['contact'\]\)/u);
  assert.match(await readFile(path.join(root, 'corona/admin/orders.php'), 'utf8'), /orders\/admin\.php/u);
  assert.match(await readFile(path.join(root, 'corona/admin/orders/store.php'), 'utf8'), /function oq_accept/u);
});

test('order form requires a usable callback contact and explicit consent', () => {
  const fields = { name: 'Иван', contact: '+7 (999) 123-45-67', message: '', consent: true };
  assert.equal(validateOrderFields(fields), '');
  assert.equal(validateOrderFields({ ...fields, contact: 'visitor@example.ru' }), '');
  assert.match(validateOrderFields({ ...fields, contact: 'напишите мне' }), /телефон или email/);
  assert.match(validateOrderFields({ ...fields, consent: false }), /согласие/);
  assert.match(validateOrderFields({ ...fields, name: ' ' }), /имя/);
});

test('order API submits only to the same-origin endpoint and retains the retry ID', async () => {
  const calls = [];
  const payload = { requestId: 'a'.repeat(32), csrf: 'token', slug: 'test-icon', name: 'Иван', contact: 'visitor@example.ru', message: '', consent: true, website: '' };
  const fetchLike = async (...args) => { calls.push(args); return { ok: true, json: async () => ({ ok: true, reference: 'IM-20261008-AAAAAAAA' }) }; };
  const result = await orderRequestApi(payload, { fetchLike });
  assert.equal(result.reference, 'IM-20261008-AAAAAAAA');
  assert.equal(calls[0][0], '/order-request.php');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.deepEqual(JSON.parse(calls[0][1].body), payload);
});

test('mail rejection and malformed responses never become a successful order', async () => {
  await assert.rejects(orderRequestApi({ requestId: 'a'.repeat(32) }, { fetchLike: async () => ({ ok: false, json: async () => ({ ok: false, saved: true, message: 'Письмо пока не отправилось.' }) }) }), /Письмо пока не отправилось/);
  await assert.rejects(orderRequestApi(null, { fetchLike: async () => ({ ok: true, json: async () => ({ unexpected: true }) }) }), /Не удалось/);
  await assert.rejects(orderRequestApi({}, { fetchLike: async () => ({ ok: true, json: async () => ({ ok: false }) }) }), /Не удалось/);
  for (const data of [{ ok: true }, { ok: true, reference: 'undefined' }, { ok: true, preview: 'true' }, { ok: 'true', reference: 'IM-20261008-AAAAAAAA' }]) {
    await assert.rejects(orderRequestApi({}, { fetchLike: async () => ({ ok: true, json: async () => data }) }), /Не удалось/);
  }
  const preview = await orderRequestApi({}, { fetchLike: async () => ({ ok: true, json: async () => ({ ok: true, preview: true }) }) });
  assert.equal(preview.preview, true);
});
