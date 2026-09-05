import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProfile, SheetProfileStore } from "../profile-store.mjs";

test("profile fields are trimmed and bounded before leaving Render", () => {
  const profile = normalizeProfile({
    team: "  Materials  ",
    specialty: "x".repeat(140),
    topics: ["coffee", "hiking"]
  });
  assert.equal(profile.team, "Materials");
  assert.equal(profile.specialty.length, 120);
  assert.equal(profile.topics, "coffee, hiking");
});

test("sheet profile store keeps the shared secret on the server request", async () => {
  let requestBody;
  const store = new SheetProfileStore({
    url: "https://script.google.com/macros/s/test/exec",
    secret: "private-test-secret",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true, profiles: { U1: { team: "Materials" } } }) };
    }
  });
  const profiles = await store.list();
  assert.equal(requestBody.action, "list");
  assert.equal(requestBody.secret, "private-test-secret");
  assert.equal(profiles.U1.team, "Materials");
});
