/**
 * Tool Authorization Matrix Tests
 *
 * Tests all 21 tools against all 13 users = 273 authorization tests
 * Verifies that each user can only access tools they're authorized for
 *
 * Updated 2026-01-24: Removed get_customer_concentration, get_email_thread
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse, isAuthorizationDenied } from '../../helpers/mcp-client';
import { TEST_USERS, getUserPassword } from '../../fixtures/users';
import { TOOLS, AUTHORIZATION_MATRIX, getToolTestArgs } from '../../fixtures/tool-matrix';
import { setupE2ETests, getMCPClientForUser, isUserConfigured, TEST_CONFIG } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('tool-matrix');

describe('Tool Authorization Matrix', () => {
  // Cache MCP clients per user for performance
  const clientCache: Map<string, MCPTestClient> = new Map();

  async function getClient(userEmail: string): Promise<MCPTestClient> {
    if (!clientCache.has(userEmail)) {
      const client = await getMCPClientForUser(userEmail);
      clientCache.set(userEmail, client);
    }
    return clientCache.get(userEmail)!;
  }

  // Test each tool
  Object.entries(TOOLS).forEach(([toolName, toolDef]) => {
    describe(`Tool: ${toolName}`, () => {
      // Test against each user
      Object.entries(TEST_USERS).forEach(([userEmail, user]) => {
        const expectedResult = AUTHORIZATION_MATRIX[toolName]?.[userEmail] || 'denied';
        const skipReason = !isUserConfigured(userEmail) ? 'Password not configured' : null;

        it.skipIf(!!skipReason)(
          `${user.name} (${user.accessTier}) should be ${expectedResult}`,
          async () => {
            const client = await getClient(userEmail);
            const testArgs = getToolTestArgs(toolName);

            const startTime = Date.now();
            const result = await client.callTool(toolName, testArgs);
            const duration = Date.now() - startTime;

            // Determine actual result
            const actualResult = result.isError ? 'denied' : 'allowed';

            // Record the test
            const recorder = getRecorder();
            recorder.record({
              tool: toolName,
              user: userEmail,
              userScopes: user.expectedScopes,
              input: testArgs,
              result,
              duration,
              expectedAuthorization: expectedResult,
            });

            // Verify authorization matches expectation
            if (expectedResult === 'denied') {
              expect(result.isError).toBe(true);
              // Verify it's specifically an authorization error
              if (result.isError) {
                const isAuthError = isAuthorizationDenied(result);
                expect(isAuthError).toBe(true);
              }
            } else {
              // For 'allowed' tools, either:
              // 1. No error (success), or
              // 2. An error that is NOT an authorization error (e.g., "not found" with fake inputs)
              if (result.isError) {
                const isAuthError = isAuthorizationDenied(result);
                expect(isAuthError).toBe(false); // Should NOT be an auth error
              }
            }
          }
        );
      });
    });
  });

  describe('Matrix Coverage', () => {
    it('should have authorization rules for all tools', () => {
      const toolNames = Object.keys(TOOLS);
      const matrixTools = Object.keys(AUTHORIZATION_MATRIX);

      // Every tool should have a matrix entry
      for (const tool of toolNames) {
        expect(matrixTools).toContain(tool);
      }
    });

    it('should have authorization rules for all users in each tool', () => {
      const userEmails = Object.keys(TEST_USERS);

      for (const [toolName, userRules] of Object.entries(AUTHORIZATION_MATRIX)) {
        const toolUsers = Object.keys(userRules);

        for (const email of userEmails) {
          expect(toolUsers).toContain(email);
        }
      }
    });

    it('should cover 273 total authorization rules (21 tools x 13 users)', () => {
      const totalRules = Object.values(AUTHORIZATION_MATRIX).reduce(
        (sum, userRules) => sum + Object.keys(userRules).length,
        0
      );

      expect(totalRules).toBe(273);
    });
  });

  describe('Authorization Patterns (Actual Server Behavior)', () => {
    // NOTE: These tests document ACTUAL server behavior as of 2026-01-23
    // Some patterns may differ from expected design

    it('analytics tools should be available to all users', () => {
      const analyticsTools = ['get_daily_summary', 'get_volume_trends', 'get_cascade_metrics'];

      for (const tool of analyticsTools) {
        for (const email of Object.keys(TEST_USERS)) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('allowed');
        }
      }
    });

    it('email tools should be available to all users', () => {
      // Removed get_email_thread (tool no longer exists)
      const emailTools = ['get_recent_emails', 'get_email_by_id', 'search_emails', 'get_emails_by_sender'];

      for (const tool of emailTools) {
        for (const email of Object.keys(TEST_USERS)) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('allowed');
        }
      }
    });

    it('schema tools should be denied for all users (current behavior)', () => {
      const schemaTools = ['get_tables', 'get_schema', 'describe_table'];

      for (const tool of schemaTools) {
        for (const email of Object.keys(TEST_USERS)) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('denied');
        }
      }
    });

    it('pipeline tools should be denied for all users (current behavior)', () => {
      const pipelineTools = ['get_pipeline_stats', 'get_stuck_emails', 'get_processing_queue', 'get_sync_status'];

      for (const tool of pipelineTools) {
        for (const email of Object.keys(TEST_USERS)) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('denied');
        }
      }
    });

    it('power tools (execute_sql) should be allowed for lz@ and fh@', () => {
      const powerTools = ['execute_sql'];
      const privilegedUsers = ['lz@zueggcom.it', 'fh@zueggcom.it'];
      const otherUsers = Object.keys(TEST_USERS).filter((e) => !privilegedUsers.includes(e));

      for (const tool of powerTools) {
        // Privileged users should have access
        for (const email of privilegedUsers) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('allowed');
        }

        // Others should be denied
        for (const email of otherUsers) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('denied');
        }
      }
    });

    it('ERP full tools should be allowed for Kansofy admins + lz@ + fh@ only', () => {
      // Removed get_customer_concentration (tool no longer exists)
      const erpFullTools = ['get_erp_summary', 'get_late_deliveries'];
      const privilegedUsers = ['vadim@kansofy.com', 'zikasaks@gmail.com', 'aiops@zueggcom.it', 'lz@zueggcom.it', 'fh@zueggcom.it'];
      const otherUsers = Object.keys(TEST_USERS).filter((e) => !privilegedUsers.includes(e));

      for (const tool of erpFullTools) {
        // Privileged users should have access
        for (const email of privilegedUsers) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('allowed');
        }

        // Others should be denied
        for (const email of otherUsers) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('denied');
        }
      }
    });

    it('ERP orders tools should be allowed for all except viewers', () => {
      const erpOrdersTools = ['get_last_weeks_orders', 'get_last_months_orders', 'get_orders_by_customer'];
      const viewers = ['lg@zueggcom.it', 'jz@zueggcom.it'];
      const allowedUsers = Object.keys(TEST_USERS).filter((e) => !viewers.includes(e));

      for (const tool of erpOrdersTools) {
        // Most users should have access
        for (const email of allowedUsers) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('allowed');
        }

        // Viewers should be denied
        for (const email of viewers) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('denied');
        }
      }
    });

    it('document tools should only be allowed for lg@ (current behavior)', () => {
      const documentTools = ['get_documents', 'get_doc_types'];
      const allowedUser = 'lg@zueggcom.it';

      for (const tool of documentTools) {
        expect(AUTHORIZATION_MATRIX[tool]?.[allowedUser]).toBe('allowed');

        for (const email of Object.keys(TEST_USERS).filter((e) => e !== allowedUser)) {
          expect(AUTHORIZATION_MATRIX[tool]?.[email]).toBe('denied');
        }
      }
    });
  });
});
