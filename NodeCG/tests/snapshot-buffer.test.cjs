const assert = require("node:assert/strict");
const test = require("node:test");
const { SnapshotBuffer } = require("../extension/snapshot-buffer.js");

test("publie le snapshot entier apres le delai", async () => {
  const published = [];
  const buffer = new SnapshotBuffer((value) => published.push(value), 4);
  buffer.setDelay(20);
  buffer.enqueue({ score: 7, observed: "p1" });
  assert.equal(published.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.deepEqual(published, [{ score: 7, observed: "p1" }]);
});

test("changer le delai purge les snapshots de l'ancienne session", async () => {
  const published = [];
  const buffer = new SnapshotBuffer((value) => published.push(value), 4);
  buffer.setDelay(30);
  buffer.enqueue({ session: "old" });
  buffer.setDelay(0);
  buffer.enqueue({ session: "new" });
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.deepEqual(published, [{ session: "new" }]);
});

test("conserve l'ordre d'arrivee dans un meme tampon", async () => {
  const published = [];
  const buffer = new SnapshotBuffer((value) => published.push(value), 4);
  buffer.setDelay(15);
  buffer.enqueue({ revision: 1 });
  buffer.enqueue({ revision: 2 });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.deepEqual(published, [{ revision: 1 }, { revision: 2 }]);
});
