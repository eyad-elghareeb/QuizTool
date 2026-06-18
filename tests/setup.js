// Minimal browser shim so osce-engine.js can be required in Node tests.
// Only the pure helpers are tested headlessly; DOM/UI is tested in the browser.
const _store = {};
global.localStorage = {
  getItem: (k) => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; }
};
global.window = global;
global.document = {
  currentScript: null,
  querySelectorAll: () => [],
  createElement: () => ({ setAttribute(){}, appendChild(){}, classList: {add(){}}, style:{} }),
  head: { appendChild(){} }
};
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
