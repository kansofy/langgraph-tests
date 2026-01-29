/**
 * Sales Representative Workflow Tests
 *
 * Simulates a typical sales rep's daily workflow using MCP tools
 * Tests realistic sequences of tool calls
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse } from '../../helpers/mcp-client';
import { TEST_USERS, getUserPassword, SALES_REPS } from '../../fixtures/users';
import { setupE2ETests, getMCPClientForUser, isUserConfigured, TEST_CONFIG } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('sales-workflow');

describe('Sales Rep Daily Workflow', () => {
  // Test with sr@zueggcom.it as representative sales rep
  const salesRepEmail = 'sr@zueggcom.it';
  const salesRep = TEST_USERS[salesRepEmail];
  const skipReason = !isUserConfigured(salesRepEmail) ? 'Password not configured' : null;

  let client: MCPTestClient;

  beforeAll(async () => {
    if (!skipReason) {
      client = await getMCPClientForUser(salesRepEmail);
    }
  });

  describe('Morning Email Check', () => {
    it.skipIf(!!skipReason)('Step 1: Check recent emails (last 24 hours)', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_recent_emails', { hours: 24, limit: 20 });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const data = parseToolResponse<{ emails: Array<{ id: string; subject: string }> }>(result);
      expect(data).not.toBeNull();

      // Record the workflow step
      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_recent_emails',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: { hours: 24, limit: 20 },
        result,
        duration,
        dataValidation: recorder.createDataValidation([
          { name: 'has_emails', expected: true, actual: data!.emails.length > 0 },
        ]),
      });

      console.log(`  Found ${data!.emails.length} recent emails`);
    });

    it.skipIf(!!skipReason)('Step 2: Search for order-related emails', async () => {
      const startTime = Date.now();
      const result = await client.callTool('search_emails', {
        query: 'order',
        field: 'subject',
        limit: 10,
      });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'search_emails',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: { query: 'order', field: 'subject', limit: 10 },
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 3: Check emails from specific sender', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_emails_by_sender', {
        sender_email: 'aromatech.fr',
        limit: 5,
      });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_emails_by_sender',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: { sender_email: 'aromatech.fr', limit: 5 },
        result,
        duration,
      });
    });
  });

  describe('Order Management', () => {
    it.skipIf(!!skipReason)("Step 4: Check last week's orders", async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_last_weeks_orders', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const data = parseToolResponse<{ orders: unknown[] }>(result);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_last_weeks_orders',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: {},
        result,
        duration,
        dataValidation: recorder.createDataValidation([
          { name: 'has_data', expected: true, actual: !!data },
        ]),
      });
    });

    it.skipIf(!!skipReason)("Step 5: Check last month's orders", async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_last_months_orders', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_last_months_orders',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: {},
        result,
        duration,
      });
    });
  });

  describe('Access Boundaries', () => {
    it.skipIf(!!skipReason)('Step 6: Should be DENIED admin tools (execute_sql)', async () => {
      const startTime = Date.now();
      const result = await client.callTool('execute_sql', { query: 'SELECT 1' });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(true);

      const recorder = getRecorder();
      recorder.recordDenial({
        tool: 'execute_sql',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: { query: 'SELECT 1' },
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 7: Should be DENIED schema tools', async () => {
      const result = await client.callTool('get_tables', {});
      expect(result.isError).toBe(true);

      const recorder = getRecorder();
      recorder.recordDenial({
        tool: 'get_tables',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: {},
        result,
        duration: 0,
      });
    });

    it.skipIf(!!skipReason)('Step 8: Should be DENIED full ERP tools', async () => {
      // Replaced get_customer_concentration with get_erp_summary (tool removed)
      const result = await client.callTool('get_erp_summary', {});
      expect(result.isError).toBe(true);

      const recorder = getRecorder();
      recorder.recordDenial({
        tool: 'get_erp_summary',
        user: salesRepEmail,
        userScopes: salesRep.expectedScopes,
        input: {},
        result,
        duration: 0,
      });
    });
  });
});

describe('Multiple Sales Reps Comparison', () => {
  // Test that different sales reps see different data
  const rep1 = 'sr@zueggcom.it';
  const rep2 = 'cz@zueggcom.it';

  const skip1 = !isUserConfigured(rep1);
  const skip2 = !isUserConfigured(rep2);

  it.skipIf(skip1 || skip2)('different sales reps should see different mailbox data', async () => {
    const client1 = await getMCPClientForUser(rep1);
    const client2 = await getMCPClientForUser(rep2);

    const result1 = await client1.callTool('get_recent_emails', { hours: 720, limit: 50 });
    const result2 = await client2.callTool('get_recent_emails', { hours: 720, limit: 50 });

    expect(result1.isError).toBe(false);
    expect(result2.isError).toBe(false);

    const data1 = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result1);
    const data2 = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result2);

    // Extract unique mailboxes
    const mailboxes1 = new Set(data1!.emails.map((e) => e.mailbox));
    const mailboxes2 = new Set(data2!.emails.map((e) => e.mailbox));

    // sr@ should only see sr mailbox
    expect(mailboxes1.size).toBe(1);
    expect(mailboxes1.has('sr@zueggcom.it') || Array.from(mailboxes1)[0]?.includes('sr')).toBe(true);

    // cz@ should only see cz mailbox
    expect(mailboxes2.size).toBe(1);
    expect(mailboxes2.has('cz@zueggcom.it') || Array.from(mailboxes2)[0]?.includes('cz')).toBe(true);
  });

  it.skipIf(skip1 || skip2)('both sales reps should have same ERP order access', async () => {
    const client1 = await getMCPClientForUser(rep1);
    const client2 = await getMCPClientForUser(rep2);

    // Both should be able to access orders
    const orders1 = await client1.callTool('get_last_weeks_orders', {});
    const orders2 = await client2.callTool('get_last_weeks_orders', {});

    expect(orders1.isError).toBe(false);
    expect(orders2.isError).toBe(false);

    // Both should be denied full ERP
    const erp1 = await client1.callTool('get_erp_summary', {});
    const erp2 = await client2.callTool('get_erp_summary', {});

    expect(erp1.isError).toBe(true);
    expect(erp2.isError).toBe(true);
  });
});
