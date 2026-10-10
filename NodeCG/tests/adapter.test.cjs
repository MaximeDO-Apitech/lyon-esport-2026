const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { adaptSpectraSnapshot } = require("../extension/adapter.js");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "raw-snapshot.json"), "utf8"));

test("normalise le snapshot Spectra sans republier les secrets", () => {
  const result = adaptSpectraSnapshot(fixture, { allowedAssetHosts: new Set(["assets.example.test"]) });
  assert.ok(result.value);
  assert.equal(result.value.teams[0].identityKey, "spectra-left-team");
  assert.equal(result.value.teams[0].side, "defense");
  assert.equal(result.value.teams[1].side, "attack");
  assert.equal(result.value.teams[0].logoUrl, "https://assets.example.test/left.png");
  assert.equal(result.value.teams[1].logoUrl, null);
  assert.equal(result.value.observedPlayerId, "101");
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes("NEVER_REPLICATE_THIS"), false);
  assert.equal(serialized.includes("groupCode"), false);
  assert.equal(serialized.includes("privateToken"), false);
});

test("une sante ou des statistiques indisponibles restent nulles", () => {
  const result = adaptSpectraSnapshot(fixture, { allowedAssetHosts: new Set() });
  const player = result.value.teams[0].players[1];
  assert.equal(player.health, null);
  assert.equal(player.kills, null);
  assert.equal(player.credits, null);
  assert.equal(player.availability.health, "unknown");
  assert.equal(player.availability.stats, "unknown");
});

test("refuse une structure sans deux equipes", () => {
  const result = adaptSpectraSnapshot({ teams: [{}] }, { allowedAssetHosts: new Set() });
  assert.equal(result.value, null);
  assert.deepEqual(result.missingFields, ["teams[0..1]"]);
});

test("un changement de cote ne permute ni l'identite ni le score des equipes", () => {
  const switched = structuredClone(fixture);
  switched.teams[0].isAttacking = true;
  switched.teams[1].isAttacking = false;
  const result = adaptSpectraSnapshot(switched, { allowedAssetHosts: new Set() });
  assert.equal(result.value.teams[0].identityKey, "spectra-left-team");
  assert.equal(result.value.teams[0].name, "Equipe Gauche");
  assert.equal(result.value.teams[0].score, 9);
  assert.equal(result.value.teams[0].side, "attack");
  assert.equal(result.value.teams[1].identityKey, "spectra-right-team");
  assert.equal(result.value.teams[1].score, 7);
  assert.equal(result.value.teams[1].side, "defense");
});

test("plusieurs joueurs observes produisent un etat inconnu plutot qu'un choix arbitraire", () => {
  const ambiguous = structuredClone(fixture);
  ambiguous.teams[0].players[1].isObserved = true;
  const result = adaptSpectraSnapshot(ambiguous, { allowedAssetHosts: new Set() });
  assert.equal(result.value.observedPlayerId, null);
  assert.ok(result.warnings.some((warning) => warning.includes("plusieurs joueurs observes")));
});
