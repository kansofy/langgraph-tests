/**
 * Smoke Test: Power User (lz@zueggcom.it)
 * Tests one power user against key tools - should have tool:power, tool:erp
 */

import { describe, it, expect } from 'vitest';
import { setupE2ETests, getMCPClientForUser, isUserConfigured } from '../../setup';
import { isAuthorizationDenied } from '../../helpers/mcp-client';
import { getToolTestArgs } from '../../fixtures/tool-matrix';

setupE2ETests('smoke-power');

const USER = 'lz@zueggcom.it';

describe(`Power User: ${USER}`, () => {
  const skipTest = !isUserConfigured(USER);

  const toolsToTest = [
    // Should be ALLOWED (has tool:power, tool:erp, tool:email, tool:document)
    { name: 'execute_sql', expected: 'allowed' },
    { name: 'get_erp_summary', expected: 'allowed' },
    { name: 'get_late_deliveries', expected: 'allowed' },
    { name: 'get_recent_emails', expected: 'allowed' },
    { name: 'get_documents', expected: 'allowed' },
    { name: 'get_last_weeks_orders', expected: 'allowed' },

    // Should be DENIED (admin-only: schema, pipeline, analytics)
    { name: 'get_tables', expected: 'denied' },
    { name: 'get_pipeline_stats', expected: 'denied' },
    { name: 'get_daily_summary', expected: 'denied' },
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
