/**
 * Copy this function into the existing Donut Lottery Sheet-bound Apps Script.
 * It reuses that project's SLACK_TOKEN and CHANNEL_ID constants.
 *
 * Button callbacks go to Render, so Apps Script does not need doPost(e).
 * Run this function manually once to publish the testing-channel entrance.
 */
function postDonutTownEntrance() {
  var payload = {
    channel: CHANNEL_ID,
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
