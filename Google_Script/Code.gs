// ==================== CONFIGURATION ====================
const SLACK_TOKEN = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN")
// ==================== CONFIGURATION ====================

// ==================== GUESS WHO CONFIGURATION ====================
// ==================== END GUESS WHO CONFIGURATION ====================


// ╔════════════════════════════════════════════════════════════════╗
// ║          WORKFLOW 1: NEW HIRE DONUT LOTTERY                   ║
// ╚════════════════════════════════════════════════════════════════╝

function runDonutLottery() {
  var config = getDonutConfig_();
  console.log("1. Starting search...");
  var messages = fetchRecentMessages();

  // 1. Load History (Who won in the past?)
  var recentWinners = getRecentWinnerIds();
  console.log("Loaded " + recentWinners.length + " past winners from the Sheet.");

  // Track winners for this specific run to prevent double-winning instantly
  var sessionWinners = [];

  if (!messages || messages.length === 0) return;

  // Find valid messages that haven't been processed yet
  var targets = messages.filter(function (msg) {
    return msg.text &&
      msg.text.includes(config.NEW_HIRE_TARGET_TEXT) &&
      !hasBotReacted(msg, 'white_check_mark');
  });

  if (targets.length === 0) {
    console.log("No pending lottery messages found.");
    return;
  }

  // Process Oldest -> Newest
  targets.reverse();

  console.log("2. Found " + targets.length + " active lotteries.");

  targets.forEach(function (msg, index) {
    var msgTime = new Date(msg.ts * 1000).getTime();
    var hoursDiff = (new Date().getTime() - msgTime) / (1000 * 60 * 60);

    console.log("\n--- Processing Lottery #" + (index + 1) + " (Age: " + hoursDiff.toFixed(2) + "h) ---");

    if (hoursDiff < config.NEW_HIRE_WAIT_HOURS) {
      console.log("   -> Too new! Waiting for " + config.NEW_HIRE_WAIT_HOURS + " hours.");
      return;
    }

    var reactors = fetchReactors(msg.ts);
    if (reactors.length === 0) {
      console.log("   -> No votes found. Skipping.");
      return;
    }

    // --- FAIRNESS LOGIC ---

    // 1. Remove people who won just now in this session
    var pool = reactors.filter(function (id) { return !sessionWinners.includes(id); });

    if (pool.length === 0) {
      console.log("   -> All voters have won in this session already.");
      return;
    }

    // 2. Split into Priority Buckets
    // Priority A: "New Faces" (People NOT in the sheet history)
    // Priority B: "Recent Winners" (People already in sheet history)
    var priorityA = pool.filter(function (id) { return !recentWinners.includes(id); });
    var priorityB = pool.filter(function (id) { return recentWinners.includes(id); });

    console.log("   -> Voters: " + pool.length + " | New Faces: " + priorityA.length + " | Past Winners: " + priorityB.length);

    // Shuffle both buckets (proper Fisher-Yates)
    fisherYatesShuffle(priorityA);
    fisherYatesShuffle(priorityB);

    // 3. Fill the winner slots
    var winners = [];

    // Take from 'New Faces' first
    while (winners.length < config.WINNERS_COUNT && priorityA.length > 0) {
      winners.push(priorityA.pop());
    }

    // If we still need winners, take from 'Past Winners'
    while (winners.length < config.WINNERS_COUNT && priorityB.length > 0) {
      winners.push(priorityB.pop());
    }

    // Update the blacklist for the next loop
    sessionWinners = sessionWinners.concat(winners);

    // Run the win sequence
    processWinnersV2(msg, winners);
  });

  console.log("\n✅ All lotteries processed.");
}

// -------------------- New Hire Helper Functions --------------------

function processWinnersV2(msg, winnerIds) {
  // Extract the New Hire's ID from the message text (<@U12345> pattern)
  var mentionMatch = msg.text.match(/<@(U[A-Z0-9]+)>/);
  var newHireId = mentionMatch ? mentionMatch[1] : null;
  var newHireName = newHireId ? getUserName(newHireId) : "Unknown New Hire";

  // Notify Slack
  var mentions = winnerIds.map(function (id) { return "<@" + id + ">"; }).join(", ");
  var text = "🎉 **Donut Chat Time!**\n\nThe winners are: " + mentions + ".\n\nPlease schedule a coffee chat with " + newHireName + "! ☕️";

  postToSlack(text, msg.ts);
  markAsDone(msg.ts);
  logToSheetV2(msg.ts, newHireName, winnerIds);
}

function logToSheetV2(ts, newHireName, winnerIds) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Log");
    sheet.appendRow(["Date", "New Hire", "Winner 1", "Winner 2", "Winner 3", "Raw IDs"]);
  }

  var winnerNames = winnerIds.map(function (id) { return getUserName(id); });

  var row = [new Date(), newHireName];
  winnerNames.forEach(function (name) { row.push(name); });

  // Add the Raw IDs as a JSON string in the last column for bot history
  row.push(JSON.stringify(winnerIds));

  sheet.appendRow(row);
  console.log("Logged: " + newHireName + " -> " + winnerNames.join(", "));
}

function getRecentWinnerIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var startRow = Math.max(2, lastRow - 50);
  var numRows = lastRow - startRow + 1;

  var data = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();

  var recentWinners = [];

  data.forEach(function (row) {
    var rawIds = row[row.length - 1];
    try {
      var ids = JSON.parse(rawIds);
      if (Array.isArray(ids)) {
        recentWinners = recentWinners.concat(ids);
      }
    } catch (e) {
      // Ignore rows that don't have the new ID format yet
    }
  });

  return recentWinners;
}


// ╔════════════════════════════════════════════════════════════════╗
// ║          WORKFLOW 2: GUESS WHO DONUT PAIRING                  ║
// ╚════════════════════════════════════════════════════════════════╝

function runGuessWhoLottery() {
  var config = getDonutConfig_();
  console.log("🎲 Starting Guess Who search...");

  var messages = fetchRecentMessages();
  if (!messages || messages.length === 0) return;

  var pastPairs = getPastPairs();

  var targets = messages.filter(function (msg) {
    return msg.text &&
      msg.text.includes(config.GUESS_WHO_TARGET_TEXT) &&
      !hasBotReacted(msg, 'white_check_mark');
  });

  if (targets.length === 0) {
    console.log("No pending Guess Who lotteries found.");
    return;
  }

  // Process oldest first
  targets.reverse();

  targets.forEach(function (msg, index) {
    var msgTime = new Date(msg.ts * 1000).getTime();
    var hoursDiff = (new Date().getTime() - msgTime) / (1000 * 60 * 60);

    console.log("\n--- Processing Guess Who #" + (index + 1) + " (Age: " + hoursDiff.toFixed(2) + "h) ---");

    if (hoursDiff < config.GUESS_WHO_WAIT_HOURS) {
      console.log("   -> Too new! Waiting...");
      return;
    }

    var reactorIds = fetchReactors(msg.ts);
    if (reactorIds.length < 2) {
      console.log("   -> Not enough participants (Need 2+). Skipping.");
      return;
    }

    // Slack IDs are the identity source. Team/manager restrictions are loaded
    // from the private Members sheet; a missing optional profile never excludes
    // somebody who reacted to participate.
    var memberDirectory = getDonutMemberDirectory_();
    var validIds = reactorIds.filter(function (id) { return /^[UW][A-Z0-9]+$/.test(id); });

    if (validIds.length < 2) {
      console.log("   -> Not enough valid participants. Skipping.");
      return;
    }

    console.log("   -> Valid participants: " + validIds.length);

    // --- DETERMINE LOTTERY WINNER (if odd count) ---
    var forcedLeftover = null;
    if (validIds.length % 2 !== 0) {
      forcedLeftover = pickLotteryWinner(validIds, config.ASSIGNED_WINNER_SLACK_ID);
      console.log("   -> Lottery winner (sits out of pairing): " + getUserName(forcedLeftover));
    }

    // --- BUILD PAIRS WITH CONSTRAINT SOLVER ---
    var pairingPool = validIds.filter(function (id) { return id !== forcedLeftover; });
    var result = buildConstrainedPairs(pairingPool, memberDirectory, pastPairs);

    if (result) {
      console.log("   -> Pairing found! History conflicts: " + result.conflicts);
      processGuessWhoResults(msg, result.pairs, forcedLeftover);
    } else {
      console.log("   -> ❌ FAILED: Could not find any valid pairing after all attempts.");
      postToSlack("⚠️ I couldn't find a valid pairing that satisfies the team leader rules. Please check the roster or try with different participants.", msg.ts);
    }
  });
}

// -------------------- Lottery Winner Selection --------------------

function pickLotteryWinner(validIds, assignedWinnerSlackId) {
  if (assignedWinnerSlackId) {
    if (validIds.indexOf(assignedWinnerSlackId) !== -1) return assignedWinnerSlackId;
    console.log("   -> Assigned winner did not participate. Picking randomly.");
  }

  // Random pick using proper shuffle
  var shuffled = fisherYatesShuffle(validIds.slice());
  return shuffled[0];
}

// -------------------- Constraint-Based Pairing Engine --------------------
// Preference 1 (Hard): Never pair a member with their own team leader.
// Preference 2 (Soft): Prefer pairs that have never been matched before.

function buildConstrainedPairs(pool, memberDirectory, pastPairs) {
  var n = pool.length;
  if (n < 2 || n % 2 !== 0) return null;

  // Pre-compute: forbidden pairs (leader-member same team)
  var forbidden = {};
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      if (isLeaderMemberConflict(pool[i], pool[j], memberDirectory)) {
        forbidden[pool[i] + "-" + pool[j]] = true;
        forbidden[pool[j] + "-" + pool[i]] = true;
      }
    }
  }

  // Pre-compute: history pairs (already matched before)
  var historySet = {};
  pastPairs.forEach(function (p) { historySet[p] = true; });

  function isPairForbidden(id1, id2) {
    return forbidden[id1 + "-" + id2] === true;
  }

  function isPairRepeat(id1, id2) {
    return historySet[id1 + "-" + id2] === true || historySet[id2 + "-" + id1] === true;
  }

  // --- GREEDY ALGORITHM (up to 100 shuffled attempts) ---
  var bestPairs = null;
  var bestConflicts = 999;

  for (var attempt = 0; attempt < 100; attempt++) {
    var shuffled = fisherYatesShuffle(pool.slice());
    var result = greedyPairWithPriority(shuffled, isPairForbidden, isPairRepeat);

    if (result !== null) {
      if (result.conflicts < bestConflicts) {
        bestConflicts = result.conflicts;
        bestPairs = result.pairs;
      }
      if (bestConflicts === 0) break; // Perfect solution — stop early
    }
  }

  if (bestPairs === null) return null;
  return { pairs: bestPairs, conflicts: bestConflicts };
}

// For a given ordering, pair people greedily. Skip forbidden pairs by scanning
// ahead for a valid partner. Prefer novel partners over repeats.

function greedyPairWithPriority(ids, isForbidden, isRepeat) {
  var used = {};
  var pairs = [];
  var conflicts = 0;

  for (var i = 0; i < ids.length; i++) {
    if (used[ids[i]]) continue;

    var bestPartner = null;
    var bestIsRepeat = true;

    // Scan remaining for the best valid partner
    for (var j = i + 1; j < ids.length; j++) {
      if (used[ids[j]]) continue;
      if (isForbidden(ids[i], ids[j])) continue; // Hard constraint: skip

      var repeat = isRepeat(ids[i], ids[j]);

      // Prefer novel partner — take first novel match found
      if (!repeat) {
        bestPartner = j;
        bestIsRepeat = false;
        break;
      }

      // Remember the first valid (but repeat) partner as fallback
      if (bestPartner === null) {
        bestPartner = j;
        bestIsRepeat = true;
      }
    }

    if (bestPartner === null) {
      // This person can't be paired with anyone remaining — attempt fails
      return null;
    }

    used[ids[i]] = true;
    used[ids[bestPartner]] = true;
    pairs.push([ids[i], ids[bestPartner]]);
    if (bestIsRepeat) conflicts++;
  }

  if (pairs.length !== ids.length / 2) return null;

  return { pairs: pairs, conflicts: conflicts };
}

// -------------------- Team Constraint Check --------------------
// Returns true ONLY if one person is the team leader and the other
// is a member on that SAME team. Member-member is ALLOWED.

function isLeaderMemberConflict(slackId1, slackId2, memberDirectory) {
  var person1 = memberDirectory[slackId1] || {};
  var person2 = memberDirectory[slackId2] || {};
  return person1.managerSlackId === slackId2 || person2.managerSlackId === slackId1;
}

// -------------------- Guess Who History --------------------

function getPastPairs() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("GuessWho");
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 3, lastRow - 1, 1).getValues();

  var history = [];

  data.forEach(function (row) {
    var cellText = String(row[0]);
    var ids = cellText.match(/U[A-Z0-9]+/g);

    if (ids && ids.length >= 2) {
      for (var i = 0; i < ids.length - 1; i += 2) {
        history.push(ids[i] + "-" + ids[i + 1]);
        history.push(ids[i + 1] + "-" + ids[i]);
      }
    }
  });

  return history;
}

// -------------------- Guess Who Result Processing --------------------

function processGuessWhoResults(msg, pairs, leftover) {
  var messageText = "🍩 **The Donuts are Served!** 🍩\n\nHere are your random pairs for this session:\n";
  var pairStringsForSheet = [];

  pairs.forEach(function (pair) {
    messageText += "• <@" + pair[0] + "> + <@" + pair[1] + ">\n";

    var n1 = getUserName(pair[0]);
    var n2 = getUserName(pair[1]);

    pairStringsForSheet.push(n1 + " & " + n2 + " (" + pair[0] + "-" + pair[1] + ")");
  });

  var winnerName = "N/A";
  if (leftover) {
    winnerName = getUserName(leftover);
    messageText += "\n🌟 **LOTTERY WINNER:** <@" + leftover + ">\nCongratulations! You are the odd one out. You get to **pick any pair above** and join them for a trio chat! :cool-doge:";
  } else {
    messageText += "\n(Even number of participants — no lottery winner needed!)";
  }

  messageText += "\n\nPlease reach out to your partner(s) to schedule a time!";

  postToSlack(messageText, msg.ts);
  markAsDone(msg.ts);
  logToGuessWhoSheet(msg.ts, pairStringsForSheet.join(", "), winnerName);
}

function logToGuessWhoSheet(ts, pairsString, winnerName) {
  var sheetName = "GuessWho";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
    sheet.appendRow(["Date", "Message TS", "Pairs (with IDs)", "Lottery Winner"]);
  }

  sheet.appendRow([new Date(), ts, pairsString, winnerName]);
}


// ╔════════════════════════════════════════════════════════════════╗
// ║          SHARED: SLACK API HELPERS                             ║
// ╚════════════════════════════════════════════════════════════════╝

function fetchRecentMessages() {
  var channelId = getDonutConfig_().CHANNEL_ID;
  var url = "https://slack.com/api/conversations.history?channel=" + channelId + "&limit=20";
  var res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + SLACK_TOKEN },
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText());
  return json.ok ? json.messages : [];
}

function fetchReactors(ts) {
  var config = getDonutConfig_();
  var url = "https://slack.com/api/reactions.get?channel=" + config.CHANNEL_ID + "&timestamp=" + ts + "&full=true";
  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + SLACK_TOKEN },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());

  if (!data.ok || !data.message || !data.message.reactions) return [];

  var reaction = data.message.reactions.find(function (r) { return r.name === config.TARGET_EMOJI; });
  return reaction ? reaction.users : [];
}

function getUserName(userId) {
  try {
    var url = "https://slack.com/api/users.info?user=" + userId;
    var res = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + SLACK_TOKEN } });
    var json = JSON.parse(res.getContentText());
    return json.ok ? (json.user.real_name || json.user.name) : userId;
  } catch (e) {
    return userId;
  }
}

function postToSlack(text, threadTs) {
  var payload = { channel: getDonutConfig_().CHANNEL_ID, text: text, thread_ts: threadTs };
  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    headers: { Authorization: "Bearer " + SLACK_TOKEN, "Content-Type": "application/json" },
    payload: JSON.stringify(payload)
  });
}

function markAsDone(ts) {
  var payload = { channel: getDonutConfig_().CHANNEL_ID, name: "white_check_mark", timestamp: ts };
  UrlFetchApp.fetch("https://slack.com/api/reactions.add", {
    method: "post",
    headers: { Authorization: "Bearer " + SLACK_TOKEN, "Content-Type": "application/json" },
    payload: JSON.stringify(payload)
  });
}

function hasBotReacted(msg, emoji) {
  return msg.reactions && msg.reactions.some(function (r) { return r.name === emoji; });
}


// ╔════════════════════════════════════════════════════════════════╗
// ║          SHARED: UTILITY FUNCTIONS                            ║
// ╚════════════════════════════════════════════════════════════════╝

// Proper uniform random shuffle (replaces biased sort-random)
function fisherYatesShuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}


// ╔════════════════════════════════════════════════════════════════╗
// ║          DONUT TOWN: PUBLISH SLACK ENTRANCE                   ║
// ╚════════════════════════════════════════════════════════════════╝

// Run this manually when you want to publish a fresh entrance message in the
// configured testing channel. Button clicks are handled by the Render service,
// so this Apps Script does not need a doPost(e) handler for Donut Town.
function postDonutTownEntrance() {
  var payload = {
    channel: getDonutConfig_().CHANNEL_ID,
    text: "Donut Town is open. Enter to meet a neighbor.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Donut Town is open* :doughnut:\nWalk around, meet a neighbor, and send a private Donut chat invitation."
        }
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
            value: "testing"
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
  return result.ts;
}
