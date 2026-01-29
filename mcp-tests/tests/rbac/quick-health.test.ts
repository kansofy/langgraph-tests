/**
 * Quick Health Check - No OAuth
 * Just verifies the server is responding
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.MCP_BASE_URL || 'https://mcp.dev.kansofy.com';

describe('Server Health', () => {
  it('should respond to health check', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    expect(response.ok).toBe(true);
  });

  it('should have OAuth metadata', async () => {
    const response = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.authorization_endpoint).toBeDefined();
  });
});
