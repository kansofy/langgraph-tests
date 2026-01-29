/**
 * Smoke Test: Customer User (sp@zueggcom.it)
 * Tests one customer user - has tool:email, tool:document, tool:erp-orders
 */

import { describe, it, expect } from 'vitest';
import { setupE2ETests, getMCPClientForUser, isUserConfigured } from '../../setup';
import { isAuthorizationDenied } from '../../helpers/mcp-client';
import { getToolTestArgs } from '../../fixtures/tool-matrix';

setupE2ETests('smoke-customer');

const USER = 'sp@zueggcom.it';

describe(`Customer User: ${USER}`, () => {
  const skipTest = !isUserConfigured(USER);

  const toolsToTest = [
    // Should be ALLOWED (has tool:email, tool:document, tool:erp-orders)
    { name: 'get_recent_emails', expected: 'allowed' },
    { name: 'get_documents', expected: 'allowed' },
    { name: 'get_last_weeks_orders', expected: 'allowed' },

    // Should be DENIED (no tool:power, tool:erp, tool:schema, tool:pipeline, tool:analytics)
    { name: 'execute_sql', expected: 'denied' },
    { name: 'get_erp_summary', expected: 'denied' },
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
