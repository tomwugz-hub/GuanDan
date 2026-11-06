import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../policy/index.js', import.meta.url), 'utf8');
test('r28 default GD_R28 is 4 (bit4 mid-game follow shipped)', () => {
  assert.match(src, /GD_R28 : undefined; return v == null \? 4 :/);
});
test('r28 bit4 M4 default 100', () => {
  assert.match(src, /R7\('M4', 100\)/);
  assert.match(src, /'r28MidFollow'/);
});
