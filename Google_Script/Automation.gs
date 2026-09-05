// Donut automation configuration and idempotent trigger management.
// This file contains no credentials. Keep SLACK_TOKEN in Script Properties.

var DONUT_CONFIG_SHEET = "Configs";
var DONUT_ROUNDS_SHEET = "Rounds";
var DONUT_AUTOMATION_HANDLER = "donutAutomationTick";

function donutConfigDefaults_() {
  return [
    ["CHANNEL_ID", "", "Slack channel ID; keep workspace-specific values in this private sheet"],
    ["AUTO_POST_ENABLED", "TRUE", "TRUE enables the weekly Bot message"],
    ["WEEKLY_POST_DAY", "MONDAY", "MONDAY through SUNDAY"],
    ["WEEKLY_POST_TIME", "09:00", "Local 24-hour time; checked every 15 minutes"],
    ["TIMEZONE", "America/Los_Angeles", "IANA timezone shown in the Slack message"],
    ["SIGNUP_HOURS", "24", "Hours before the random pairing closes"],
    ["TARGET_EMOJI", "doughnut", "Slack emoji name without colons"],
    ["GUESS_WHO_TARGET_TEXT", "Guess Who will be your donut partner", "Text used to identify weekly signup messages"],
    ["NEW_HIRE_TARGET_TEXT", "We have a new team member onboarded", "Text used to identify new-hire lotteries"],
    ["NEW_HIRE_WAIT_HOURS", "2", "Delay before processing new-hire lotteries"],
    ["WINNERS_COUNT", "3", "Number of new-hire lottery winners"],
    ["ASSIGNED_WINNER_SLACK_ID", "", "Optional Slack ID forced as the odd-person lottery winner"],
    ["MEMBER_SYNC_HOURS", "24", "How often the channel roster is refreshed"],
    ["WEEKLY_MESSAGE_TEMPLATE", "React with :{EMOJI}: within {SIGNUP_HOURS} hours to join the random pairing, or enter Donut Town to invite someone directly. Signup closes around {CLOSE_TIME} ({TIMEZONE}).", "Supports {EMOJI}, {SIGNUP_HOURS}, {CLOSE_TIME}, and {TIMEZONE}"],
  ];
}

function initializeDonutSheets() {
  ensureDonutConfigSheet_();
  ensureDonutRoundsSheet_();
  ensureDonutMembersSheet_();
  return "Sheets are ready. Fill Configs CHANNEL_ID, then run setupDonutAutomation().";
}

// Run once after filling Configs. It replaces only the three Donut-owned time
// triggers and installs one stable 15-minute tick.
function setupDonutAutomation() {
  initializeDonutSheets();
  getDonutConfig_();

  var managedHandlers = [DONUT_AUTOMATION_HANDLER, "runGuessWhoLottery", "runDonutLottery"];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (managedHandlers.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(DONUT_AUTOMATION_HANDLER)
    .timeBased()
    .everyMinutes(15)
    .create();

  return "Donut automation installed. Edit Configs; the tick reads it every run.";
}

function donutAutomationTick() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var config = getDonutConfig_();
    maybeSyncDonutMembers_(config, new Date());
    if (config.AUTO_POST_ENABLED) maybePostWeeklyDonutRound_(config, new Date());
    runDonutLottery();
    runGuessWhoLottery();
  } finally {
    lock.releaseLock();
  }
}

// Safe manual counterpart to the weekly trigger. It uses the same message and
// writes the same audit row, but intentionally creates a new round every call.
function postWeeklyDonutRoundManual() {
  var config = getDonutConfig_();
  return postWeeklyDonutRound_(config, new Date(), "manual");
}

function maybePostWeeklyDonutRound_(config, now) {
  var localDay = localWeekday_(now, config.TIMEZONE);
  if (localDay !== config.WEEKLY_POST_DAY) return;

  var currentMinutes = Number(Utilities.formatDate(now, config.TIMEZONE, "H")) * 60
    + Number(Utilities.formatDate(now, config.TIMEZONE, "m"));
  if (currentMinutes < config.WEEKLY_POST_MINUTES) return;

  var localDate = Utilities.formatDate(now, config.TIMEZONE, "yyyy-MM-dd");
  var roundId = "auto:" + config.CHANNEL_ID + ":" + localDate;
  if (roundExists_(roundId)) return;
  postWeeklyDonutRound_(config, now, "auto", roundId);
}

function localWeekday_(date, timezone) {
  var parts = Utilities.formatDate(date, timezone, "yyyy-MM-dd").split("-");
  var dayIndex = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))).getUTCDay();
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][dayIndex];
}

function postWeeklyDonutRound_(config, now, source, roundId) {
  var closesAt = new Date(now.getTime() + config.SIGNUP_HOURS * 60 * 60 * 1000);
  var closeTime = Utilities.formatDate(closesAt, config.TIMEZONE, "EEE MMM d, h:mm a");
  var message = config.WEEKLY_MESSAGE_TEMPLATE
    .replace(/\{EMOJI\}/g, config.TARGET_EMOJI)
    .replace(/\{SIGNUP_HOURS\}/g, String(config.SIGNUP_HOURS))
    .replace(/\{CLOSE_TIME\}/g, closeTime)
    .replace(/\{TIMEZONE\}/g, config.TIMEZONE);

  var payload = {
    channel: config.CHANNEL_ID,
    text: config.GUESS_WHO_TARGET_TEXT + ". " + message,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: "*Time to Bring Your Donut!* :doughnut:\n" + message }
      },
      {
        type: "actions",
        block_id: "donut_town_entrance",
        elements: [
          {
            type: "button",
            action_id: "enter_donut_town",
            text: { type: "plain_text", text: "Enter Donut Town" },
            style: "primary",
            value: "weekly_round"
          }
        ]
      }
    ]
  };

  var response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + SLACK_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error("Slack chat.postMessage failed: " + result.error);

  var id = roundId || source + ":" + config.CHANNEL_ID + ":" + result.ts;
  logDonutRound_(id, source, config, result.ts, now, closesAt);
  return result.ts;
}

function getDonutConfig_() {
  var sheet = ensureDonutConfigSheet_();
  var defaults = donutConfigDefaults_();
  var raw = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (row) {
      if (row[0] !== "") raw[String(row[0]).trim()] = row[1];
    });
  }
  defaults.forEach(function (row) {
    if (!(row[0] in raw)) raw[row[0]] = row[1];
  });

  var timeMatch = String(raw.WEEKLY_POST_TIME).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!timeMatch) throw new Error("Configs WEEKLY_POST_TIME must use HH:MM, for example 09:00");
  var config = {
    CHANNEL_ID: String(raw.CHANNEL_ID || "").trim(),
    AUTO_POST_ENABLED: String(raw.AUTO_POST_ENABLED).toUpperCase() === "TRUE",
    WEEKLY_POST_DAY: String(raw.WEEKLY_POST_DAY || "").trim().toUpperCase(),
    WEEKLY_POST_TIME: String(raw.WEEKLY_POST_TIME),
    WEEKLY_POST_MINUTES: Number(timeMatch[1]) * 60 + Number(timeMatch[2]),
    TIMEZONE: String(raw.TIMEZONE || "").trim(),
    SIGNUP_HOURS: Number(raw.SIGNUP_HOURS),
    GUESS_WHO_WAIT_HOURS: Number(raw.SIGNUP_HOURS),
    TARGET_EMOJI: String(raw.TARGET_EMOJI || "").replace(/:/g, "").trim(),
    GUESS_WHO_TARGET_TEXT: String(raw.GUESS_WHO_TARGET_TEXT || "").trim(),
    NEW_HIRE_TARGET_TEXT: String(raw.NEW_HIRE_TARGET_TEXT || "").trim(),
    NEW_HIRE_WAIT_HOURS: Number(raw.NEW_HIRE_WAIT_HOURS),
    WINNERS_COUNT: Number(raw.WINNERS_COUNT),
    ASSIGNED_WINNER_SLACK_ID: String(raw.ASSIGNED_WINNER_SLACK_ID || "").trim(),
    MEMBER_SYNC_HOURS: Number(raw.MEMBER_SYNC_HOURS),
    WEEKLY_MESSAGE_TEMPLATE: String(raw.WEEKLY_MESSAGE_TEMPLATE || "").trim()
  };
  validateDonutConfig_(config);
  return config;
}

function validateDonutConfig_(config) {
  if (!/^C[A-Z0-9]+$/.test(config.CHANNEL_ID)) throw new Error("Configs CHANNEL_ID is missing or invalid");
  if (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].indexOf(config.WEEKLY_POST_DAY) === -1) {
    throw new Error("Configs WEEKLY_POST_DAY is invalid");
  }
  if (!config.TIMEZONE) throw new Error("Configs TIMEZONE is required");
  if (!(config.SIGNUP_HOURS > 0)) throw new Error("Configs SIGNUP_HOURS must be greater than zero");
  if (!(config.NEW_HIRE_WAIT_HOURS >= 0)) throw new Error("Configs NEW_HIRE_WAIT_HOURS must be zero or greater");
  if (!(config.WINNERS_COUNT > 0 && Math.floor(config.WINNERS_COUNT) === config.WINNERS_COUNT)) throw new Error("Configs WINNERS_COUNT must be a positive integer");
  if (config.ASSIGNED_WINNER_SLACK_ID && !/^[UW][A-Z0-9]+$/.test(config.ASSIGNED_WINNER_SLACK_ID)) throw new Error("Configs ASSIGNED_WINNER_SLACK_ID is invalid");
  if (!(config.MEMBER_SYNC_HOURS > 0)) throw new Error("Configs MEMBER_SYNC_HOURS must be greater than zero");
  if (!config.TARGET_EMOJI || !config.GUESS_WHO_TARGET_TEXT || !config.WEEKLY_MESSAGE_TEMPLATE) throw new Error("Configs message fields cannot be blank");
}

function ensureDonutConfigSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(DONUT_CONFIG_SHEET);
  var defaults = donutConfigDefaults_();
  if (!sheet) {
    sheet = spreadsheet.insertSheet(DONUT_CONFIG_SHEET);
    var values = [["Key", "Value", "Description"]].concat(defaults);
    sheet.getRange(1, 1, values.length, values[0].length).setNumberFormat("@");
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    sheet.autoResizeColumns(1, 3);
    return sheet;
  }

  var existingKeys = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) {
      if (row[0]) existingKeys[String(row[0]).trim()] = true;
    });
  }
  defaults.forEach(function (row) {
    if (!existingKeys[row[0]]) sheet.appendRow(row);
  });
  return sheet;
}

function ensureDonutRoundsSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(DONUT_ROUNDS_SHEET);
  if (sheet) return sheet;
  sheet = spreadsheet.insertSheet(DONUT_ROUNDS_SHEET);
  sheet.appendRow(["Round ID", "Source", "Channel ID", "Message TS", "Opened At", "Closes At", "Status"]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
  return sheet;
}

function ensureDonutMembersSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName("Members");
  if (sheet) return sheet;
  sheet = spreadsheet.insertSheet("Members");
  sheet.appendRow(["Slack ID", "Display Name", "Email", "Team", "Manager Slack ID", "In Channel", "Invites Enabled", "Last Synced At"]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  return sheet;
}

function maybeSyncDonutMembers_(config, now) {
  var properties = PropertiesService.getScriptProperties();
  var lastSync = Number(properties.getProperty("DONUT_LAST_MEMBER_SYNC_MS") || 0);
  if (now.getTime() - lastSync < config.MEMBER_SYNC_HOURS * 60 * 60 * 1000) return;
  syncDonutMembers();
  properties.setProperty("DONUT_LAST_MEMBER_SYNC_MS", String(now.getTime()));
}

// Slack is the source of channel membership and profile names. Team,
// Manager Slack ID, and Invites Enabled remain manually maintained in Members.
// Email is refreshed only when the app has permission and Slack returns it.
function syncDonutMembers() {
  var config = getDonutConfig_();
  var sheet = ensureDonutMembersSheet_();
  var existing = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().forEach(function (row) {
      if (row[0]) existing[String(row[0]).trim()] = row;
    });
  }

  var channelMemberIds = fetchSlackChannelMemberIds_(config.CHANNEL_ID);
  var channelMemberSet = {};
  channelMemberIds.forEach(function (id) { channelMemberSet[id] = true; });
  var slackUsers = fetchSlackUsers_();
  var now = new Date();
  var rows = [];
  var seen = {};

  slackUsers.forEach(function (user) {
    if (!channelMemberSet[user.id] || user.deleted || user.is_bot || user.id === "USLACKBOT") return;
    var previous = existing[user.id] || [];
    var profile = user.profile || {};
    rows.push([
      user.id,
      profile.display_name || profile.real_name || user.real_name || user.name || user.id,
      profile.email || previous[2] || "",
      previous[3] || "",
      previous[4] || "",
      true,
      previous.length ? previous[6] !== false : true,
      now
    ]);
    seen[user.id] = true;
  });

  Object.keys(existing).forEach(function (id) {
    if (seen[id]) return;
    var previous = existing[id];
    rows.push([id, previous[1], previous[2], previous[3], previous[4], false, previous[6], now]);
  });
  rows.sort(function (a, b) {
    if (a[5] !== b[5]) return a[5] ? -1 : 1;
    return String(a[1]).localeCompare(String(b[1]));
  });

  if (sheet.getLastRow() >= 2) sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, 8).setValues(rows);
  PropertiesService.getScriptProperties().setProperty("DONUT_LAST_MEMBER_SYNC_MS", String(now.getTime()));
  return rows.length;
}

function getDonutMemberDirectory_() {
  var sheet = ensureDonutMembersSheet_();
  var directory = {};
  if (sheet.getLastRow() < 2) return directory;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().forEach(function (row) {
    var slackId = String(row[0] || "").trim();
    if (!slackId) return;
    directory[slackId] = {
      displayName: row[1],
      email: row[2],
      team: row[3],
      managerSlackId: String(row[4] || "").trim(),
      inChannel: row[5] !== false,
      invitesEnabled: row[6] !== false
    };
  });
  return directory;
}

function fetchSlackChannelMemberIds_(channelId) {
  var ids = [];
  var cursor = "";
  do {
    var data = slackApiGet_("conversations.members", { channel: channelId, limit: 200, cursor: cursor });
    ids = ids.concat(data.members || []);
    cursor = data.response_metadata && data.response_metadata.next_cursor || "";
  } while (cursor);
  return ids;
}

function fetchSlackUsers_() {
  var users = [];
  var cursor = "";
  do {
    var data = slackApiGet_("users.list", { limit: 200, cursor: cursor });
    users = users.concat(data.members || []);
    cursor = data.response_metadata && data.response_metadata.next_cursor || "";
  } while (cursor);
  return users;
}

function slackApiGet_(method, parameters) {
  if (!SLACK_TOKEN) throw new Error("SLACK_TOKEN is missing from Script Properties");
  var query = Object.keys(parameters).filter(function (key) {
    return parameters[key] !== "" && parameters[key] !== null && parameters[key] !== undefined;
  }).map(function (key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(parameters[key]);
  }).join("&");
  var response = UrlFetchApp.fetch("https://slack.com/api/" + method + "?" + query, {
    method: "get",
    headers: { Authorization: "Bearer " + SLACK_TOKEN },
    muteHttpExceptions: true
  });
  var data = JSON.parse(response.getContentText());
  if (!data.ok) throw new Error("Slack " + method + " failed: " + data.error);
  return data;
}

function roundExists_(roundId) {
  var sheet = ensureDonutRoundsSheet_();
  if (sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().some(function (row) {
    return row[0] === roundId;
  });
}

function logDonutRound_(roundId, source, config, messageTs, openedAt, closesAt) {
  ensureDonutRoundsSheet_().appendRow([
    roundId,
    source,
    config.CHANNEL_ID,
    messageTs,
    openedAt,
    closesAt,
    "open"
  ]);
}
