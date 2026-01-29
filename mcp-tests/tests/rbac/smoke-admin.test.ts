/**
 * Smoke Test: Admin User (vadim@kansofy.com)
 * Tests one admin user against key tools from each category
 */

import { describe, it, expect } from 'vitest';
import { setupE2ETests, getMCPClientForUser, isUserConfigured } from '../../setup';
import { isAuthorizationDenied } from '../../helpers/mcp-client';
import { getToolTestArgs } from '../../fixtures/tool-matrix';

setupE2ETests('smoke-admin');

const USER = 'vadim@kansofy.com';

describe(`Admin User: ${USER}`, () => {
  const skipTest = !isUserConfigured(USER);

  // Admin should have access to ALL tools (has tool:*)
  const toolsToTest = [
    { name: 'get_tables', expected: 'allowed' },
    { name: 'get_recent_emails', expected: 'allowed' },
    { name: 'get_pipeline_stats', expected: 'allowed' },
    { name: 'get_documents', expected: 'allowed' },
    { name: 'get_daily_summary', expected: 'allowed' },
    { name: 'get_erp_summary', expected: 'allowed' },
    { name: 'execute_sql', expected: 'allowed' },
  ];

  for (const { name, expected } of toolsToTest) {
    it.skipIf(skipTest)(`${name} should be ${expected}`, async () => {
      const client = await getMCPClientForUser(USER);
      const result = await client.callTool(name, getToolTestArgs(name));

      if (expected === 'allowed') {
        if (result.isError) {
          const isAuthError = isAuthorizationDenied(result);
          expect(isAuthError).toBe(false);
        }
      } else {
        expect(result.isError).toBe(true);
        expect(isAuthorizationDenied(result)).toBe(true);
      }
    });
  }
});
