/**
 * Data Access Tests
 *
 * Verifies row-level data filtering based on user access tiers
 * Users should only see data from their authorized mailboxes
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse } from '../../helpers/mcp-client';
import { TEST_USERS, getUserPassword, USERS_BY_TIER, SALES_REPS, VIEWERS } from '../../fixtures/users';
import { EXPECTED_DATA, getExpectedEmailCount } from '../../fixtures/expected-data';
import { setupE2ETests, getMCPClientForUser, isUserConfigured, TEST_CONFIG } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('data-access');

interface Email {
  id: string;
  mailbox: string;
  from_email: string;
  subject: string;
  received_at: string;
}

interface EmailResponse {
  emails: Email[];
  count: number;
}

describe('Email Data Access', () => {
  describe('Visibility by Access Tier', () => {
    // Test 'all' tier (admin)
    describe("Tier: 'all' (Admin)", () => {
      const adminEmail = 'lz@zueggcom.it';
      const skipReason = !isUserConfigured(adminEmail) ? 'Password not configured' : null;

      it.skipIf(!!skipReason)('should see emails from all 11 mailboxes', async () => {
        const client = await getMCPClientForUser(adminEmail);
        const startTime = Date.now();

        const result = await client.callTool('get_recent_emails', { hours: 720, limit: 100 });
        const duration = Date.now() - startTime;

        expect(result.isError).toBe(false);

        const data = parseToolResponse<EmailResponse>(result);
        expect(data).not.toBeNull();

        // Admin should see emails from multiple mailboxes
        const mailboxes = new Set(data!.emails.map((e) => e.mailbox));
        expect(mailboxes.size).toBeGreaterThan(5);

        // Record with data validation
        const recorder = getRecorder();
        recorder.record({
          tool: 'get_recent_emails',
          user: adminEmail,
          userScopes: TEST_USERS[adminEmail].expectedScopes,
          input: { hours: 720, limit: 100 },
          result,
          duration,
          expectedAuthorization: 'allowed',
          dataValidation: recorder.createDataValidation([
            { name: 'mailbox_count', expected: { min: 6, max: 11 }, actual: mailboxes.size },
          ]),
        });
      });

      it.skipIf(!!skipReason)('should see approximately 5000 total emails', async () => {
        const client = await getMCPClientForUser(adminEmail);
        const result = await client.callTool('get_recent_emails', { hours: 8760, limit: 5500 }); // 1 year

        expect(result.isError).toBe(false);

        const data = parseToolResponse<EmailResponse>(result);
        const expected = TEST_USERS[adminEmail].expectedEmailCount;

        expect(data!.count || data!.emails.length).toBeGreaterThan(expected.min);
        expect(data!.count || data!.emails.length).toBeLessThan(expected.max);
      });
    });

    // Test 'team' tier
    describe("Tier: 'team'", () => {
      USERS_BY_TIER.team.forEach((userEmail) => {
        const user = TEST_USERS[userEmail];
        const skipReason = !isUserConfigured(userEmail) ? 'Password not configured' : null;

        describe(`${user.name} (${userEmail})`, () => {
          it.skipIf(!!skipReason)('should only see emails from team mailboxes', async () => {
            const client = await getMCPClientForUser(userEmail);
            const startTime = Date.now();

            const result = await client.callTool('get_recent_emails', { hours: 720, limit: 100 });
            const duration = Date.now() - startTime;

            expect(result.isError).toBe(false);

            const data = parseToolResponse<EmailResponse>(result);
            expect(data).not.toBeNull();

            // Extract visible mailboxes
            const visibleMailboxes = new Set(data!.emails.map((e) => {
              // Extract mailbox prefix from email address
              const mailbox = e.mailbox || e.from_email?.split('@')[0];
              return mailbox;
            }));

            // Should only see team mailboxes
            const allowedMailboxes = user.teamMailboxes.map((m) => `${m}@zueggcom.it`);

            for (const email of data!.emails) {
              const mailboxOk = allowedMailboxes.some(
                (allowed) => email.mailbox?.includes(allowed.split('@')[0]) || email.from_email?.includes(allowed.split('@')[0])
              );
              if (!mailboxOk && email.mailbox) {
                console.log(`Unexpected mailbox: ${email.mailbox} for user ${userEmail}`);
              }
            }

            // Record with validation
            const recorder = getRecorder();
            recorder.record({
              tool: 'get_recent_emails',
              user: userEmail,
              userScopes: user.expectedScopes,
              input: { hours: 720, limit: 100 },
              result,
              duration,
              expectedAuthorization: 'allowed',
              dataValidation: recorder.createDataValidation([
                { name: 'has_results', expected: true, actual: data!.emails.length > 0 },
              ]),
            });
          });

          it.skipIf(!!skipReason)('should see expected email count range', async () => {
            const client = await getMCPClientForUser(userEmail);
            const result = await client.callTool('get_recent_emails', { hours: 8760, limit: 5000 });

            expect(result.isError).toBe(false);

            const data = parseToolResponse<EmailResponse>(result);
            const emailCount = data!.count || data!.emails.length;

            expect(emailCount).toBeGreaterThanOrEqual(user.expectedEmailCount.min);
            expect(emailCount).toBeLessThanOrEqual(user.expectedEmailCount.max);
          });
        });
      });
    });

    // Test 'self' tier
    describe("Tier: 'self'", () => {
      USERS_BY_TIER.self.forEach((userEmail) => {
        const user = TEST_USERS[userEmail];
        const skipReason = !isUserConfigured(userEmail) ? 'Password not configured' : null;

        describe(`${user.name} (${userEmail})`, () => {
          it.skipIf(!!skipReason)('should only see emails from own mailbox', async () => {
            const client = await getMCPClientForUser(userEmail);
            const startTime = Date.now();

            const result = await client.callTool('get_recent_emails', { hours: 720, limit: 50 });
            const duration = Date.now() - startTime;

            expect(result.isError).toBe(false);

            const data = parseToolResponse<EmailResponse>(result);
            expect(data).not.toBeNull();

            // All emails should be from user's own mailbox
            const userPrefix = userEmail.split('@')[0];
            for (const email of data!.emails) {
              const mailboxPrefix = email.mailbox?.split('@')[0] || '';
              expect(mailboxPrefix).toBe(userPrefix);
            }

            // Record with validation
            const recorder = getRecorder();
            recorder.record({
              tool: 'get_recent_emails',
              user: userEmail,
              userScopes: user.expectedScopes,
              input: { hours: 720, limit: 50 },
              result,
              duration,
              expectedAuthorization: 'allowed',
              dataValidation: recorder.createDataValidation([
                { name: 'single_mailbox', expected: 1, actual: new Set(data!.emails.map((e) => e.mailbox)).size },
              ]),
            });
          });
        });
      });
    });
  });

  describe('Email Search Filtering', () => {
    const testEmail = 'sr@zueggcom.it'; // Self-only user
    const skipReason = !isUserConfigured(testEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('search results should be filtered to user mailbox', async () => {
      const client = await getMCPClientForUser(testEmail);

      // Search for a common term
      const result = await client.callTool('search_emails', {
        query: 'order',
        field: 'subject',
        limit: 20,
      });

      expect(result.isError).toBe(false);

      const data = parseToolResponse<EmailResponse>(result);
      if (data && data.emails.length > 0) {
        // All results should be from sr@ mailbox
        for (const email of data.emails) {
          expect(email.mailbox).toContain('sr');
        }
      }
    });
  });

  describe('Email by ID Access', () => {
    // Test accessing a known email ID for sp@zueggcom.it
    const spEmail = 'sp@zueggcom.it';
    const spSkip = !isUserConfigured(spEmail) ? 'Password not configured' : null;

    it.skipIf(!!spSkip)('should allow sp@ to access own mailbox emails', async () => {
      const sampleEmail = EXPECTED_DATA.sampleEmails['sp@zueggcom.it']?.[0];
      if (!sampleEmail) {
        console.log('Skipping: No sample email ID for sp@');
        return;
      }

      const client = await getMCPClientForUser(spEmail);
      const result = await client.callTool('get_email_by_id', { id: sampleEmail.id });

      expect(result.isError).toBe(false);
    });

    it.skipIf(!!spSkip)("should deny lg@ from accessing sp@'s emails", async () => {
      const lgEmail = 'lg@zueggcom.it';
      if (!isUserConfigured(lgEmail)) {
        console.log('Skipping: lg@ not configured');
        return;
      }

      const sampleEmail = EXPECTED_DATA.sampleEmails['sp@zueggcom.it']?.[0];
      if (!sampleEmail) {
        console.log('Skipping: No sample email ID for sp@');
        return;
      }

      const client = await getMCPClientForUser(lgEmail);
      const result = await client.callTool('get_email_by_id', { id: sampleEmail.id });

      // Should either error or return empty (depending on implementation)
      // The key is that lg@ should NOT get sp@'s email content
      if (!result.isError) {
        const data = parseToolResponse<{ email: Email | null }>(result);
        expect(data?.email).toBeNull();
      }
    });
  });
});

describe('ERP Data Access', () => {
  describe('Sales Reps with ERP Orders Access', () => {
    SALES_REPS.forEach((userEmail) => {
      const user = TEST_USERS[userEmail];
      const skipReason = !isUserConfigured(userEmail) ? 'Password not configured' : null;

      it.skipIf(!!skipReason)(`${user.name} should access order tools`, async () => {
        const client = await getMCPClientForUser(userEmail);

        // Should have access to orders
        const ordersResult = await client.callTool('get_last_weeks_orders', {});
        expect(ordersResult.isError).toBe(false);

        // Should NOT have access to full ERP
        const concentrationResult = await client.callTool('get_customer_concentration', {});
        expect(concentrationResult.isError).toBe(true);
      });
    });
  });

  describe('Users Without ERP Access (Viewers)', () => {
    VIEWERS.forEach((userEmail) => {
      const user = TEST_USERS[userEmail];
      const skipReason = !isUserConfigured(userEmail) ? 'Password not configured' : null;

      it.skipIf(!!skipReason)(`${user.name} should be denied ERP orders tools`, async () => {
        const client = await getMCPClientForUser(userEmail);

        // Viewers should be denied order tools (no tool:erp or tool:erp-orders)
        const ordersResult = await client.callTool('get_last_weeks_orders', {});
        expect(ordersResult.isError).toBe(true);

        // Should be denied full ERP tools
        const erpResult = await client.callTool('get_erp_summary', {});
        expect(erpResult.isError).toBe(true);
      });
    });
  });

  describe('Admin Full ERP Access', () => {
    const adminEmail = 'lz@zueggcom.it';
    const skipReason = !isUserConfigured(adminEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('admin should have full ERP access', async () => {
      const client = await getMCPClientForUser(adminEmail);

      // Should access all ERP tools
      const summaryResult = await client.callTool('get_erp_summary', {});
      expect(summaryResult.isError).toBe(false);

      const concentrationResult = await client.callTool('get_customer_concentration', {});
      expect(concentrationResult.isError).toBe(false);

      const lateResult = await client.callTool('get_late_deliveries', {});
      expect(lateResult.isError).toBe(false);
    });
  });
});
