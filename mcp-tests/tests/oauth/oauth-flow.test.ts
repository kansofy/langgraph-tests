/**
 * OAuth 2.1 PKCE Flow Tests
 *
 * Tests complete OAuth authentication for all configured users
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OAuthTestClient } from '../../helpers/oauth-client';
import { TEST_USERS, getUserPassword } from '../../fixtures/users';
import { setupE2ETests, isUserConfigured, TEST_CONFIG, withRetry } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('oauth-flow');

describe('OAuth 2.1 PKCE Flow', () => {
  let oauthClient: OAuthTestClient;

  beforeAll(() => {
    oauthClient = new OAuthTestClient(TEST_CONFIG.baseUrl);
  });

  // Test each user
  Object.entries(TEST_USERS).forEach(([email, user]) => {
    describe(`User: ${user.name} (${email})`, () => {
      const skipReason = !isUserConfigured(email) ? 'Password not configured' : null;

      it.skipIf(!!skipReason)('should complete full PKCE authentication flow', async () => {
        const password = getUserPassword(email);
        const startTime = Date.now();

        const tokens = await withRetry(
          () => oauthClient.authenticateUser(email, password),
          { name: `OAuth flow for ${email}` }
        );

        const duration = Date.now() - startTime;

        // Record the authentication
        const recorder = getRecorder();
        recorder.record({
          tool: 'oauth_authenticate',
          user: email,
          userScopes: user.expectedScopes,
          input: { email, scope: 'openid email profile mcp:read mcp:write' },
          result: {
            isError: false,
            content: [{ type: 'text', text: JSON.stringify({ token_type: tokens.token_type }) }],
          },
          duration,
          expectedAuthorization: 'allowed',
        });

        // Verify token structure
        expect(tokens).toHaveProperty('access_token');
        expect(tokens).toHaveProperty('token_type', 'Bearer');
        expect(tokens).toHaveProperty('expires_in');
        expect(tokens.expires_in).toBeGreaterThan(0);
      });

      it.skipIf(!!skipReason)('should receive JWT with correct structure', async () => {
        const password = getUserPassword(email);
        const tokens = await oauthClient.authenticateUser(email, password);

        // Decode and verify JWT structure
        const payload = oauthClient.decodeToken(tokens.access_token);

        expect(payload).toHaveProperty('sub'); // Subject (user ID)
        expect(payload).toHaveProperty('iss'); // Issuer
        expect(payload).toHaveProperty('aud'); // Audience
        expect(payload).toHaveProperty('exp'); // Expiration
        expect(payload).toHaveProperty('iat'); // Issued at
      });

      it.skipIf(!!skipReason)('should have user email in token claims', async () => {
        const password = getUserPassword(email);
        const tokens = await oauthClient.authenticateUser(email, password);
        const payload = oauthClient.decodeToken(tokens.access_token);

        // Email should be in token
        expect(payload.email || payload.sub).toContain(email.split('@')[0]);
      });

      it.skipIf(!!skipReason)('should not be expired immediately', async () => {
        const password = getUserPassword(email);
        const tokens = await oauthClient.authenticateUser(email, password);

        const isExpired = oauthClient.isTokenExpired(tokens.access_token);
        expect(isExpired).toBe(false);
      });
    });
  });

  describe('PKCE Security', () => {
    it('should generate unique verifier/challenge pairs', () => {
      const pkce1 = oauthClient.generatePKCE();
      const pkce2 = oauthClient.generatePKCE();

      expect(pkce1.verifier).not.toBe(pkce2.verifier);
      expect(pkce1.challenge).not.toBe(pkce2.challenge);
    });

    it('should generate valid challenge format', () => {
      const pkce = oauthClient.generatePKCE();

      // Verifier should be base64url (43 chars from 32 bytes)
      expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);

      // Challenge should be base64url SHA-256 hash
      expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.method).toBe('S256');
    });

    it('should generate unique state parameters', () => {
      const state1 = oauthClient.generateState();
      const state2 = oauthClient.generateState();

      expect(state1).not.toBe(state2);
      expect(state1).toHaveLength(32); // 16 bytes hex = 32 chars
    });
  });

  describe('Error Handling', () => {
    it('should fail with invalid credentials', async () => {
      await expect(
        oauthClient.authenticateUser('invalid@zueggcom.it', 'wrongpassword')
      ).rejects.toThrow();
    });

    it('should fail with wrong password', async () => {
      const validEmail = Object.keys(TEST_USERS).find(isUserConfigured);
      if (!validEmail) {
        console.log('Skipping: No configured users');
        return;
      }

      await expect(
        oauthClient.authenticateUser(validEmail, 'definitely-wrong-password')
      ).rejects.toThrow();
    });
  });
});
