import { createHash, randomUUID } from "node:crypto";

const invitations = new Map();
let loadedRoundId = activeRoundId();

export function activeRoundId(now = new Date()) {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return `week:${monday.toISOString().slice(0, 10)}`;
}

function ensureActiveRound() {
  const current = activeRoundId();
  if (loadedRoundId === current) return current;
  invitations.clear();
  loadedRoundId = current;
  return current;
}

export function appearanceIndexFor(slackUserId) {
  const digest = createHash("sha256").update(slackUserId).digest();
  return digest.readUInt32BE(0) % 12;
}

export function createInvitation({ inviterId, inviteeId, inviterName, priority = 1, selfTest = false }) {
  const roundId = ensureActiveRound();
  const invitation = {
    id: randomUUID(),
    inviterId,
    inviteeId,
    inviterName,
    priority,
    selfTest,
    roundId,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  invitations.set(invitation.id, invitation);
  return invitation;
}

export function getInvitation(id) {
  ensureActiveRound();
  return invitations.get(id);
}

export function discardInvitation(id) {
  ensureActiveRound();
  return invitations.delete(id);
}

export function pendingInvitationsFor(inviterId) {
  const roundId = ensureActiveRound();
  return [...invitations.values()].filter(invitation => !invitation.selfTest && invitation.roundId === roundId && invitation.inviterId === inviterId && invitation.status === "pending");
}

export function invitationStateFor(userId) {
  const roundId = ensureActiveRound();
  const related = [...invitations.values()].filter(invitation =>
    !invitation.selfTest && invitation.roundId === roundId && (invitation.inviterId === userId || invitation.inviteeId === userId)
  );
  const accepted = related.find(invitation => invitation.status === "accepted");
  if (accepted) {
    return {
      status: "booked",
      partnerId: accepted.inviterId === userId ? accepted.inviteeId : accepted.inviterId,
      pairId: accepted.id
    };
  }
  const pending = related.find(invitation => invitation.status === "pending" && invitation.inviteeId === userId);
  return pending
    ? { status: "pending", partnerId: pending.inviterId, pairId: null }
    : { status: "open", partnerId: null, pairId: null };
}

export function activeInvitations() {
  const roundId = ensureActiveRound();
  return [...invitations.values()].filter(invitation => !invitation.selfTest && invitation.roundId === roundId);
}

export function invitationSnapshotFor(inviterId) {
  const roundId = ensureActiveRound();
  return {
    version: 1,
    roundId,
    inviterId,
    invitations: activeInvitations()
      .filter(invitation => invitation.inviterId === inviterId)
      .map(invitation => ({
        id: invitation.id,
        inviterId: invitation.inviterId,
        inviteeId: invitation.inviteeId,
        inviterName: invitation.inviterName,
        priority: invitation.priority,
        status: invitation.status,
        createdAt: invitation.createdAt,
        answeredAt: invitation.answeredAt || null
      }))
  };
}

export function restoreInvitationSnapshots(snapshots) {
  const roundId = ensureActiveRound();
  invitations.clear();
  for (const snapshot of snapshots) {
    if (snapshot?.version !== 1 || snapshot.roundId !== roundId || !/^[UW][A-Z0-9]+$/.test(snapshot.inviterId || "")) continue;
    for (const invitation of snapshot.invitations || []) {
      if (!isRestorableInvitation(invitation, snapshot.inviterId)) continue;
      invitations.set(invitation.id, { ...invitation, roundId, selfTest: false });
    }
  }
}

function isRestorableInvitation(invitation, inviterId) {
  return typeof invitation?.id === "string"
    && invitation.inviterId === inviterId
    && /^[UW][A-Z0-9]+$/.test(invitation.inviteeId || "")
    && ["pending", "accepted", "declined", "cancelled"].includes(invitation.status)
    && Number.isInteger(invitation.priority)
    && invitation.priority >= 1
    && invitation.priority <= 3;
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
  ensureActiveRound();
  const invitation = invitations.get(id);
  if (!["accepted", "declined"].includes(status)) return null;
  if (!invitation || invitation.inviteeId !== responderId || invitation.status !== "pending") return null;
  invitation.status = status;
  invitation.answeredAt = new Date().toISOString();
  if (status === "accepted" && !invitation.selfTest) {
    const bookedIds = new Set([invitation.inviterId, invitation.inviteeId]);
    for (const other of invitations.values()) {
      if (other.id === invitation.id || other.selfTest || other.status !== "pending") continue;
      if (bookedIds.has(other.inviterId) || bookedIds.has(other.inviteeId)) {
        other.status = "cancelled";
        other.answeredAt = invitation.answeredAt;
      }
    }
  }
  return invitation;
}

export function invitationMessage(invitation) {
  const text = invitation.selfTest
    ? `Test preview: ${invitation.inviterName} invited you to a Donut chat.`
    : `${invitation.inviterName} invited you to a Donut chat.`;
  const invitationCopy = `<@${invitation.inviterId}> would like to have a Donut chat with you this week. :doughnut:`;
  const message = invitation.selfTest
    ? `*Test preview - sent only to you*\n${invitationCopy}\nThis is how the invitation will look to a teammate.`
    : invitationCopy;
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
