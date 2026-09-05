import { createHash, randomUUID } from "node:crypto";

const invitations = new Map();

export function appearanceIndexFor(slackUserId) {
  const digest = createHash("sha256").update(slackUserId).digest();
  return digest.readUInt32BE(0) % 12;
}

export function createInvitation({ inviterId, inviteeId, inviterName, priority = 1 }) {
  const invitation = {
    id: randomUUID(),
    inviterId,
    inviteeId,
    inviterName,
    priority,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  invitations.set(invitation.id, invitation);
  return invitation;
}

export function getInvitation(id) {
  return invitations.get(id);
}

export function answerInvitation(id, status, responderId) {
  const invitation = invitations.get(id);
  if (!invitation || invitation.inviteeId !== responderId || invitation.status !== "pending") return null;
  invitation.status = status;
  invitation.answeredAt = new Date().toISOString();
  return invitation;
}

export function invitationMessage(invitation) {
  const text = `${invitation.inviterName} invited you to a Donut chat.`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${escapeSlackText(invitation.inviterName)}* would like to have a Donut chat with you this week. :doughnut:`
        }
      },
      {
        type: "actions",
        block_id: `donut_invitation_${invitation.id}`,
        elements: [
          {
            type: "button",
            action_id: "donut_accept",
            text: { type: "plain_text", text: "Accept" },
            style: "primary",
            value: invitation.id
          },
          {
            type: "button",
            action_id: "donut_decline",
            text: { type: "plain_text", text: "Not this week" },
            value: invitation.id
          }
        ]
      }
    ]
  };
}

function escapeSlackText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
