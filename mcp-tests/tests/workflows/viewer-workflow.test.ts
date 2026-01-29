/**
 * Viewer Workflow Tests
 *
 * Simulates a limited-access user's workflow (self-only access, no ERP)
 * Tests users like lg@ and jz@ who only see their own mailbox
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse, isAuthorizationDenied } from '../../helpers/mcp-client';
import { TEST_USERS, getUserPassword, NON_ERP_USERS } from '../../fixtures/users';
import { setupE2ETests, getMCPClientForUser, isUserConfigured, TEST_CONFIG } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('viewer-workflow');

describe('Limited Viewer Workflow', () => {
  // Test with lg@zueggcom.it as representative limited user
  const viewerEmail = 'lg@zueggcom.it';
  const viewer = TEST_USERS[viewerEmail];
  const skipReason = !isUserConfigured(viewerEmail) ? 'Password not configured' : null;

  let client: MCPTestClient;

  beforeAll(async () => {
    if (!skipReason) {
      client = await getMCPClientForUser(viewerEmail);
    }
  });

  describe('Email Access (Allowed)', () => {
    it.skipIf(!!skipReason)('Step 1: Check own mailbox emails', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_recent_emails', { hours: 168, limit: 50 }); // 1 week
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const data = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result);
      expect(data).not.toBeNull();

      // Should only see own mailbox (lg)
      const mailboxes = new Set(data!.emails.map((e) => e.mailbox));
      expect(mailboxes.size).toBe(1);

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'get_recent_emails',
        user: viewerEmail,
        userScopes: viewer.expectedScopes,
        input: { hours: 168, limit: 50 },
        result,
        duration,
        dataValidation: recorder.createDataValidation([
          { name: 'single_mailbox', expected: 1, actual: mailboxes.size },
          { name: 'email_count', expected: viewer.expectedEmailCount, actual: data!.emails.length },
        ]),
      });

      console.log(`  Found ${data!.emails.length} emails from own mailbox`);
    });

    it.skipIf(!!skipReason)('Step 2: Search within own emails', async () => {
      const startTime = Date.now();
      const result = await client.callTool('search_emails', {
        query: 'invoice',
        field: 'subject',
        limit: 10,
      });
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(false);

      const data = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result);

      // All results should be from own mailbox
      if (data && data.emails.length > 0) {
        for (const email of data.emails) {
          expect(email.mailbox).toContain('lg');
        }
      }

      const recorder = getRecorder();
      recorder.recordSuccess({
        tool: 'search_emails',
        user: viewerEmail,
        userScopes: viewer.expectedScopes,
        input: { query: 'invoice', field: 'subject', limit: 10 },
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 3: Check emails by sender', async () => {
      const result = await client.callTool('get_emails_by_sender', {
        sender_email: 'aromatech.fr',
        limit: 10,
      });

      expect(result.isError).toBe(false);

      // Results should only be from own mailbox (lg)
      const data = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result);
      if (data && data.emails.length > 0) {
        for (const email of data.emails) {
          expect(email.mailbox).toContain('lg');
        }
      }
    });
  });

  describe('ERP Access (Denied)', () => {
    it.skipIf(!!skipReason)('Step 4: Should be DENIED order tools', async () => {
      const startTime = Date.now();
      const result = await client.callTool('get_last_weeks_orders', {});
      const duration = Date.now() - startTime;

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);

      const recorder = getRecorder();
      recorder.recordDenial({
        tool: 'get_last_weeks_orders',
        user: viewerEmail,
        userScopes: viewer.expectedScopes,
        input: {},
        result,
        duration,
      });
    });

    it.skipIf(!!skipReason)('Step 5: Should be DENIED full ERP tools', async () => {
      const result = await client.callTool('get_erp_summary', {});

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('Step 6: Should be DENIED late deliveries', async () => {
      // Replaced get_customer_concentration with get_late_deliveries (tool removed)
      const result = await client.callTool('get_late_deliveries', {});

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });
  });

  describe('Admin Tools (Denied)', () => {
    it.skipIf(!!skipReason)('Step 7: Should be DENIED schema tools', async () => {
      const result = await client.callTool('get_tables', {});

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);

      const recorder = getRecorder();
      recorder.recordDenial({
        tool: 'get_tables',
        user: viewerEmail,
        userScopes: viewer.expectedScopes,
        input: {},
        result,
        duration: 0,
      });
    });

    it.skipIf(!!skipReason)('Step 8: Should be DENIED SQL execution', async () => {
      const result = await client.callTool('execute_sql', { query: 'SELECT 1' });

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });

    it.skipIf(!!skipReason)('Step 9: Should be DENIED pipeline tools', async () => {
      const result = await client.callTool('get_pipeline_stats', {});

      expect(result.isError).toBe(true);
      expect(isAuthorizationDenied(result)).toBe(true);
    });
  });

  describe('Analytics Access', () => {
    // Note: Analytics access may vary - testing actual behavior
    it.skipIf(!!skipReason)('Step 10: Check analytics access', async () => {
      const result = await client.callTool('get_daily_summary', {});

      // Record actual behavior (may be allowed or denied)
      const recorder = getRecorder();
      if (result.isError) {
        recorder.recordDenial({
          tool: 'get_daily_summary',
          user: viewerEmail,
          userScopes: viewer.expectedScopes,
          input: {},
          result,
          duration: 0,
        });
      } else {
        recorder.recordSuccess({
          tool: 'get_daily_summary',
          user: viewerEmail,
          userScopes: viewer.expectedScopes,
          input: {},
          result,
          duration: 0,
        });
      }
    });
  });
});

describe('Multiple Limited Users Isolation', () => {
  // Test that lg@ and jz@ are properly isolated
  const user1 = 'lg@zueggcom.it';
  const user2 = 'jz@zueggcom.it';

  const skip1 = !isUserConfigured(user1);
  const skip2 = !isUserConfigured(user2);

  it.skipIf(skip1 || skip2)('limited users should be isolated from each other', async () => {
    const client1 = await getMCPClientForUser(user1);
    const client2 = await getMCPClientForUser(user2);

    const result1 = await client1.callTool('get_recent_emails', { hours: 720, limit: 50 });
    const result2 = await client2.callTool('get_recent_emails', { hours: 720, limit: 50 });

    expect(result1.isError).toBe(false);
    expect(result2.isError).toBe(false);

    const data1 = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result1);
    const data2 = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(result2);

    // Each user should only see their own mailbox
    const mailboxes1 = new Set(data1!.emails.map((e) => e.mailbox));
    const mailboxes2 = new Set(data2!.emails.map((e) => e.mailbox));

    // Verify isolation - no overlap
    expect(mailboxes1.size).toBe(1);
    expect(mailboxes2.size).toBe(1);

    // lg sees lg, jz sees jz
    expect(Array.from(mailboxes1)[0]).toContain('lg');
    expect(Array.from(mailboxes2)[0]).toContain('jz');

    // No cross-access
    for (const mb of mailboxes1) {
      expect(mb).not.toContain('jz');
    }
    for (const mb of mailboxes2) {
      expect(mb).not.toContain('lg');
    }
  });

  it.skipIf(skip1 || skip2)('limited users should have same tool restrictions', async () => {
    const client1 = await getMCPClientForUser(user1);
    const client2 = await getMCPClientForUser(user2);

    // Both should be denied admin tools
    const admin1 = await client1.callTool('execute_sql', { query: 'SELECT 1' });
    const admin2 = await client2.callTool('execute_sql', { query: 'SELECT 1' });

    expect(admin1.isError).toBe(true);
    expect(admin2.isError).toBe(true);

    // Both should be denied ERP
    const erp1 = await client1.callTool('get_erp_summary', {});
    const erp2 = await client2.callTool('get_erp_summary', {});

    expect(erp1.isError).toBe(true);
    expect(erp2.isError).toBe(true);
  });
});

describe('Team vs Self Access Comparison', () => {
  const teamUser = 'fh@zueggcom.it'; // Team tier
  const selfUser = 'lg@zueggcom.it'; // Self tier

  const skipTeam = !isUserConfigured(teamUser);
  const skipSelf = !isUserConfigured(selfUser);

  it.skipIf(skipTeam || skipSelf)('team user should see more mailboxes than self user', async () => {
    const teamClient = await getMCPClientForUser(teamUser);
    const selfClient = await getMCPClientForUser(selfUser);

    const teamResult = await teamClient.callTool('get_recent_emails', { hours: 720, limit: 100 });
    const selfResult = await selfClient.callTool('get_recent_emails', { hours: 720, limit: 100 });

    expect(teamResult.isError).toBe(false);
    expect(selfResult.isError).toBe(false);

    const teamData = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(teamResult);
    const selfData = parseToolResponse<{ emails: Array<{ mailbox: string }> }>(selfResult);

    const teamMailboxes = new Set(teamData!.emails.map((e) => e.mailbox));
    const selfMailboxes = new Set(selfData!.emails.map((e) => e.mailbox));

    // Team user (fh) should see multiple mailboxes
    expect(teamMailboxes.size).toBeGreaterThan(1);

    // Self user (lg) should only see 1 mailbox
    expect(selfMailboxes.size).toBe(1);

    console.log(`  Team user (${teamUser}): ${teamMailboxes.size} mailboxes`);
    console.log(`  Self user (${selfUser}): ${selfMailboxes.size} mailbox`);
  });
});
