import { TrustProfile } from "../core-engine/src/types";

export function deriveScore(profile: TrustProfile) {
  let score = 20;
  const explanation = {
    contributing_claims: [] as string[],
    contributing_events: [] as string[],
    active_attestations: [] as string[],
    penalties_applied: [] as string[]
  };

  for (const c of profile.claims) {
    if (c.type === "owns_wallet") {
      score += 10;
      explanation.contributing_claims.push("Wallet ownership verified");
    }
    if (c.type === "telegram_id") {
      score += 5;
      explanation.contributing_claims.push("Telegram linked");
    }
    if (c.type === "solana_wallet_age_days") {
      const days = parseInt(c.value);
      if (days > 180) {
        score += 10;
        explanation.contributing_claims.push("Established Solana wallet");
      }
    }
  }

  for (const e of profile.events) {
    if (e.event_type === "positive_interaction") {
      score += 2;
      explanation.contributing_events.push(e.description);
    }
    if (e.event_type === "policy_violation") {
      score -= 15;
      explanation.penalties_applied.push(e.description);
    }
  }

  let multiplier = 1;
  const now = Date.now();

  for (const a of profile.attestations) {
    if (!a.expires_at || new Date(a.expires_at).getTime() > now) {
      multiplier += a.weight;
      explanation.active_attestations.push(`Attested by ${a.issuer_id}`);
    }
  }

  score = Math.round(score * multiplier);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    tier: score >= 80 ? "Elite" : score >= 60 ? "Trusted" : score >= 30 ? "Verified" : "Rookie",
    risk: score < 30 ? "High" : score < 60 ? "Medium" : "Low",
    explanation
  };
}
