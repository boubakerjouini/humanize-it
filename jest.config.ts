import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // tests/ holds the Playwright e2e suite (npx playwright test), which jest can't run.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/tests/", "<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { strict: false } }],
    // Email template tests: @react-email/render's CommonJS build uses a native
    // import() that jest's CommonJS runtime can't run (see the transformer).
    "^.+[/\\\\]@react-email[/\\\\]render[/\\\\].+\\.cjs$": "<rootDir>/jest.dynamic-import.cjs",
  },
  transformIgnorePatterns: ["[/\\\\]node_modules[/\\\\](?!@react-email[/\\\\]render[/\\\\])"],
};

export default config;
