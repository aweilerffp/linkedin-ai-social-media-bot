import dotenv from 'dotenv';
import { jest } from '@jest/globals';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set up global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Any global setup logic
});

afterAll(async () => {
  // Any global cleanup logic
});

// Reset all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});