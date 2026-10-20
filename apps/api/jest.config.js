/** پیکربندی Jest — تست‌های واحد و e2e روی پایگاه‌داده حافظه‌ای (sql.js) اجرا می‌شوند. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.(e2e-spec|e2e-test|spec|test)\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: false }],
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  testTimeout: 60000,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/dto/**', '!src/**/*.entity.ts', '!src/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
  verbose: false,
};
