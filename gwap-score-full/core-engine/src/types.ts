export type Claim = {
  claim_id: string;
  type: string;
  value: string;
  source: string;
  issued_at: string;
  expires_at?: string;
  created_at?: string;
};

export type Event = {
  event_id: string;
  event_type: string;
  description: string;
  source: string;
  issued_at: string;
  created_at?: string;
};

export type Attestation = {
  attestation_id: string;
  issuer_id: string;
  scope: string;
  weight: number;
  issued_at: string;
  expires_at?: string;
  signature: string;
  signature_verified?: boolean;
  created_at?: string;
};

export type TrustProfile = {
  subject_id: string;
  created_at: string;
  updated_at?: string;
  claims: Claim[];
  events: Event[];
  attestations: Attestation[];
};

export type TrustedIssuer = {
  issuer_id: string;
  public_key: string;
  name: string;
  description?: string;
  max_weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
