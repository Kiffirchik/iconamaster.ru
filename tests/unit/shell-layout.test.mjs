import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesheet = await readFile(new URL('../../src/styles.css', import.meta.url), 'utf8');
const mobileStyles = stylesheet.slice(
  stylesheet.indexOf('@media (max-width: 760px)'),
  stylesheet.indexOf('@media (prefers-reduced-motion: reduce)')
);

test('mobile navigation expands in normal document flow', () => {
  assert.match(
    mobileStyles,
    /\.site-header__inner\s*\{[^}]*flex-wrap:\s*wrap;/s,
    'the mobile header must wrap so the open navigation reserves vertical space'
  );
  assert.match(
    mobileStyles,
    /\.site-header__nav\s*\{[^}]*position:\s*static;/s,
    'the mobile navigation must remain in normal document flow'
  );
});
