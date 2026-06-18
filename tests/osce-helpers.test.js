const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./setup.js');
require('../osce-engine.js');

const H = global.window.__OSCE_TEST_HOOKS;

test('buildAvatarParams is deterministic for the same seed', () => {
  const a = H.buildAvatarParams('male', 55, 'robert-h');
  const b = H.buildAvatarParams('male', 55, 'robert-h');
  assert.deepEqual(a, b);
});

test('different seeds produce different avatars', () => {
  const a = H.buildAvatarParams('male', 55, 'robert-h');
  const b = H.buildAvatarParams('male', 55, 'james-k');
  assert.notDeepEqual(a, b);
});

test('child age band selects child-appropriate palette', () => {
  const child = H.buildAvatarParams('female', 8, 'kid-1');
  assert.equal(child.ageBand, 'child');
  const adult = H.buildAvatarParams('female', 30, 'adult-1');
  assert.equal(adult.ageBand, 'adult');
  const elder = H.buildAvatarParams('male', 80, 'old-1');
  assert.equal(elder.ageBand, 'elder');
});

test('gender is honored (female palettes can include hijab option, male cannot)', () => {
  const male = H.buildAvatarParams('male', 50, 'm1');
  const female = H.buildAvatarParams('female', 50, 'f1');
  assert.equal(['male','female'].includes(male.gender), true);
  assert.equal(female.gender, 'female');
  // Male avatar must never select a hijab head covering.
  assert.notEqual(male.headCovering, 'hijab');
});

test('renderAvatar returns inline SVG string containing <svg', () => {
  const params = H.buildAvatarParams('male', 55, 'robert-h');
  const svg = H.renderAvatar(params);
  assert.equal(typeof svg, 'string');
  assert.match(svg, /<svg[\s>]/);
  assert.match(svg, /<\/svg>/);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  // No external resources — must be offline-safe. The only allowed "http" is
  // the mandatory xmlns namespace declaration; no href/src/xlink fetches.
  const withoutNamespace = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '');
  assert.equal(withoutNamespace.includes('http'), false);
  assert.equal(svg.includes('href='), false);
  assert.equal(svg.includes('src='), false);
  assert.equal(svg.includes('<image'), false);
});
