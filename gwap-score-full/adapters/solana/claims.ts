import { appendClaim } from "../../core-engine/src/engine";

export function submitSolanaEvidence(subjectId: string, walletAgeDays: number, txCount: number) {
  appendClaim(subjectId, {
    claim_id: crypto.randomUUID(),
    type: "solana_wallet_age_days",
    value: walletAgeDays.toString(),
    source: "solana",
    issued_at: new Date().toISOString()
  });

  appendClaim(subjectId, {
    claim_id: crypto.randomUUID(),
    type: "solana_tx_count",
    value: txCount.toString(),
    source: "solana",
    issued_at: new Date().toISOString()
  });
}
