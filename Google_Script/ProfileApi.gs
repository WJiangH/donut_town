// Private bridge between the Render service and the Sheet-backed member
// profiles. Keep TOWN_PROFILE_API_SECRET in Script Properties and in Render.

function doPost(e) {
  try {
    var request = JSON.parse(e && e.postData && e.postData.contents || "{}");
    var expectedSecret = PropertiesService.getScriptProperties().getProperty("TOWN_PROFILE_API_SECRET");
    if (!expectedSecret || String(request.secret || "") !== expectedSecret) {
      return townProfileJson_({ ok: false, error: "profile_api_unauthorized" });
    }
    if (request.action === "list") {
      return townProfileJson_({ ok: true, profiles: listTownProfiles_() });
    }
    if (request.action === "update") {
      return townProfileJson_({ ok: true, profile: updateTownProfile_(request.slackId, request.profile) });
    }
    return townProfileJson_({ ok: false, error: "profile_api_unknown_action" });
  } catch (error) {
    return townProfileJson_({ ok: false, error: String(error && error.message || error) });
  }
}

function listTownProfiles_() {
  var sheet = ensureDonutMembersSheet_();
  var profiles = {};
  if (sheet.getLastRow() < 2) return profiles;
  var donutCounts = getTownDonutCounts_();
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues().forEach(function (row) {
    var slackId = String(row[0] || "").trim();
    if (!slackId || row[5] === false) return;
    profiles[slackId] = {
      team: String(row[3] || ""),
      specialty: String(row[8] || ""),
      location: String(row[9] || ""),
      pet: String(row[10] || ""),
      topics: String(row[11] || ""),
      donuts: donutCounts[slackId] || 0
    };
  });
  return profiles;
}

function updateTownProfile_(slackId, input) {
  slackId = String(slackId || "").trim();
  if (!/^[UW][A-Z0-9]+$/.test(slackId)) throw new Error("Invalid Slack member ID");
  var profile = normalizeTownProfile_(input || {});
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sheet = ensureDonutMembersSheet_();
    if (sheet.getLastRow() < 2) throw new Error("Member not found");
    var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var index = ids.findIndex(function (row) { return String(row[0] || "").trim() === slackId; });
    if (index === -1) throw new Error("Member not found");
    var rowNumber = index + 2;
    sheet.getRange(rowNumber, 4).setValue(profile.team);
    sheet.getRange(rowNumber, 9, 1, 4).setValues([[
      profile.specialty,
      profile.location,
      profile.pet,
      profile.topics
    ]]);
    profile.donuts = getTownDonutCounts_()[slackId] || 0;
    return profile;
  } finally {
    lock.releaseLock();
  }
}

function normalizeTownProfile_(input) {
  return {
    team: townProfileText_(input.team, 80),
    specialty: townProfileText_(input.specialty, 120),
    location: townProfileText_(input.location, 80),
    pet: townProfileText_(input.pet, 80),
    topics: townProfileText_(input.topics, 180)
  };
}

function townProfileText_(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function getTownDonutCounts_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GuessWho");
  var counts = {};
  if (!sheet || sheet.getLastRow() < 2) return counts;
  sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) {
    var ids = String(row[0] || "").match(/U[A-Z0-9]+/g) || [];
    ids.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
  });
  return counts;
}

function townProfileJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
