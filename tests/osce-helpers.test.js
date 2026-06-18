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

test('buildPatientSysPrompt never includes the diagnosis string', () => {
  const sys = H.buildPatientSysPrompt({
    patient: { name: 'Mr. X', age: 55, gender: 'male' },
    hiddenProfile: { diagnosis: 'Stable angina pectoris', keySymptoms: ['substernal pressure'], redFlags: ['diaphoresis'], pastHistory: ['hypertension'], vitalSigns: 'BP 148/92' }
  });
  assert.equal(sys.toLowerCase().includes('stable angina'), false, 'system prompt must not leak the diagnosis');
  assert.match(sys, /first[\s-]person/i);
  assert.match(sys, /Mr\. X/);
});

test('buildPatientSysPrompt instructs the model not to volunteer the diagnosis', () => {
  const sys = H.buildPatientSysPrompt({ patient: { name: 'P', age: 40, gender: 'female' }, hiddenProfile: { diagnosis: 'D', keySymptoms: [], redFlags: [], pastHistory: [] } });
  assert.match(sys, /do not volunteer|never reveal|must not name/i);
});

test('buildExaminerUserPrompt includes the rubric mustAsk items and the transcript', () => {
  const prompt = H.buildExaminerUserPrompt(
    { title: 'Chest Pain', rubric: { mustAsk: ['SOCRATES', 'risk factors'], bonus: ['family hx'] } },
    [{ role: 'user', text: 'Tell me about the pain.' }, { role: 'model', text: 'It is pressing.' }]
  );
  assert.match(prompt, /SOCRATES/);
  assert.match(prompt, /Tell me about the pain/);
  assert.match(prompt, /It is pressing/);
});

test('scoreRubric parses strict JSON and clamps score 0-100', () => {
  const good = JSON.stringify({ score: 87, passed: true, asked: ['SOCRATES'], missed: ['family hx'], feedback: 'Strong interview.', domains: { communication: 22, infoGathering: 20, clinicalReasoning: 25, professionalism: 20 } });
  assert.deepEqual(H.scoreRubric(good), { score: 87, passed: true, domains: { communication: 22, infoGathering: 20, clinicalReasoning: 25, professionalism: 20 }, asked: ['SOCRATES'], missed: ['family hx'], feedback: 'Strong interview.' });
  assert.equal(H.scoreRubric('not json'), null);
  const over = H.scoreRubric(JSON.stringify({ score: 250, passed: true, asked: [], missed: [], feedback: 'x' }));
  assert.equal(over.score, 100);
});
