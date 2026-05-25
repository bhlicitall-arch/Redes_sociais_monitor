module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@mcp/(.*)$': '<rootDir>/src/mcp/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1',
    '^@memory/(.*)$': '<rootDir>/src/memory/$1',
    '^@skills/(.*)$': '<rootDir>/src/skills/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
};
