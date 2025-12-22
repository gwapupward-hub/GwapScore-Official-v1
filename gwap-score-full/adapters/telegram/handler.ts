import { appendClaim, appendEvent } from "../../core-engine/src/engine";

export function handleTelegramVerify(subjectId: string, telegramId: string) {
  appendClaim(subjectId, {
    claim_id: crypto.randomUUID(),
    type: "telegram_id",
    value: telegramId,
    source: "telegram",
    issued_at: new Date().toISOString()
  });

  appendEvent(subjectId, {
    event_id: crypto.randomUUID(),
    event_type: "positive_interaction",
    description: "Telegram account linked",
    source: "telegram",
    issued_at: new Date().toISOString()
  });
}
