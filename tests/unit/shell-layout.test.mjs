import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesheet = await readFile(new URL('../../src/styles.css', import.meta.url), 'utf8');
const header = await readFile(new URL('../../src/components/SiteHeader.jsx', import.meta.url), 'utf8');
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

test('header uses a normal-flow compact menu throughout the tablet overflow range', () => {
  const edgeStart = stylesheet.indexOf('@media (min-width: 761px) and (max-width: 1008px)');
  const edgeEnd = stylesheet.indexOf('@media (max-width: 760px)', edgeStart);

  assert.notEqual(edgeStart, -1, 'the edge-width header breakpoint must begin at 761px');
  assert.notEqual(edgeEnd, -1, 'the edge-width header breakpoint must end before the existing mobile rules');

  const edgeStyles = stylesheet.slice(edgeStart, edgeEnd);
  assert.match(edgeStyles, /\.site-header__inner\s*\{[^}]*flex-wrap:\s*wrap;/s);
  assert.match(edgeStyles, /\.site-header__menu-button\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(edgeStyles, /\.site-header__nav\s*\{[^}]*display:\s*none;[^}]*position:\s*static;/s);
  assert.match(edgeStyles, /\.site-header__nav\.is-open\s*\{[^}]*display:\s*grid;/s);
  assert.match(edgeStyles, /\.site-header__nav a\s*\{[^}]*min-height:\s*2\.75rem;/s);
  assert.match(header, /matchMedia\('\(min-width: 1009px\)'\)/);
});
