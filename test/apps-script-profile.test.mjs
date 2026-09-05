import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../Google_Script/ProfileApi.gs", import.meta.url), "utf8");

function loadProfileApi() {
  const context = vm.createContext({
    JSON,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => "correct-secret" })
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      }
    }
  });
  vm.runInContext(source, context);
  return context;
}

test("profile web app rejects the wrong shared secret", () => {
  const context = loadProfileApi();
  const response = context.doPost({ postData: { contents: JSON.stringify({ action: "list", secret: "wrong" }) } });
  assert.deepEqual(JSON.parse(response.text), { ok: false, error: "profile_api_unauthorized" });
});

test("profile web app returns only normalized profile content", () => {
  const context = loadProfileApi();
  const profile = context.normalizeTownProfile_({
    team: "  Device  ",
    specialty: "Simulation",
    location: "San Jose",
    pet: "Cat",
    topics: "Coffee, process integration"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(profile)), {
    team: "Device",
    specialty: "Simulation",
    location: "San Jose",
    pet: "Cat",
    topics: "Coffee, process integration"
  });
});
