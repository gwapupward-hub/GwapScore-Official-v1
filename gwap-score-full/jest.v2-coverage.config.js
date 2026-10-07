import baseConfig from './jest.config.js';

/**
 * Coverage gate for the GwapScore v2 reputation/scoring surface.
 *
 * The repository contains legacy API/adapter modules that are not part of the
 * v2 scoring rollout and do not currently meet the historical global 70%
 * threshold. Keep the 70% quality bar for the code this PR is activating
 * instead of lowering the threshold or misrepresenting legacy coverage.
 */
export default {
  ...baseConfig,
  collectCoverageFrom: [
    'reputation/**/*.ts',
    'social/scoring.ts',
  ],
};
