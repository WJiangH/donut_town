import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../Google_Script/Automation.gs", import.meta.url), "utf8");

function loadAutomation(extra = {}) {
  const context = vm.createContext({ Date, console, ...extra });
  vm.runInContext(source, context);
  return context;
}

test("weekly posting waits for the configured local day and time", () => {
  const posted = [];
  const context = loadAutomation({
    Utilities: {
      formatDate(date, timezone, pattern) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }).formatToParts(date).map(part => [part.type, part.value]));
        if (pattern === "yyyy-MM-dd") return `${parts.year}-${parts.month}-${parts.day}`;
        if (pattern === "H") return String(Number(parts.hour));
        if (pattern === "m") return String(Number(parts.minute));
        throw new Error(`Unexpected format ${pattern}`);
      }
    }
  });
  context.roundExists_ = () => false;
  context.postWeeklyDonutRound_ = (...args) => posted.push(args);
  const config = {
    TIMEZONE: "America/Los_Angeles",
    WEEKLY_POST_DAY: "MONDAY",
    WEEKLY_POST_MINUTES: 9 * 60,
    CHANNEL_ID: "C123ABC"
  };

  context.maybePostWeeklyDonutRound_(config, new Date("2026-09-07T15:59:00Z"));
  assert.equal(posted.length, 0);
  context.maybePostWeeklyDonutRound_(config, new Date("2026-09-07T16:00:00Z"));
  assert.equal(posted.length, 1);
  context.maybePostWeeklyDonutRound_(config, new Date("2026-09-08T16:00:00Z"));
  assert.equal(posted.length, 1);
});

test("trigger setup is idempotent and preserves unrelated triggers", () => {
  let triggers = ["runGuessWhoLottery", "runDonutLottery", "unrelatedJob"].map(handler => ({
    getHandlerFunction: () => handler
  }));
  const context = loadAutomation({
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: trigger => { triggers = triggers.filter(item => item !== trigger); },
      newTrigger(handler) {
        return {
          timeBased() { return this; },
          everyMinutes(minutes) { assert.equal(minutes, 15); return this; },
          create() { triggers.push({ getHandlerFunction: () => handler }); }
        };
      }
    }
  });
  context.ensureDonutConfigSheet_ = () => {};
  context.ensureDonutRoundsSheet_ = () => {};
  context.ensureDonutMembersSheet_ = () => {};
  context.getDonutConfig_ = () => ({});

  context.setupDonutAutomation();
  context.setupDonutAutomation();
  assert.deepEqual(triggers.map(trigger => trigger.getHandlerFunction()).sort(), ["donutAutomationTick", "unrelatedJob"]);
});

test("weekly entrance button opens the configured one-click Slack URL", () => {
  let postedPayload;
  const context = loadAutomation({
    SLACK_TOKEN: "xoxb-test",
    Utilities: { formatDate: () => "Mon Sep 7, 9:00 AM" },
    UrlFetchApp: {
      fetch(url, options) {
        postedPayload = JSON.parse(options.payload);
        return { getContentText: () => JSON.stringify({ ok: true, ts: "123.456" }) };
      }
    }
  });
  context.logDonutRound_ = () => {};
  const config = {
    CHANNEL_ID: "C123ABC",
    TOWN_URL: "https://donut-town.onrender.com/auth/slack/start",
    SIGNUP_HOURS: 24,
    TIMEZONE: "America/Los_Angeles",
    TARGET_EMOJI: "doughnut",
    WEEKLY_MESSAGE_TEMPLATE: "React with :{EMOJI}: within {SIGNUP_HOURS} hours. {CLOSE_TIME} {TIMEZONE}",
    GUESS_WHO_TARGET_TEXT: "Guess Who"
  };
  context.postWeeklyDonutRound_(config, new Date("2026-09-07T16:00:00Z"), "manual");
  const button = postedPayload.blocks[1].elements[0];
  assert.equal(button.url, config.TOWN_URL);
  assert.equal(button.action_id, "enter_donut_town");
  assert.equal(button.value, "one_click_oauth");
});
