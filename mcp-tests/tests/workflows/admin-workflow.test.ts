/**
 * Admin Workflow Tests
 *
 * Simulates an administrator's oversight workflow using full MCP tool access
 *
 * NOTE: Based on 2026-01-23 E2E testing, admin (lz@) has access to:
 * - Email tools ✓
 * - Analytics tools ✓
 * - ERP tools ✓
 * - Power tools (execute_sql) ✓
 *
 * Admin is DENIED:
 * - Schema tools (get_tables, etc.) - server config issue
 * - Pipeline tools (get_pipeline_stats, etc.) - server config issue
 * - Document tools (get_documents, etc.) - server config issue
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse, isAuthorizationDenied } from '../../helpers/mcp-client';
import { TEST_USERS, ADMIN_USERS } from '../../fixtures/users';
import { EXPECTED_DATA } from '../../fixtures/expected-data';
import { setupE2ETests, getMCPClientForUser, isUserConfigured } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('admin-workflow');

describe('Admin Daily Oversight Workflow', () => {
  const adminEmail = 'lz@zueggcom.it';
  const admin = TEST_USERS[adminEmail];
  const skipReason = !isUserConfigured(adminEmail) ? 'Password not configured' : null;

  let client: MCPTestClient;

  beforeAll(async () => {
    if (!skipReason) {
      client = await getMCPClientForUser(adminEmail);
    }
  });

  describe('Email Monitoring', () => {
    it.skipIf(!!skipReason)('Step 1: Check all recent emails across all mailboxes', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_recent_emails', { hours: 24, limit: 100 });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const data = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result);

      // Admin should see emails from multiple mailboxes
      const mailboxes = new Set(data!.emails.map((e) => e.mailbox));

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_recent_emails',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: { hours: 24, limit: 100 },
        result,
        duration,
        dataValidation: recorder.createDataValidation([
          { name: 'multiple_mailboxes', expected: { min: 3, max: 11 }, actual: mailboxes.size },
        ]),
      });

      console.log(`  Seeing emails from ${mailboxes.size} mailboxes`);
    });

    it.skipIf(!!skipReason)('Step 2: Search emails across all mailboxes', async () => {
      const startTime = Date.now();
      const result = await client.callTool('search_emails', {
        query: 'order',
        field: 'subject',
        limit: 20,
      });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'search_emails',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: { query: 'order', field: 'subject', limit: 20 },
        result,
        duration,
      });
    });
  });

  describe('Analytics Dashboard', () => {
    it.skipIf(!!skipReason)('Step 3: Get daily email summary/analytics', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_daily_summary', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_daily_summary',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: {},
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 4: Check volume trends', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_volume_trends', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_volume_trends',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: {},
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 5: Check cascade metrics', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_cascade_metrics', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_cascade_metrics',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: {},
        result,
        duration,
      });
    });
  });

  describe('ERP Oversight', () => {
    it.skipIf(!!skipReason)('Step 6: Get ERP summary', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_erp_summary', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_erp_summary',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: {},
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 7: Check orders by customer', async () => {
      // Replaced get_customer_concentration with get_orders_by_customer (tool removed)
      const startTime = Date.now();
      const result = await client.callTool('get_orders_by_customer', { customer_name: 'test' });
      const duration = Date.now() - startTime;

      // This may return empty results for 'test' but should not error
      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_orders_by_customer',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: { customer_name: 'test' },
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 8: Check late deliveries', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_late_deliveries', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_late_deliveries',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: {},
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 9: Check recent orders', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_last_weeks_orders', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_last_weeks_orders',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: {},
        result,
        duration,
      });
    });
  });

  describe('Power Tools', () => {
    it.skipIf(!!skipReason)('Step 10: Run diagnostic SQL query', async () => {
      const startTime = Date.now();
      const result = await client.callTool('execute_sql', {
        query: `SELECT processing_status, COUNT(*) as count
                FROM raw_emails_v6
                GROUP BY processing_status
                ORDER BY count DESC`,
      });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'execute_sql',
        user: adminEmail,
        userScopes: admin.expectedScopes,
        input: { query: 'SELECT processing_status, COUNT(*)...' },
        result,
        duration,
      });
    });
  });

  describe('Known Restricted Tools (Currently Denied)', () => {
    // These tests document tools that SHOULD be available to admin but are currently denied
    // This serves as a regression test - if server is fixed, these tests will need updating

    it.skipIf(!!skipReason)('Schema tools are currently denied (server issue)', async () => {
      const result = await client.callTool('get_tables', {});
      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('Pipeline tools are currently denied (server issue)', async () => {
      const result = await client.callTool('get_pipeline_stats', {});
      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('Document tools are currently denied (server issue)', async () => {
      const result = await client.callTool('get_documents', { limit: 5 });
      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });
  });
});

describe('Admin vs Team Access Comparison', () => {
  const adminEmail = 'lz@zueggcom.it';
  const teamEmail = 'fh@zueggcom.it';

  const skipAdmin = !isUserConfigured(adminEmail);
  const skipTeam = !isUserConfigured(teamEmail);

  it.skipIf(skipAdmin || skipTeam)('admin and team lead should have same tool access', async () => {
    // NOTE: Based on testing, lz@ and fh@ have identical tool access
    // This is documented behavior, not necessarily intended

    const adminClient = await getMCPClientForUser(adminEmail);
    const teamClient = await getMCPClientForUser(teamEmail);

    // Both should have ERP access
    const adminErp = await adminClient.callTool('get_erp_summary', {});
    const teamErp = await teamClient.callTool('get_erp_summary', {});

    expect(adminErp.isError).toBe(false);
    expect(teamErp.isError).toBe(false);

    // Both should have execute_sql access
    const adminSql = await adminClient.callTool('execute_sql', { query: 'SELECT 1' });
    const teamSql = await teamClient.callTool('execute_sql', { query: 'SELECT 1' });

    expect(adminSql.isError).toBe(false);
    expect(teamSql.isError).toBe(false);

    console.log('  Both admin and team lead have equivalent tool access');
  });
});
