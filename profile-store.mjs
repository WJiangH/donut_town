const PROFILE_LIMITS = {
  team: 80,
  specialty: 120,
  location: 80,
  pet: 80,
  topics: 180
};

export function normalizeProfile(input = {}) {
  return Object.fromEntries(Object.entries(PROFILE_LIMITS).map(([field, limit]) => {
    const value = Array.isArray(input[field]) ? input[field].join(", ") : input[field];
    return [field, String(value || "").trim().slice(0, limit)];
  }));
}

export class SheetProfileStore {
  constructor({ url = "", secret = "", fetchImpl = fetch } = {}) {
    this.url = url;
    this.secret = secret;
    this.fetch = fetchImpl;
  }

  get configured() {
    return Boolean(this.url && this.secret);
  }

  async list() {
    const result = await this.request("list");
    return result.profiles || {};
  }

  async update(slackId, profile) {
    const result = await this.request("update", {
      slackId,
      profile: normalizeProfile(profile)
    });
    return result.profile;
  }

  async request(action, payload = {}) {
    if (!this.configured) throw new Error("profile_store_not_configured");
    const response = await this.fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, secret: this.secret, ...payload })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "profile_store_failed");
    return result;
  }
}
