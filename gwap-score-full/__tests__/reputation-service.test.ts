import { deriveSocialReputationDimension } from '../reputation/service.js';

describe('GwapScore v2 social evidence bridge', () => {
  test('requires re-ingestion for legacy social scores without evidence state', () => {
    const result = deriveSocialReputationDimension({
      score_id: 'score-legacy',
      account_id: 'account-1',
      platform: 'instagram',
      score: 82,
      grade: 'B',
      explanation: {
        factors: [
          { category: 'authenticity', score: 80, weight: 25, contribution: 20 },
        ],
      },
      created_at: new Date().toISOString(),
    });

    expect(result.state).toBe('unavailable');
    if (result.state === 'unavailable') {
      expect(result.reason).toMatch(/re-ingestion/i);
    }
  });

  test('uses post-migration social evidence and derives confidence from observed coverage', () => {
    const result = deriveSocialReputationDimension({
      score_id: 'score-v2',
      account_id: 'account-1',
      platform: 'instagram',
      score: 74,
      grade: 'C',
      explanation: {
        factors: [
          { state: 'observed', effectiveWeight: 25 },
          { state: 'observed', effectiveWeight: 12.5 },
          { state: 'unavailable', effectiveWeight: 0 },
          { state: 'observed', effectiveWeight: 15 },
          { state: 'unavailable', effectiveWeight: 0 },
        ],
      },
      created_at: new Date().toISOString(),
    });

    expect(result.state).toBe('observed');
    if (result.state === 'observed') {
      expect(result.score).toBe(74);
      expect(result.confidence).toBe(0.525);
      expect(result.provenance).toContain('social-score:score-v2');
    }
  });
});
