const SLACK_API = "https://slack.com/api";

export class SlackApiError extends Error {
  constructor(method, response) {
    super(`Slack ${method} failed: ${response.error || "unknown_error"}`);
    this.name = "SlackApiError";
    this.method = method;
    this.slackError = response.error;
  }
}

export class SlackClient {
  constructor(token, fetchImpl = fetch) {
    this.token = token;
    this.fetch = fetchImpl;
  }

  async call(method, body = {}) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      form.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
    const response = await this.fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: form
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new SlackApiError(method, result);
    return result;
  }

  async listChannelMemberIds(channelId) {
    const memberIds = [];
    let cursor;
    do {
      const result = await this.call("conversations.members", {
        channel: channelId,
        limit: 200,
        ...(cursor ? { cursor } : {})
      });
      memberIds.push(...result.members);
      cursor = result.response_metadata?.next_cursor || "";
    } while (cursor);
    return memberIds;
  }

  async listChannelMembers(channelId) {
    const memberIds = await this.listChannelMemberIds(channelId);
    const channelMembers = new Set(memberIds);
    const members = [];
    let cursor;
    do {
      const result = await this.call("users.list", {
        limit: 200,
        ...(cursor ? { cursor } : {})
      });
      for (const profile of result.members) {
        if (!channelMembers.has(profile.id) || profile.deleted || profile.is_bot || profile.is_app_user) continue;
        members.push({
          id: profile.id,
          displayName: profile.profile.display_name || profile.real_name || profile.name,
          realName: profile.real_name || profile.profile.real_name || "",
          avatarUrl: profile.profile.image_72 || "",
          timezone: profile.tz || ""
        });
      }
      cursor = result.response_metadata?.next_cursor || "";
    } while (cursor);
    return members;
  }

  async openDm(userId) {
    const result = await this.call("conversations.open", { users: userId });
    return result.channel.id;
  }

  async postMessage(channel, message) {
    return this.call("chat.postMessage", { channel, ...message });
  }
}
