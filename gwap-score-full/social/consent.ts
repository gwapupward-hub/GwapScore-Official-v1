export const SOCIAL_CONSENT_POLICY_VERSION = '2026-10-04';

export const SOCIAL_CONSENT_COPY = {
  collected: 'We read the profile and public/authorized post metrics your selected social platform makes available, such as account identifiers, post dates, and engagement counts.',
  notCollected: 'We do not collect passwords, private messages, contacts, or data outside the permissions shown by the platform.',
  purpose: 'We use authorized profile and content metrics to provide an explainable social reputation grade and history.',
  rights: 'You can disconnect an account at any time. Disconnecting removes its stored tokens and snapshots; you may also request deletion of your consent and score records.',
} as const;

export const INSTAGRAM_READ_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
] as const;
