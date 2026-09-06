const LEDGER_MARKER = "DONUT_TOWN_LEDGER_V1";

export function encodeLedgerSnapshot(snapshot) {
  return `${LEDGER_MARKER}\n${JSON.stringify(snapshot)}`;
}

export function decodeLedgerSnapshot(text) {
  if (typeof text !== "string" || !text.startsWith(`${LEDGER_MARKER}\n`)) return null;
  try {
    const snapshot = JSON.parse(text.slice(LEDGER_MARKER.length + 1));
    return snapshot?.version === 1 ? snapshot : null;
  } catch {
    return null;
  }
}
