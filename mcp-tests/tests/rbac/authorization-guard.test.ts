/**
 * Authorization Guard Tests - SEC-001 Fix Verification
 *
 * Comprehensive E2E tests verifying that the RBAC authorization
 * is correctly enforced for all user types and tool categories.
 *
 * These tests verify:
 * 1. Admin users can access all tools
 * 2. Team leads have appropriate elevated access
 * 3. Sales reps only access ERP orders (not full ERP)
 * 4. Viewers are denied administrative tools
 * 5. Error messages are helpful and secure
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse, isAuthorizationDenied } from '../../helpers/mcp-client';
import { TEST_USERS, ADMIN_USERS, SALES_REPS, NON_ERP_USERS } from '../../fixtures/users';
import { setupE2ETests, getMCPClientForUser, isUserConfigured } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('authorization-guard');

// Cache MCP clients per user for performance
const clientCache: Map<string, MCPTestClient> = new Map();

async function getClient(userEmail: string): Promise<MCPTestClient> {
  if (!clientCache.has(userEmail)) {
    const client = await getMCPClientForUser(userEmail);
    clientCache.set(userEmail, client);
  }
  return clientCache.get(userEmail)!;
}

describe('Authorization Guard - SEC-001 Fix Verification', () => {

  describe('Admin Access (lz@)', () => {
    const adminEmail = 'lz@zueggcom.it';
    const skipReason = !isUserConfigured(adminEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should access schema tools (tool:*)', async () => {
      const client = await getClient(adminEmail);
      const result = await client.callTool('get_tables', {});

      expect(result.isError).toBe(false);

      // Record success
      const recorder = getRecorder();
      recorder.record({
        tool: 'get_tables',
        user: adminEmail,
        userScopes: TEST_USERS[adminEmail].expectedScopes,
        input: {},
        result,
        duration: 0,
        expectedAuthorization: 'allowed',
      });
    });

    it.skipIf(!!skipReason)('should access pipeline tools (tool:*)', async () => {
      const client = await getClient(adminEmail);
      const result = await client.callTool('get_pipeline_stats', {});

      expect(result.isError).toBe(false);
    });

    it.skipIf(!!skipReason)('should access power tools (tool:*)', async () => {
      const client = await getClient(adminEmail);
      const result = await client.callTool('execute_sql', { query: 'SELECT 1 as test' });

      expect(result.isError).toBe(false);
      const data = parseToolResponse<{ rows: { test: number }[] }>(result);
      expect(data?.rows[0]?.test).toBe(1);
    });

    it.skipIf(!!skipReason)('should access all ERP tools', async () => {
      const client = await getClient(adminEmail);

      // Removed get_customer_concentration (tool no longer exists)
      const tools = [
        { name: 'get_erp_summary', args: {} },
        { name: 'get_late_deliveries', args: {} },
        { name: 'get_last_weeks_orders', args: {} },
        { name: 'get_orders_by_customer', args: { customer_name: 'test' } },
      ];

      for (const tool of tools) {
        const result = await client.callTool(tool.name, tool.args);
        expect(result.isError).toBe(false);
      }
    });
  });

  describe('Team Lead Access (fh@)', () => {
    const teamLeadEmail = 'fh@zueggcom.it';
    const skipReason = !isUserConfigured(teamLeadEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should be DENIED schema tools', async () => {
      const client = await getClient(teamLeadEmail);
      const result = await client.callTool('get_tables', {});

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('should be DENIED power tools (execute_sql)', async () => {
      const client = await getClient(teamLeadEmail);
      const result = await client.callTool('execute_sql', { query: 'SELECT 1' });

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('should be DENIED pipeline tools', async () => {
      const client = await getClient(teamLeadEmail);
      const result = await client.callTool('get_pipeline_stats', {});

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('should access ERP tools (tool:erp)', async () => {
      const client = await getClient(teamLeadEmail);

      const result = await client.callTool('get_erp_summary', {});
      expect(result.isError).toBe(false);

      // Removed get_customer_concentration (tool no longer exists)
      const lateResult = await client.callTool('get_late_deliveries', {});
      expect(lateResult.isError).toBe(false);
    });

    it.skipIf(!!skipReason)('should access email tools', async () => {
      const client = await getClient(teamLeadEmail);
      const result = await client.callTool('get_recent_emails', { hours: 24, limit: 5 });

      expect(result.isError).toBe(false);
    });

    it.skipIf(!!skipReason)('should access document tools (tool:document)', async () => {
      const client = await getClient(teamLeadEmail);
      const result = await client.callTool('get_documents', { limit: 5 });

      expect(result.isError).toBe(false);
    });
  });

  describe('Sales Rep Access (sr@, pa@, cz@, pb@)', () => {
    const salesReps = ['sr@zueggcom.it', 'pa@zueggcom.it', 'cz@zueggcom.it', 'pb@zueggcom.it'];

    salesReps.forEach(email => {
      const user = TEST_USERS[email];
      const skipReason = !isUserConfigured(email) ? 'Password not configured' : null;

      describe(`${user?.name || email}`, () => {
        it.skipIf(!!skipReason)('should access ERP orders (tool:erp-orders)', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_last_weeks_orders', {});

          expect(result.isError).toBe(false);
        });

        it.skipIf(!!skipReason)('should access monthly orders', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_last_months_orders', {});

          expect(result.isError).toBe(false);
        });

        it.skipIf(!!skipReason)('should be DENIED full ERP tools', async () => {
          const client = await getClient(email);

          // Removed get_customer_concentration (tool no longer exists)
          const summaryResult = await client.callTool('get_erp_summary', {});
          expect(summaryResult.isError).toBe(true);
          expect(isAuthorizationDenied(summaryResult)).toBe(true);

          // get_late_deliveries requires tool:erp (not available to sales reps)
          const lateResult = await client.callTool('get_late_deliveries', {});
          expect(lateResult.isError).toBe(true);
          expect(isAuthorizationDenied(lateResult)).toBe(true);
        });

        it.skipIf(!!skipReason)('should be DENIED schema tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_tables', {});

          expect(result.isError).toBe(true);
          expect(isAuthorizationDenied(result)).toBe(true);
        });

        it.skipIf(!!skipReason)('should be DENIED power tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('execute_sql', { query: 'SELECT 1' });

          expect(result.isError).toBe(true);
          expect(isAuthorizationDenied(result)).toBe(true);
        });

        it.skipIf(!!skipReason)('should access email tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_recent_emails', { hours: 24, limit: 5 });

          expect(result.isError).toBe(false);
        });
      });
    });
  });

  describe('Viewer Access (lg@, jz@)', () => {
    const viewers = ['lg@zueggcom.it', 'jz@zueggcom.it'];

    viewers.forEach(email => {
      const user = TEST_USERS[email];
      const skipReason = !isUserConfigured(email) ? 'Password not configured' : null;

      describe(`${user?.name || email}`, () => {
        it.skipIf(!!skipReason)('should access document tools (tool:document)', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_documents', { limit: 5 });

          expect(result.isError).toBe(false);
        });

        it.skipIf(!!skipReason)('should access email tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_recent_emails', { hours: 24, limit: 5 });

          expect(result.isError).toBe(false);
        });

        it.skipIf(!!skipReason)('should be DENIED all ERP tools', async () => {
          const client = await getClient(email);

          const ordersResult = await client.callTool('get_last_weeks_orders', {});
          expect(ordersResult.isError).toBe(true);
          expect(isAuthorizationDenied(ordersResult)).toBe(true);

          // Removed get_customer_concentration (tool no longer exists)
          const summaryResult = await client.callTool('get_erp_summary', {});
          expect(summaryResult.isError).toBe(true);
          expect(isAuthorizationDenied(summaryResult)).toBe(true);

          const lateResult = await client.callTool('get_late_deliveries', {});
          expect(lateResult.isError).toBe(true);
          expect(isAuthorizationDenied(lateResult)).toBe(true);
        });

        it.skipIf(!!skipReason)('should be DENIED schema tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_tables', {});

          expect(result.isError).toBe(true);
          expect(isAuthorizationDenied(result)).toBe(true);
        });

        it.skipIf(!!skipReason)('should be DENIED power tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('execute_sql', { query: 'SELECT 1' });

          expect(result.isError).toBe(true);
          expect(isAuthorizationDenied(result)).toBe(true);
        });

        it.skipIf(!!skipReason)('should be DENIED pipeline tools', async () => {
          const client = await getClient(email);
          const result = await client.callTool('get_pipeline_stats', {});

          expect(result.isError).toBe(true);
          expect(isAuthorizationDenied(result)).toBe(true);
        });
      });
    });
  });

  describe('Error Message Quality', () => {
    const viewerEmail = 'lg@zueggcom.it';
    const skipReason = !isUserConfigured(viewerEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should include required scope in denial message', async () => {
      const client = await getClient(viewerEmail);
      const result = await client.callTool('execute_sql', { query: 'SELECT 1' });

      expect(result.isError).toBe(true);
      const errorText = result.content[0]?.text?.toLowerCase() || '';
      // Error should mention the scope needed
      expect(
        errorText.includes('tool:power') || errorText.includes('requires scope')
      ).toBe(true);
    });

    it.skipIf(!!skipReason)('should NOT leak internal details in error', async () => {
      const client = await getClient(viewerEmail);
      const result = await client.callTool('execute_sql', { query: 'SELECT 1' });

      const errorText = result.content[0]?.text || '';
      // Should not contain stack traces or internal info
      expect(errorText).not.toContain('stack');
      expect(errorText).not.toContain('at Object.');
      expect(errorText).not.toContain('node_modules');
      expect(errorText).not.toContain('pool');
    });

    it.skipIf(!!skipReason)('should provide actionable error for ERP denial', async () => {
      const client = await getClient(viewerEmail);
      // Use get_erp_summary instead of get_customer_concentration (removed)
      const result = await client.callTool('get_erp_summary', {});

      expect(result.isError).toBe(true);
      const errorText = result.content[0]?.text || '';
      // Should indicate what scope is needed
      expect(errorText.toLowerCase()).toContain('tool:erp');
    });
  });

  describe('Analytics Tools (All Users)', () => {
    const allUsers = Object.keys(TEST_USERS);

    allUsers.forEach(email => {
      const user = TEST_USERS[email];
      const skipReason = !isUserConfigured(email) ? 'Password not configured' : null;

      it.skipIf(!!skipReason)(`${user?.name || email} should access analytics tools`, async () => {
        const client = await getClient(email);

        const summaryResult = await client.callTool('get_daily_summary', {});
        expect(summaryResult.isError).toBe(false);

        const trendsResult = await client.callTool('get_volume_trends', {});
        expect(trendsResult.isError).toBe(false);

        const metricsResult = await client.callTool('get_cascade_metrics', {});
        expect(metricsResult.isError).toBe(false);
      });
    });
  });

  describe('Authorization Consistency', () => {
    const adminEmail = 'lz@zueggcom.it';
    const viewerEmail = 'lg@zueggcom.it';
    const skipAdmin = !isUserConfigured(adminEmail) ? 'Admin not configured' : null;
    const skipViewer = !isUserConfigured(viewerEmail) ? 'Viewer not configured' : null;

    it.skipIf(!!skipAdmin || !!skipViewer)('should consistently enforce authorization across multiple requests', async () => {
      const adminClient = await getClient(adminEmail);
      const viewerClient = await getClient(viewerEmail);

      // Make multiple requests to verify consistency
      for (let i = 0; i < 3; i++) {
        // Admin should always succeed
        const adminResult = await adminClient.callTool('get_tables', {});
        expect(adminResult.isError).toBe(false);

        // Viewer should always be denied
        const viewerResult = await viewerClient.callTool('get_tables', {});
        expect(viewerResult.isError).toBe(true);
        expect(isAuthorizationDenied(viewerResult)).toBe(true);
      }
    });

    it.skipIf(!!skipAdmin || !!skipViewer)('should not allow escalation through repeated requests', async () => {
      const viewerClient = await getClient(viewerEmail);

      // Make many requests - none should succeed
      const tools = ['get_tables', 'execute_sql', 'get_pipeline_stats'];

      for (const tool of tools) {
        for (let i = 0; i < 3; i++) {
          const result = await viewerClient.callTool(tool, tool === 'execute_sql' ? { query: 'SELECT 1' } : {});
          expect(result.isError).toBe(true);
          expect(isAuthorizationDenied(result)).toBe(true);
        }
      }
    });
  });
});
