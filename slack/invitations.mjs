import { createHash, randomUUID } from "node:crypto";

const invitations = new Map();

export function appearanceIndexFor(slackUserId) {
  const digest = createHash("sha256").update(slackUserId).digest();
  return digest.readUInt32BE(0) % 12;
}

export function createInvitation({ inviterId, inviteeId, inviterName, priority = 1, selfTest = false }) {
  const invitation = {
    id: randomUUID(),
    inviterId,
    inviteeId,
    inviterName,
    priority,
    selfTest,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  invitations.set(invitation.id, invitation);
  return invitation;
}

export function getInvitation(id) {
  return invitations.get(id);
}

export function discardInvitation(id) {
  return invitations.delete(id);
}

export function pendingInvitationsFor(inviterId) {
  return [...invitations.values()].filter(invitation => !invitation.selfTest && invitation.inviterId === inviterId && invitation.status === "pending");
}

export function resolveInvitationActors({ sessionUserId, inviteeId, priority = 1, members, allowSelfInvite = false }) {
  if (!/^[UW][A-Z0-9]+$/.test(sessionUserId || "")) throw new SyntaxError("A Slack login is required");
  if (!/^[UW][A-Z0-9]+$/.test(inviteeId || "")) throw new SyntaxError("Invalid Slack invitee ID");
  if (sessionUserId === inviteeId && !allowSelfInvite) throw new SyntaxError("Cannot invite yourself");
  const inviter = members.find(member => member.id === sessionUserId);
  const invitee = members.find(member => member.id === inviteeId);
  if (!inviter || !invitee) throw new SyntaxError("Both people must be members of the Donut channel");
  const normalizedPriority = Number(priority || 1);
  if (!Number.isInteger(normalizedPriority) || normalizedPriority < 1 || normalizedPriority > 3) {
    throw new SyntaxError("Priority must be 1-3");
  }
  return {
    inviterId: inviter.id,
    inviterName: inviter.displayName,
    inviteeId: invitee.id,
    priority: normalizedPriority,
    selfTest: allowSelfInvite && sessionUserId === inviteeId
  };
}

export function answerInvitation(id, status, responderId) {
  const invitation = invitations.get(id);
  if (!invitation || invitation.inviteeId !== responderId || invitation.status !== "pending") return null;
  invitation.status = status;
  invitation.answeredAt = new Date().toISOString();
  return invitation;
}

export function invitationMessage(invitation) {
  const text = invitation.selfTest
    ? "This is your Donut Town test invitation."
    : `${invitation.inviterName} invited you to a Donut chat.`;
  const message = invitation.selfTest
    ? "*Donut Town test invitation* :doughnut:\nThis is what a teammate will receive when you invite them. Try either button below."
    : `*${escapeSlackText(invitation.inviterName)}* would like to have a Donut chat with you this week. :doughnut:`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message
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
