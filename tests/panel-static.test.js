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
    'schemaVersion:4',
    'protocolVersion:"2026.10.2"',
    'spineEvent("sound_lab","session","requested"',
    'spineEvent("sound_lab","session","applied"',
    'spineEvent("sound_lab","response","observed"',
    'measurementSpine:{ safety:MS.safety',
    'checkins:MS.checkins.slice()',
    'soundSessions:MS.soundSessions.slice()',
    'soundExperiments:MS.soundExperiments.slice()',
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
  assert.match(app, /mergeRecords\(MS\.soundExperiments,se\)/);
  assert.match(app, /if\(\/\^\[=\+\\-@\]\//, "CSV export must neutralize spreadsheet formulas");
});

test("personal A/B plans are prospective, balanced and honest about inference", () => {
  assert.match(app, /window\.crypto\.getRandomValues/);
  assert.match(app, /function balancedSequence\(rng\)/);
  assert.match(app, /seq\.push\(flip\?"B":"A",flip\?"A":"B"\)/);
  assert.match(app, /primaryOutcome:\$\("ex_outcome"\)\.value/);
  assert.match(app, /Comparison stays hidden until all six periods finish/);
  assert.match(app, /completedAsPlanned:reason==="timer_complete"/);
  assert.match(app, /This small, unblinded self-comparison cannot establish efficacy or cause/);
  assert.match(app, /k:"quiet",label:"Quiet rest"/);
  assert.match(app, /id="sh_experiment"/);
  assert.match(app, /function latestSoundExperiment\(\)/);
  assert.match(app, /buildTherapy\(experimentPlan\.pitchHz/);
  assert.match(app, /resumeExperiment===true\?activeSoundExperiment\(\):resumeExperiment/);
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
  for (const id of ["q_accept", "a_accept", "d_start"]) {
    const binding = new RegExp(`\\$\\(\\"${id}\\"\\)\\.addEventListener\\(\\"click\\", function\\(\\)\\{ if\\(!requireSoundSafety\\(\\)\\) return;`);
    assert.match(app, binding, `${id} must be safety-gated`);
  }
  assert.match(app, /function devCheck\(\)\{\s+if\(!requireSoundSafety\(\)\) return;/);
  assert.match(app, /function play\(\)\{if\(!requireSoundSafety\(\)\)return;/);
});

test("self-report-only mode keeps the provocation-free research path accessible", () => {
  assert.ok(app.includes('id="r_safetyNotice"'));
  assert.match(app, /makeCal\("r_vol","r_volReadout","r_calBtn","▶︎ Play reference tone \(1 kHz\)",\{preserveView:true,onBlocked:renderResearchHome\}\)/);
  assert.match(app, /\$\("r_launch"\)\.addEventListener\("click", function\(\)\{ rCal\.stop\(\);/);
  assert.doesNotMatch(app, /\$\("r_launch"\)\.addEventListener\("click", function\(\)\{ if\(!requireSoundSafety\(\)\) return;/);
  assert.match(app, /function soundPainLocked\(\)\{ return !MS\.safety \|\| soundBlocked\(\)/);
  assert.match(app, /rtBtn\('rtb_sens','🛡 Sound-sensitivity &amp; recovery log','Provocation-free self-report;/);
  assert.match(app, /calBtn\.disabled=true; calBtn\.textContent=mode==="unchecked"\?"Reference tone unavailable until safety check":"Reference tone unavailable in "/);
  assert.match(app, /launch\.textContent="Open provocation-free research suite"/);
  assert.match(app, /id="r_reviewSafety"[^>]*>Review safety answers<\/button>/);
  assert.match(app, /\$\("r_reviewSafety"\)\.onclick=function\(\)\{ buildSafetyForm\(researchHome\); \};/);
  assert.match(app, /if\(typeof returnFn==="function"\) returnFn\(\); else buildSessionHub\(false\);/);
});

test("public documentation describes the bounded, uncalibrated Sound Lab", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /Sound lab & comfort sessions/);
  assert.match(readme, /digital setting, never claimed as acoustic dB SPL/);
  assert.match(readme, /Prospective personal A\/B comparison/);
  assert.match(readme, /three computer-randomised balanced pairs/);
  assert.match(readme, /Measurement spine & longitudinal check-ins/);
});
