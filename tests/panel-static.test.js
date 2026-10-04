const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicApp = fs.readFileSync(path.join(root, "docs", "app.html"), "utf8");

test("the root and GitHub Pages app stay byte-identical", () => {
  assert.equal(publicApp, app);
});

test("every inline script parses", () => {
  const scripts = [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  scripts.forEach((match) => assert.doesNotThrow(() => new Function(match[1])));
});

test("static markup does not contain duplicate ids", () => {
  const markupOnly = app.replace(/<script[\s\S]*?<\/script>/g, "");
  const ids = [...markupOnly.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test("measurement spine schema and local history are present", () => {
  for (const marker of [
    'schemaVersion:3',
    'protocolVersion:"2026.10.1"',
    'spineEvent("sound_lab","session","requested"',
    'spineEvent("sound_lab","session","applied"',
    'spineEvent("sound_lab","response","observed"',
    'measurementSpine:{ safety:MS.safety',
    'checkins:MS.checkins.slice()',
    'soundSessions:MS.soundSessions.slice()',
  ]) {
    assert.ok(app.includes(marker), `missing ${marker}`);
  }
});

test("safety is reconfirmed per page session", () => {
  assert.match(app, /safety:null,lastSafety:saved\.lastSafety\|\|saved\.safety\|\|null/);
  assert.match(app, /if\(!MS\.safety\) buildSafetyForm\(\)/);
  assert.doesNotMatch(app, /safety:saved\.safety\|\|null/);
});

test("test completion never transmits automatically", () => {
  const calls = [...app.matchAll(/submitNetlify\(/g)];
  assert.equal(calls.length, 0);
  assert.match(app, /function sendConfigured\(d\)/);
  assert.match(app, /if\(!confirm\("Send this result/);
});

test("local history has explicit export, import and deletion controls", () => {
  for (const id of ["sh_export", "sh_csv", "sh_import", "sh_clear"]) {
    assert.ok(app.includes(`id="${id}"`), `missing ${id}`);
  }
  assert.match(app, /function importHistoryFile\(file\)/);
  assert.match(app, /function clearSavedHistory\(\)/);
  assert.match(app, /if\(\/\^\[=\+\\-@\]\//, "CSV export must neutralize spreadsheet formulas");
});

test("all Web Audio signals use the monitored master output", () => {
  assert.match(app, /masterGain\.connect\(deliveredAnalyser\)\.connect\(actx\.destination\)/);
  const direct = app.match(/\.connect\(c\.destination\)/g) || [];
  assert.equal(direct.length, 0);
  assert.match(app, /digitalOutput:digitalSummary\(\)/);
});

test("a persistent emergency stop is present", () => {
  assert.ok(app.includes('id="spineStop"'));
  assert.match(app, /spineStop"\)\.addEventListener\("click"/);
});

test("all top-level sound-producing entry points use the shared gate", () => {
  for (const id of ["q_accept", "a_accept", "d_start", "r_launch"]) {
    const binding = new RegExp(`\\$\\(\\"${id}\\"\\)\\.addEventListener\\(\\"click\\", function\\(\\)\\{ if\\(!requireSoundSafety\\(\\)\\) return;`);
    assert.match(app, binding, `${id} must be safety-gated`);
  }
  assert.match(app, /function devCheck\(\)\{\s+if\(!requireSoundSafety\(\)\) return;/);
  assert.match(app, /function play\(\)\{ if\(!requireSoundSafety\(\)\) return; before=/);
});

test("public documentation describes the bounded, uncalibrated Sound Lab", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /Sound lab & comfort sessions/);
  assert.match(readme, /digital setting, never claimed as acoustic dB SPL/);
  assert.match(readme, /Measurement spine & longitudinal check-ins/);
});
