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
    this.userCache = new Map();
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
    const profiles = await mapWithConcurrency(memberIds, 5, userId => this.getUser(userId));
    return profiles.flatMap(profile => {
      if (!profile || profile.deleted || profile.is_bot || profile.is_app_user) return [];
      const details = profile.profile || {};
      return [{
        id: profile.id,
        displayName: details.display_name || profile.real_name || profile.name,
        realName: profile.real_name || details.real_name || "",
        avatarUrl: details.image_192 || details.image_72 || "",
        title: details.title || "",
        pronouns: details.pronouns || "",
        statusText: details.status_text || "",
        timezone: profile.tz || "",
        timezoneLabel: profile.tz_label || ""
      }];
    });
  }

  async getUser(userId) {
    const cached = this.userCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.user;
    try {
      const result = await this.call("users.info", { user: userId });
      this.userCache.set(userId, { user: result.user, expiresAt: Date.now() + 10 * 60 * 1000 });
      return result.user;
    } catch (error) {
      if (error instanceof SlackApiError && ["user_not_found", "user_not_visible"].includes(error.slackError)) return null;
      throw error;
    }
  }

  async openDm(userId) {
    const result = await this.call("conversations.open", { users: userId });
    return result.channel.id;
  }

  async postMessage(channel, message) {
    return this.call("chat.postMessage", { channel, ...message });
  }

  async updateMessage(channel, ts, message) {
    return this.call("chat.update", { channel, ts, ...message });
  }

  async listRecentMessages(channel, limit = 200) {
    const result = await this.call("conversations.history", { channel, limit });
    return result.messages || [];
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
