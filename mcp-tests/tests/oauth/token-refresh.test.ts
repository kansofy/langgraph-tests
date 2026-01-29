/**
 * Token Refresh Tests
 *
 * Tests OAuth refresh token functionality
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OAuthTestClient, TokenCache } from '../../helpers/oauth-client';
import { TEST_USERS, getUserPassword, ADMIN_USERS } from '../../fixtures/users';
import { setupE2ETests, isUserConfigured, TEST_CONFIG, withRetry } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('token-refresh');

describe('Token Refresh', () => {
  let oauthClient: OAuthTestClient;

  beforeAll(() => {
    oauthClient = new OAuthTestClient(TEST_CONFIG.baseUrl);
  });

  // Test refresh for each user
  Object.entries(TEST_USERS).forEach(([email, user]) => {
    const skipReason = !isUserConfigured(email) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)(`should refresh token for ${user.name}`, async () => {
      const password = getUserPassword(email);

      // Get initial tokens
      const initialTokens = await withRetry(
        () => oauthClient.authenticateUser(email, password),
        { name: `Initial auth for ${email}` }
      );

      // Skip if no refresh token provided
      if (!initialTokens.refresh_token) {
        console.log(`Skipping refresh test for ${email}: No refresh token provided`);
        return;
      }

      const startTime = Date.now();

      // Refresh the token
      const refreshedTokens = await withRetry(
        () => oauthClient.refreshToken(initialTokens.refresh_token!),
        { name: `Token refresh for ${email}` }
      );

      const duration = Date.now() - startTime;

      // Record the refresh
      const recorder = getRecorder();
      recorder.record({
        tool: 'oauth_refresh',
        user: email,
        userScopes: user.expectedScopes,
        input: { refresh_token: '[REDACTED]' },
        result: {
          isError: false,
          content: [{ type: 'text', text: JSON.stringify({ token_type: refreshedTokens.token_type }) }],
        },
        duration,
        expectedAuthorization: 'allowed',
      });

      // Verify new tokens
      expect(refreshedTokens).toHaveProperty('access_token');
      expect(refreshedTokens.access_token).not.toBe(initialTokens.access_token);
      expect(refreshedTokens.token_type).toBe('Bearer');
    });
  });

  describe('TokenCache', () => {
    it('should cache and reuse valid tokens', async () => {
      const cache = new TokenCache(TEST_CONFIG.baseUrl);
      const testEmail = Object.keys(TEST_USERS).find(isUserConfigured);

      if (!testEmail) {
        console.log('Skipping: No configured users');
        return;
      }

      const password = getUserPassword(testEmail);

      // First call - should authenticate
      const token1 = await cache.getToken(testEmail, password);
      expect(token1).toBeTruthy();

      // Second call - should return cached token
      const token2 = await cache.getToken(testEmail, password);
      expect(token2).toBe(token1);

      await cache.cleanup();
    });

    it('should handle multiple users independently', async () => {
      const cache = new TokenCache(TEST_CONFIG.baseUrl);
      const configuredUsers = Object.keys(TEST_USERS).filter(isUserConfigured);

      if (configuredUsers.length < 2) {
        console.log('Skipping: Need at least 2 configured users');
        return;
      }

      const [user1, user2] = configuredUsers.slice(0, 2);

      const token1 = await cache.getToken(user1, getUserPassword(user1));
      const token2 = await cache.getToken(user2, getUserPassword(user2));

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Each user's token should be cached
      const token1Cached = await cache.getToken(user1, getUserPassword(user1));
      const token2Cached = await cache.getToken(user2, getUserPassword(user2));

      expect(token1Cached).toBe(token1);
      expect(token2Cached).toBe(token2);

      await cache.cleanup();
    });

    it('should clear cache when requested', async () => {
      const cache = new TokenCache(TEST_CONFIG.baseUrl);
      const testEmail = Object.keys(TEST_USERS).find(isUserConfigured);

      if (!testEmail) {
        console.log('Skipping: No configured users');
        return;
      }

      const password = getUserPassword(testEmail);

      // Get initial token
      const token1 = await cache.getToken(testEmail, password);

      // Clear cache
      cache.clear();

      // Get new token - should re-authenticate
      const token2 = await cache.getToken(testEmail, password);

      // New token should be different (fresh auth)
      expect(token2).not.toBe(token1);

      await cache.cleanup();
    });
  });

  describe('Token Expiration', () => {
    it('should correctly detect non-expired tokens', async () => {
      const testEmail = Object.keys(TEST_USERS).find(isUserConfigured);

      if (!testEmail) {
        console.log('Skipping: No configured users');
        return;
      }

      const tokens = await oauthClient.authenticateUser(testEmail, getUserPassword(testEmail));
      const isExpired = oauthClient.isTokenExpired(tokens.access_token);

      expect(isExpired).toBe(false);
    });

    it('should decode token payload correctly', async () => {
      const testEmail = Object.keys(TEST_USERS).find(isUserConfigured);

      if (!testEmail) {
        console.log('Skipping: No configured users');
        return;
      }

      const tokens = await oauthClient.authenticateUser(testEmail, getUserPassword(testEmail));
      const payload = oauthClient.decodeToken(tokens.access_token);

      // Standard JWT claims
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iat');
      expect(typeof payload.exp).toBe('number');
      expect(typeof payload.iat).toBe('number');

      // Expiration should be in the future
      const now = Math.floor(Date.now() / 1000);
      expect(payload.exp as number).toBeGreaterThan(now);
    });
  });

  describe('Error Cases', () => {
    it('should fail to refresh with invalid refresh token', async () => {
      await expect(oauthClient.refreshToken('invalid-refresh-token')).rejects.toThrow();
    });

    it('should fail to decode malformed JWT', () => {
      expect(() => oauthClient.decodeToken('not.a.valid.jwt')).toThrow('Invalid JWT format');
      expect(() => oauthClient.decodeToken('onlyonepart')).toThrow('Invalid JWT format');
    });
  });
});
