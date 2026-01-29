/**
 * Direct API Test - Uses Service Token (no browser OAuth)
 * Quick verification that scopes are working
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Service token is for production, so use production URL
const BASE_URL = 'https://mcp.kansofy.com';
const SERVICE_TOKEN = process.env.MCP_KANSOFY_SERVICE_TOKEN;

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function callMCPTool(token: string, toolName: string, args: Record<string, unknown> = {}): Promise<MCPResponse> {
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  return response.json();
}

async function listTools(token: string): Promise<MCPResponse> {
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
    }),
  });

  return response.json();
}

describe('Direct API with Service Token', () => {
  beforeAll(() => {
    if (!SERVICE_TOKEN) {
      console.warn('MCP_KANSOFY_SERVICE_TOKEN not set - skipping direct API tests');
    }
  });

  const skipIfNoToken = !SERVICE_TOKEN;

  it.skipIf(skipIfNoToken)('should list tools (admin sees all)', async () => {
    const result = await listTools(SERVICE_TOKEN!);
    expect(result.error).toBeUndefined();

    const tools = (result.result as { tools: Array<{ name: string }> }).tools;
    console.log(`Service token sees ${tools.length} tools`);

    // Admin with tool:* should see all tools
    expect(tools.length).toBeGreaterThan(20);
  });

  it.skipIf(skipIfNoToken)('should allow execute_sql (admin has tool:*)', async () => {
    const result = await callMCPTool(SERVICE_TOKEN!, 'execute_sql', { query: 'SELECT 1 as test' });

    // Should NOT be an authorization error
    if (result.error) {
      expect(result.error.message).not.toContain('not authorized');
      expect(result.error.message).not.toContain('Access denied');
    }
  });

  it.skipIf(skipIfNoToken)('should allow get_tables (admin has tool:*)', async () => {
    const result = await callMCPTool(SERVICE_TOKEN!, 'get_tables', {});

    if (result.error) {
      expect(result.error.message).not.toContain('not authorized');
      expect(result.error.message).not.toContain('Access denied');
    }
  });

  it.skipIf(skipIfNoToken)('should allow get_recent_emails', async () => {
    const result = await callMCPTool(SERVICE_TOKEN!, 'get_recent_emails', { hours: 24, limit: 5 });

    if (result.error) {
      expect(result.error.message).not.toContain('not authorized');
      expect(result.error.message).not.toContain('Access denied');
    }
  });
});
