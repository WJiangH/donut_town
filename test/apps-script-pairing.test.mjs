import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../Google_Script/Code.gs", import.meta.url), "utf8");
const context = vm.createContext({
  console,
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => "" })
  }
});
vm.runInContext(source, context);

test("manager exclusions use Slack IDs from Members rather than email rosters", () => {
  const members = {
    ULEADER: { managerSlackId: "" },
    UMEMBER: { managerSlackId: "ULEADER" },
    UOTHER: { managerSlackId: "" }
  };
  assert.equal(context.isLeaderMemberConflict("ULEADER", "UMEMBER", members), true);
  assert.equal(context.isLeaderMemberConflict("UMEMBER", "ULEADER", members), true);
  assert.equal(context.isLeaderMemberConflict("UMEMBER", "UOTHER", members), false);
  assert.equal(context.isLeaderMemberConflict("UNEW", "UOTHER", members), false);
});
