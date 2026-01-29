/**
 * OAuth 2.1 PKCE Client for E2E Testing
 *
 * Handles the full OAuth flow including:
 * - PKCE challenge generation
 * - Dynamic client registration
 * - Authorization code flow (with Playwright for login)
 * - Token exchange
 * - Token refresh
 * - Token file persistence (to avoid repeated browser logins)
 */

import { createHash, randomBytes } from 'crypto';
import { chromium, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface PKCEChallenge {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface ClientRegistration {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OAuthTestClient {
  private baseUrl: string;
  private browser: Browser | null = null;
  private registeredClient: ClientRegistration | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.MCP_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Generate PKCE challenge pair (RFC 7636)
   */
  generatePKCE(): PKCEChallenge {
    // Generate 32 random bytes -> 43 base64url characters
    const verifier = randomBytes(32).toString('base64url');
    // SHA-256 hash -> base64url encoding
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge, method: 'S256' };
  }

  /**
   * Generate random state parameter for CSRF protection
   */
  generateState(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Register a dynamic OAuth client
   */
  async registerClient(): Promise<ClientRegistration> {
    const redirectUri = `${this.baseUrl}/callback`;

    const response = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        client_name: `E2E Test Client ${Date.now()}`,
        token_endpoint_auth_method: 'none', // Public client (PKCE)
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Client registration failed: ${error}`);
    }

    this.registeredClient = await response.json();
    return this.registeredClient!;
  }

  /**
   * Execute full OAuth PKCE flow with Playwright
   * Includes retry logic for transient browser errors
   */
  async authenticateUser(
    email: string,
    password: string,
    scope: string = 'openid email profile mcp:read mcp:write'
  ): Promise<TokenResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this._doAuthenticate(email, password, scope);
      } catch (error) {
        lastError = error as Error;
        const isRetryable =
          lastError.message.includes('Protocol error') ||
          lastError.message.includes('Target closed') ||
          lastError.message.includes('Navigation failed') ||
          lastError.message.includes('net::ERR');

        if (isRetryable && attempt < MAX_RETRIES) {
          console.log(`  OAuth attempt ${attempt} failed (${lastError.message}), retrying...`);
          await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  /**
   * Internal authentication implementation
   */
  private async _doAuthenticate(
    email: string,
    password: string,
    scope: string
  ): Promise<TokenResponse> {
    const pkce = this.generatePKCE();
    const state = this.generateState();
    const redirectUri = `${this.baseUrl}/callback`;

    // Register client if needed
    if (!this.registeredClient) {
      await this.registerClient();
    }

    // Build authorization URL
    const authUrl = new URL(`${this.baseUrl}/authorize`);
    authUrl.searchParams.set('client_id', this.registeredClient!.client_id);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', pkce.challenge);
    authUrl.searchParams.set('code_challenge_method', pkce.method);

    // Launch browser with stability settings
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Set reasonable timeouts
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(20000);

    try {
      // Navigate to authorization endpoint
      await page.goto(authUrl.toString(), { waitUntil: 'networkidle' });

      // Wait for login form to load
      await page.waitForSelector('#email', { timeout: 10000 });

      // Fill login form
      await page.fill('#email', email);
      await page.fill('#password', password);

      // Set up response listener BEFORE clicking
      let authCode: string | null = null;
      let returnedState: string | null = null;

      // Listen for the redirect URL in multiple ways
      const codePromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for auth code'));
        }, 15000);

        // Method 1: Listen for /api/login response
        page.on('response', async (response) => {
          try {
            if (response.url().includes('/api/login') && response.status() === 200) {
              // Safely try to get response body
              let loginData: { redirect_url?: string };
              try {
                loginData = await response.json();
              } catch {
                // Response body not available, try text
                try {
                  const text = await response.text();
                  loginData = JSON.parse(text);
                } catch {
                  return; // Can't read response, wait for other methods
                }
              }

              if (loginData.redirect_url) {
                const redirectUrl = new URL(loginData.redirect_url);
                const code = redirectUrl.searchParams.get('code');
                const st = redirectUrl.searchParams.get('state');
                if (code && st) {
                  clearTimeout(timeout);
                  resolve({ code, state: st });
                }
              }
            }
          } catch {
            // Ignore errors reading response
          }
        });

        // Method 2: Watch for URL changes (callback redirect)
        page.on('framenavigated', async (frame) => {
          try {
            if (frame === page.mainFrame()) {
              const url = frame.url();
              if (url.includes('/callback') && url.includes('code=')) {
                const parsedUrl = new URL(url);
                const code = parsedUrl.searchParams.get('code');
                const st = parsedUrl.searchParams.get('state');
                if (code && st) {
                  clearTimeout(timeout);
                  resolve({ code, state: st });
                }
              }
            }
          } catch {
            // Ignore errors
          }
        });
      });

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for auth code from either method
      const result = await codePromise;
      authCode = result.code;
      returnedState = result.state;

      // Verify state matches (CSRF protection)
      if (returnedState !== state) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      if (!authCode) {
        throw new Error('No authorization code received');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          code_verifier: pkce.verifier,
          client_id: this.registeredClient!.client_id,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
      }

      return tokenResponse.json();
    } finally {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.registeredClient?.client_id || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    return response.json();
  }

  /**
   * Decode JWT payload (without verification - for test inspection)
   */
  decodeToken(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    const exp = payload.exp as number;
    return Date.now() >= exp * 1000;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Token cache entry
 */
interface CachedToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  clientId: string;
}

/**
 * Token cache for reusing tokens across tests
 * Persists to file to survive test restarts
 */
export class TokenCache {
  private tokens: Map<string, CachedToken> = new Map();
  private oauthClient: OAuthTestClient;
  private cacheFile: string;

  constructor(baseUrl?: string) {
    this.oauthClient = new OAuthTestClient(baseUrl);
    // Store cache file in project directory
    this.cacheFile = path.join(process.cwd(), '.token-cache.json');
    this.loadFromFile();
  }

  /**
   * Load cached tokens from file
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        for (const [email, token] of Object.entries(data)) {
          this.tokens.set(email, token as CachedToken);
        }
      }
    } catch {
      // Ignore file read errors
    }
  }

  /**
   * Save cached tokens to file
   */
  private saveToFile(): void {
    try {
      const data: Record<string, CachedToken> = {};
      for (const [email, token] of this.tokens.entries()) {
        data[email] = token;
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch {
      // Ignore file write errors
    }
  }

  /**
   * Get token for user, refreshing or re-authenticating if needed
   */
  async getToken(email: string, password: string): Promise<string> {
    const cached = this.tokens.get(email);

    // Return cached token if still valid (with 60s buffer)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    // Try to refresh if we have a refresh token
    if (cached?.refreshToken) {
      try {
        // Need to set up client registration for refresh
        if (cached.clientId) {
          (this.oauthClient as any).registeredClient = {
            client_id: cached.clientId,
            redirect_uris: [],
          };
        }
        const newTokens = await this.oauthClient.refreshToken(cached.refreshToken);
        const newCached: CachedToken = {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          expiresAt: Date.now() + newTokens.expires_in * 1000,
          clientId: cached.clientId,
        };
        this.tokens.set(email, newCached);
        this.saveToFile();
        return newTokens.access_token;
      } catch {
        // Refresh failed, do full auth
      }
    }

    // Full authentication
    const tokens = await this.oauthClient.authenticateUser(email, password);
    const clientId = (this.oauthClient as any).registeredClient?.client_id || '';
    const newCached: CachedToken = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      clientId,
    };
    this.tokens.set(email, newCached);
    this.saveToFile();

    return tokens.access_token;
  }

  /**
   * Clear cached tokens (both memory and file)
   */
  clear(): void {
    this.tokens.clear();
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch {
      // Ignore
    }
  }

  async cleanup(): Promise<void> {
    await this.oauthClient.cleanup();
  }
}
