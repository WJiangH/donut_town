const STORE_VERSION = 1;

export class UpstashInvitationStore {
  constructor({ url = "", token = "", fetchImpl = globalThis.fetch } = {}) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  get configured() {
    return Boolean(this.url && this.token);
  }

  async load(roundId) {
    if (!this.configured) return [];
    const stored = await this.#command(["GET", keyForRound(roundId)]);
    if (stored === null) return null;
    let payload;
    try {
      payload = JSON.parse(stored);
    } catch {
      throw new Error("Upstash invitation data is not valid JSON");
    }
    if (payload?.version !== STORE_VERSION || payload.roundId !== roundId || !Array.isArray(payload.snapshots)) {
      throw new Error("Upstash invitation data has an unsupported format");
    }
    return payload.snapshots;
  }

  async save(roundId, snapshots) {
    if (!this.configured) return;
    const payload = JSON.stringify({
      version: STORE_VERSION,
      roundId,
      savedAt: new Date().toISOString(),
      snapshots
    });
    await this.#command(["SET", keyForRound(roundId), payload]);
  }

  async #command(command) {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Upstash request failed (${response.status})`);
    const payload = await response.json();
    if (payload?.error) throw new Error(`Upstash request failed: ${payload.error}`);
    return payload?.result ?? null;
  }
}

export function keyForRound(roundId) {
  if (!/^week:\d{4}-\d{2}-\d{2}$/.test(roundId || "")) throw new Error("Invalid invitation round ID");
  return `donut-town:invitations:${roundId}`;
}
