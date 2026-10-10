const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { Server } = require("socket.io");
const { normalizeGroupCode, SpectraConnector } = require("../extension/spectra-connector.js");

test("normalise et refuse les codes de groupe invalides", () => {
  assert.equal(normalizeGroupCode(" abc-123 "), "ABC-123");
  assert.equal(normalizeGroupCode("secret dans une url?"), null);
  assert.equal(normalizeGroupCode(""), null);
});

test("utilise le contrat Socket.IO officiel et une seule connexion", async (t) => {
  const server = http.createServer();
  const io = new Server(server, { path: "/socket.io" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => io.close(() => server.close(resolve))));
  const port = server.address().port;
  let connections = 0;
  let receivedLogon = null;
  io.on("connection", (socket) => {
    connections += 1;
    socket.once("logon", (payload) => {
      receivedLogon = payload;
      socket.emit("logon_success", JSON.stringify({ groupCode: "ABC123" }));
      socket.emit("match_data", JSON.stringify({ teams: [{}, {}] }));
    });
  });

  const payloads = [];
  const states = [];
  const connector = new SpectraConnector({
    endpoint: `http://127.0.0.1:${port}`,
    path: "/socket.io",
    initialGroupCode: "abc123",
    onPayload: (payload) => payloads.push(payload),
    onState: (state) => states.push(state),
  });
  t.after(() => connector.stop());
  connector.start();
  await waitFor(() => payloads.length === 1);
  assert.equal(connections, 1);
  assert.equal(receivedLogon, JSON.stringify({ groupCode: "ABC123" }));
  assert.equal(JSON.parse(payloads[0]).teams.length, 2);
  assert.ok(states.some((state) => state.phase === "subscribed"));
  assert.equal(states.at(-1).groupHint.endsWith("23"), true);
  connector.setGroupCode("ABC123");
  await waitFor(() => connections === 2 && payloads.length === 2);
  assert.equal(connections, 2, "la reconnexion remplace le socket au lieu de l'empiler");
});

async function waitFor(predicate, timeoutMs = 2_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
