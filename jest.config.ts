export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/gwap-score-full', '<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest']
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)']
};
