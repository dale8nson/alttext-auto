/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests-e2e/'],
  transform: {
    '^.+\\.(ts|tsx)$': ['@swc/jest'],
  },
};
