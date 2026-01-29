/**
 * Tools List Filtering Tests
 *
 * Verifies that the tools/list endpoint correctly filters available tools
 * based on user scopes. This is critical for:
 * 1. Preventing information disclosure about admin tools
 * 2. Ensuring users only see tools they can actually use
 * 3. Correct implementation of filterToolsByScopes
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MCPTestClient, parseToolResponse } from '../../helpers/mcp-client';
import { TEST_USERS, ADMIN_USERS, SALES_REPS, NON_ERP_USERS } from '../../fixtures/users';
import { TOOLS, TOOL_CATEGORIES, ALL_TOOLS, ADMIN_ONLY_TOOLS, CUSTOMER_TOOLS } from '../../fixtures/tool-matrix';
import { setupE2ETests, getMCPClientForUser, isUserConfigured } from '../../setup';
import { getRecorder } from '../../helpers/recorder';

setupE2ETests('tools-list-filtering');

// Cache MCP clients per user for performance
const clientCache: Map<string, MCPTestClient> = new Map();

async function getClient(userEmail: string): Promise<MCPTestClient> {
  if (!clientCache.has(userEmail)) {
    const client = await getMCPClientForUser(userEmail);
    clientCache.set(userEmail, client);
  }
  return clientCache.get(userEmail)!;
}

/**
 * Tools that require tool:* (admin only)
 */
const ADMIN_ONLY_TOOL_NAMES = [
  'get_tables',
  'get_schema',
  'describe_table',
  'get_pipeline_stats',
  'get_stuck_emails',
  'get_processing_queue',
  'get_sync_status',
  'execute_sql',
  'list_mcp_connections',
  'discover_mcp_tools',
];

/**
 * Tools that require specific scopes but not admin
 * Updated 2026-01-24: Removed get_customer_concentration, get_email_thread
 */
const SCOPED_TOOLS = {
  'tool:erp': ['get_erp_summary', 'get_late_deliveries'],  // Removed get_customer_concentration
  'tool:erp-orders': ['get_last_weeks_orders', 'get_last_months_orders', 'get_orders_by_customer'],
  'tool:document': ['get_documents', 'get_doc_types'],
  'tool:email': ['get_recent_emails', 'get_email_by_id', 'search_emails', 'get_emails_by_sender', 'list_email_tools', 'call_email_tool'],  // Removed get_email_thread
  'tool:analytics': ['get_daily_summary', 'get_volume_trends', 'get_cascade_metrics'],
  'tool:sales': ['list_sales_tools', 'call_sales_tool', 'lookup_prospect'],
};

describe('Tools List Filtering', () => {

  describe('Admin (lz@) - Full Access', () => {
    const adminEmail = 'lz@zueggcom.it';
    const skipReason = !isUserConfigured(adminEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should see all tools (23+)', async () => {
      const client = await getClient(adminEmail);
      const tools = await client.listTools();

      // Admin should see many tools
      expect(tools.length).toBeGreaterThanOrEqual(23);

      // Record for analysis
      const recorder = getRecorder();
      recorder.record({
        tool: 'tools/list',
        user: adminEmail,
        userScopes: TEST_USERS[adminEmail].expectedScopes,
        input: {},
        result: { isError: false, content: [{ type: 'text', text: JSON.stringify({ toolCount: tools.length }) }] },
        duration: 0,
        expectedAuthorization: 'allowed',
      });
    });

    it.skipIf(!!skipReason)('should see admin-only tools', async () => {
      const client = await getClient(adminEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // Check for admin tools
      for (const adminTool of ADMIN_ONLY_TOOL_NAMES) {
        expect(toolNames).toContain(adminTool);
      }
    });

    it.skipIf(!!skipReason)('should see all ERP tools', async () => {
      const client = await getClient(adminEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // Should see full ERP (get_customer_concentration removed)
      expect(toolNames).toContain('get_erp_summary');
      expect(toolNames).toContain('get_late_deliveries');

      // Should see ERP orders
      expect(toolNames).toContain('get_last_weeks_orders');
      expect(toolNames).toContain('get_last_months_orders');
      expect(toolNames).toContain('get_orders_by_customer');
    });
  });

  describe('Team Lead (fh@) - Extended Access', () => {
    const teamLeadEmail = 'fh@zueggcom.it';
    const skipReason = !isUserConfigured(teamLeadEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should NOT see admin-only tools', async () => {
      const client = await getClient(teamLeadEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // Should NOT see these admin tools
      expect(toolNames).not.toContain('get_tables');
      expect(toolNames).not.toContain('get_schema');
      expect(toolNames).not.toContain('execute_sql');
      expect(toolNames).not.toContain('get_pipeline_stats');
      expect(toolNames).not.toContain('list_mcp_connections');
    });

    it.skipIf(!!skipReason)('should see ERP tools (has tool:erp)', async () => {
      const client = await getClient(teamLeadEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // Should see full ERP (get_customer_concentration removed)
      expect(toolNames).toContain('get_erp_summary');
      expect(toolNames).toContain('get_late_deliveries');

      // Should see ERP orders
      expect(toolNames).toContain('get_last_weeks_orders');
      expect(toolNames).toContain('get_orders_by_customer');
    });

    it.skipIf(!!skipReason)('should see document tools', async () => {
      const client = await getClient(teamLeadEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('get_documents');
      expect(toolNames).toContain('get_doc_types');
    });

    it.skipIf(!!skipReason)('should see email and analytics tools', async () => {
      const client = await getClient(teamLeadEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // Email tools
      expect(toolNames).toContain('get_recent_emails');
      expect(toolNames).toContain('search_emails');

      // Analytics tools
      expect(toolNames).toContain('get_daily_summary');
      expect(toolNames).toContain('get_volume_trends');
    });
  });

  describe('Sales Rep (sr@) - Limited ERP Access', () => {
    const salesRepEmail = 'sr@zueggcom.it';
    const skipReason = !isUserConfigured(salesRepEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should NOT see admin-only tools', async () => {
      const client = await getClient(salesRepEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      for (const adminTool of ADMIN_ONLY_TOOL_NAMES) {
        expect(toolNames).not.toContain(adminTool);
      }
    });

    it.skipIf(!!skipReason)('should see ERP orders but NOT full ERP', async () => {
      const client = await getClient(salesRepEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // Should see ERP orders (dual scope allows tool:erp-orders)
      expect(toolNames).toContain('get_last_weeks_orders');
      expect(toolNames).toContain('get_last_months_orders');
      expect(toolNames).toContain('get_orders_by_customer');

      // Should NOT see full ERP tools (get_late_deliveries requires tool:erp)
      expect(toolNames).not.toContain('get_erp_summary');
      expect(toolNames).not.toContain('get_late_deliveries');
    });

    it.skipIf(!!skipReason)('should see email and analytics tools', async () => {
      const client = await getClient(salesRepEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('get_recent_emails');
      expect(toolNames).toContain('get_daily_summary');
    });

    it.skipIf(!!skipReason)('should NOT see document tools (no tool:document)', async () => {
      const client = await getClient(salesRepEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).not.toContain('get_documents');
      expect(toolNames).not.toContain('get_doc_types');
    });
  });

  describe('Viewer (lg@) - Basic Access', () => {
    const viewerEmail = 'lg@zueggcom.it';
    const skipReason = !isUserConfigured(viewerEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should NOT see admin-only tools', async () => {
      const client = await getClient(viewerEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      for (const adminTool of ADMIN_ONLY_TOOL_NAMES) {
        expect(toolNames).not.toContain(adminTool);
      }
    });

    it.skipIf(!!skipReason)('should NOT see any ERP tools', async () => {
      const client = await getClient(viewerEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      // No ERP access at all (get_customer_concentration removed)
      expect(toolNames).not.toContain('get_erp_summary');
      expect(toolNames).not.toContain('get_late_deliveries');
      expect(toolNames).not.toContain('get_last_weeks_orders');
      expect(toolNames).not.toContain('get_orders_by_customer');
    });

    it.skipIf(!!skipReason)('should see document tools (has tool:document)', async () => {
      const client = await getClient(viewerEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('get_documents');
      expect(toolNames).toContain('get_doc_types');
    });

    it.skipIf(!!skipReason)('should see email and analytics tools', async () => {
      const client = await getClient(viewerEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('get_recent_emails');
      expect(toolNames).toContain('get_daily_summary');
    });

    it.skipIf(!!skipReason)('should NOT see sales tools (no tool:sales)', async () => {
      const client = await getClient(viewerEmail);
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).not.toContain('list_sales_tools');
      expect(toolNames).not.toContain('call_sales_tool');
      expect(toolNames).not.toContain('lookup_prospect');
    });
  });

  describe('Tool Count Comparison', () => {
    it('admin should see more tools than team lead', async () => {
      const adminEmail = 'lz@zueggcom.it';
      const teamLeadEmail = 'fh@zueggcom.it';

      if (!isUserConfigured(adminEmail) || !isUserConfigured(teamLeadEmail)) {
        console.log('Skipping: Users not configured');
        return;
      }

      const adminClient = await getClient(adminEmail);
      const teamLeadClient = await getClient(teamLeadEmail);

      const adminTools = await adminClient.listTools();
      const teamLeadTools = await teamLeadClient.listTools();

      expect(adminTools.length).toBeGreaterThan(teamLeadTools.length);
    });

    it('team lead should see more tools than viewer', async () => {
      const teamLeadEmail = 'fh@zueggcom.it';
      const viewerEmail = 'lg@zueggcom.it';

      if (!isUserConfigured(teamLeadEmail) || !isUserConfigured(viewerEmail)) {
        console.log('Skipping: Users not configured');
        return;
      }

      const teamLeadClient = await getClient(teamLeadEmail);
      const viewerClient = await getClient(viewerEmail);

      const teamLeadTools = await teamLeadClient.listTools();
      const viewerTools = await viewerClient.listTools();

      // Team lead has ERP, viewer has document but not ERP
      // This could vary depending on exact scopes
      expect(teamLeadTools.length).toBeGreaterThanOrEqual(viewerTools.length);
    });
  });

  describe('Tool Description Security', () => {
    const viewerEmail = 'lg@zueggcom.it';
    const skipReason = !isUserConfigured(viewerEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should not expose admin tool descriptions to viewers', async () => {
      const client = await getClient(viewerEmail);
      const tools = await client.listTools();

      // Convert to string for search
      const toolsJson = JSON.stringify(tools);

      // Should not contain references to admin functionality
      expect(toolsJson).not.toContain('execute_sql');
      expect(toolsJson).not.toContain('get_tables');
      expect(toolsJson).not.toContain('pipeline');
    });
  });

  describe('Consistency Across Requests', () => {
    const viewerEmail = 'lg@zueggcom.it';
    const skipReason = !isUserConfigured(viewerEmail) ? 'Password not configured' : null;

    it.skipIf(!!skipReason)('should return consistent tool list across multiple requests', async () => {
      const client = await getClient(viewerEmail);

      // Make 3 requests and compare
      const results: string[][] = [];
      for (let i = 0; i < 3; i++) {
        const tools = await client.listTools();
        results.push(tools.map(t => t.name).sort());
      }

      // All results should be identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });

  describe('All Sales Reps - Identical Access', () => {
    const salesReps = ['sr@zueggcom.it', 'pa@zueggcom.it', 'cz@zueggcom.it', 'pb@zueggcom.it'];

    it('all sales reps should see the same tools', async () => {
      const configuredReps = salesReps.filter(isUserConfigured);

      if (configuredReps.length < 2) {
        console.log('Skipping: Less than 2 sales reps configured');
        return;
      }

      const toolLists: string[][] = [];

      for (const email of configuredReps) {
        const client = await getClient(email);
        const tools = await client.listTools();
        toolLists.push(tools.map(t => t.name).sort());
      }

      // All sales reps should see identical tool lists
      for (let i = 1; i < toolLists.length; i++) {
        expect(toolLists[i]).toEqual(toolLists[0]);
      }
    });
  });
});
