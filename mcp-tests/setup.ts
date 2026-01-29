/**
 * Global E2E Test Setup
 *
 * Initializes test environment, validates configuration, and sets up shared resources
 */

import 'dotenv/config';
import { beforeAll, afterAll } from 'vitest';
import { OAuthTestClient, TokenCache } from './helpers/oauth-client';
import { MCPTestClient } from './helpers/mcp-client';
import { initRecorder, finalizeRecorder } from './helpers/recorder';
import { TEST_USERS, getUserPassword } from './fixtures/users';

// Global test configuration
export const TEST_CONFIG = {
  baseUrl: process.env.MCP_BASE_URL || 'https://dev-mcp.kansofy.com',
  timeoutMs: 60000, // 60 seconds for OAuth flows
  retryAttempts: 3,
  retryDelayMs: 1000,
};

// Shared instances
let tokenCache: TokenCache | null = null;
let oauthClient: OAuthTestClient | null = null;

/**
 * Get or create token cache singleton
 */
export function getTokenCache(): TokenCache {
  if (!tokenCache) {
    tokenCache = new TokenCache(TEST_CONFIG.baseUrl);
  }
  return tokenCache;
}

/**
 * Get fresh OAuth client
 */
export function getOAuthClient(): OAuthTestClient {
  return new OAuthTestClient(TEST_CONFIG.baseUrl);
}

/**
 * Get MCP client for a user (authenticates if needed)
 */
export async function getMCPClientForUser(userEmail: string): Promise<MCPTestClient> {
  const cache = getTokenCache();
  const password = getUserPassword(userEmail);
  const accessToken = await cache.getToken(userEmail, password);
  return new MCPTestClient(accessToken, TEST_CONFIG.baseUrl);
}

/**
 * Verify environment is configured
 */
export function verifyEnvironment(): void {
  const requiredEnvVars = ['MCP_BASE_URL'];

  // Check at least one user password is configured
  const userEmails = Object.keys(TEST_USERS);
  const missingPasswords: string[] = [];

  for (const email of userEmails) {
    const key = email.split('@')[0].toUpperCase();
    const envVar = `TEST_USER_${key}_PASSWORD`;
    if (!process.env[envVar]) {
      missingPasswords.push(envVar);
    }
  }

  if (missingPasswords.length === userEmails.length) {
    console.error('No test user passwords configured. Set at least one:');
    missingPasswords.forEach((v) => console.error(`  - ${v}`));
    throw new Error('Missing test user passwords');
  }

  if (missingPasswords.length > 0) {
    console.warn('Warning: Some test users will be skipped (missing passwords):');
    missingPasswords.forEach((v) => console.warn(`  - ${v}`));
  }

  // Check base URL
  if (!process.env.MCP_BASE_URL) {
    console.warn(`MCP_BASE_URL not set, using default: ${TEST_CONFIG.baseUrl}`);
  }
}

/**
 * Get list of users that have passwords configured
 */
export function getConfiguredUsers(): string[] {
  return Object.keys(TEST_USERS).filter((email) => {
    const key = email.split('@')[0].toUpperCase();
    return !!process.env[`TEST_USER_${key}_PASSWORD`];
  });
}

/**
 * Check if a specific user has password configured
 */
export function isUserConfigured(userEmail: string): boolean {
  const key = userEmail.split('@')[0].toUpperCase();
  return !!process.env[`TEST_USER_${key}_PASSWORD`];
}

/**
 * Wait for MCP server to be healthy
 */
export async function waitForServer(maxAttempts = 10, delayMs = 2000): Promise<boolean> {
  const client = new MCPTestClient('', TEST_CONFIG.baseUrl);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const healthy = await client.healthCheck();
      if (healthy) {
        console.log(`MCP server healthy at ${TEST_CONFIG.baseUrl}`);
        return true;
      }
    } catch (error) {
      // Ignore connection errors during startup
    }

    if (attempt < maxAttempts) {
      console.log(`Waiting for server... (attempt ${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`MCP server not available at ${TEST_CONFIG.baseUrl}`);
}

/**
 * Global setup for all E2E tests
 */
export function setupE2ETests(testSuite: string): void {
  beforeAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log(`Starting E2E Test Suite: ${testSuite}`);
    console.log('='.repeat(60));

    // Verify environment
    verifyEnvironment();

    // Wait for server
    await waitForServer();

    // Initialize recorder
    initRecorder(testSuite, TEST_CONFIG.baseUrl);

    console.log(`Configured users: ${getConfiguredUsers().length}/${Object.keys(TEST_USERS).length}`);
    console.log('Setup complete.\n');
  });

  afterAll(async () => {
    // Finalize recording
    const recordingPath = finalizeRecorder();
    if (recordingPath) {
      console.log(`Recording saved to: ${recordingPath}`);
    }

    // Cleanup
    if (tokenCache) {
      await tokenCache.cleanup();
      tokenCache = null;
    }

    console.log('E2E tests complete.\n');
  });
}

/**
 * Retry helper for flaky operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; name?: string } = {}
): Promise<T> {
  const { attempts = TEST_CONFIG.retryAttempts, delayMs = TEST_CONFIG.retryDelayMs, name = 'operation' } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < attempts) {
        console.warn(`${name} failed (attempt ${attempt}/${attempts}), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Skip test if user not configured
 */
export function skipIfUserNotConfigured(userEmail: string): void {
  if (!isUserConfigured(userEmail)) {
    console.log(`Skipping test: ${userEmail} not configured`);
  }
}
