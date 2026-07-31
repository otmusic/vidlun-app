/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  // Default testMatch treats every file under __tests__ as a suite, which
  // makes shared fixtures fail as empty test files.
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Jest runs on CommonJS; the app tsconfig targets a bundler.
        tsconfig: { module: 'commonjs', moduleResolution: 'node' },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  passWithNoTests: true,
  clearMocks: true,
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/infrastructure/**/*.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // Weighted by risk, not spread evenly.
  coverageThreshold: {
    './src/domain/': { lines: 95 },
    './src/application/': { lines: 90 },
    './src/infrastructure/': { lines: 60 },
  },
};
