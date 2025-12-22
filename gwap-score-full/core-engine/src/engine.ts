import { TrustProfile, Claim, Event, Attestation } from "./types";

const store = new Map<string, TrustProfile>();

export function createProfile(subject_id: string): TrustProfile {
  if (store.has(subject_id)) throw new Error("Profile exists");
  const profile: TrustProfile = {
    subject_id,
    created_at: new Date().toISOString(),
    claims: [],
    events: [],
    attestations: []
  };
  store.set(subject_id, profile);
  return profile;
}

export function appendClaim(id: string, claim: Claim) {
  const p = store.get(id);
  if (!p) throw new Error("Profile not found");
  p.claims.push(claim);
}

export function appendEvent(id: string, event: Event) {
  const p = store.get(id);
  if (!p) throw new Error("Profile not found");
  p.events.push(event);
}

export function appendAttestation(id: string, att: Attestation) {
  const p = store.get(id);
  if (!p) throw new Error("Profile not found");
  p.attestations.push(att);
}

export function getProfile(id: string): TrustProfile {
  const p = store.get(id);
  if (!p) throw new Error("Profile not found");
  return p;
}
