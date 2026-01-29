/**
 * Tool Authorization Matrix
 *
 * Maps each tool to its required scopes and expected access per user
 *
 * IMPORTANT: This matrix reflects DESIGNED authorization behavior as of 2026-01-24
 * based on RBAC requirements. Use this to detect regressions.
 *
 * Changes from previous version:
 * - Added Kansofy admins (vadim, zikasaks, aiops)
 * - Added Stefi (info@zueggcom.it)
 * - Removed get_customer_concentration tool
 * - Removed get_email_thread tool
 * - Added get_orders_by_customer tool
 * - Schema/Pipeline tools: Kansofy admins only (removed lz@ access)
 * - Power tools: Added fh@ access
 * - Analytics tools: Kansofy admins only (removed all Zuegg users)
 * - Document tools: Open to ALL users
 * - get_late_deliveries: Fixed to require tool:erp (was incorrectly tool:email)
 * - ERP orders: Added sp@ and info@ access
 */

export type AccessResult = 'allowed' | 'denied';

export interface ToolConfig {
  name: string;
  requiredScopes: string[];
  adminOnly: boolean;
  category: string;
}

// All 21 MCP tools with their authorization requirements (was 23, removed 2, added 1)
export const TOOLS: Record<string, ToolConfig> = {
  // Schema Tools - Kansofy admins only (requires tool:schema or tool:*)
  get_tables: {
    name: 'get_tables',
    requiredScopes: ['tool:schema'],
    adminOnly: true,
    category: 'schema',
  },
  get_schema: {
    name: 'get_schema',
    requiredScopes: ['tool:schema'],
    adminOnly: true,
    category: 'schema',
  },
  describe_table: {
    name: 'describe_table',
    requiredScopes: ['tool:schema'],
    adminOnly: true,
    category: 'schema',
  },

  // Email Tools - All users (4 tools, removed get_email_thread)
  get_recent_emails: {
    name: 'get_recent_emails',
    requiredScopes: ['tool:email'],
    adminOnly: false,
    category: 'email',
  },
  get_email_by_id: {
    name: 'get_email_by_id',
    requiredScopes: ['tool:email'],
    adminOnly: false,
    category: 'email',
  },
  search_emails: {
    name: 'search_emails',
    requiredScopes: ['tool:email'],
    adminOnly: false,
    category: 'email',
  },
  get_emails_by_sender: {
    name: 'get_emails_by_sender',
    requiredScopes: ['tool:email'],
    adminOnly: false,
    category: 'email',
  },

  // Pipeline Tools - Kansofy admins only (requires tool:pipeline or tool:*)
  get_pipeline_stats: {
    name: 'get_pipeline_stats',
    requiredScopes: ['tool:pipeline'],
    adminOnly: true,
    category: 'pipeline',
  },
  get_stuck_emails: {
    name: 'get_stuck_emails',
    requiredScopes: ['tool:pipeline'],
    adminOnly: true,
    category: 'pipeline',
  },
  get_processing_queue: {
    name: 'get_processing_queue',
    requiredScopes: ['tool:pipeline'],
    adminOnly: true,
    category: 'pipeline',
  },
  get_sync_status: {
    name: 'get_sync_status',
    requiredScopes: ['tool:pipeline'],
    adminOnly: true,
    category: 'pipeline',
  },

  // Document Tools - All users
  get_documents: {
    name: 'get_documents',
    requiredScopes: ['tool:document'],
    adminOnly: false,
    category: 'document',
  },
  get_doc_types: {
    name: 'get_doc_types',
    requiredScopes: ['tool:document'],
    adminOnly: false,
    category: 'document',
  },

  // Analytics Tools - Kansofy admins only (requires tool:analytics)
  get_daily_summary: {
    name: 'get_daily_summary',
    requiredScopes: ['tool:analytics'],
    adminOnly: true,
    category: 'analytics',
  },
  get_volume_trends: {
    name: 'get_volume_trends',
    requiredScopes: ['tool:analytics'],
    adminOnly: true,
    category: 'analytics',
  },
  get_cascade_metrics: {
    name: 'get_cascade_metrics',
    requiredScopes: ['tool:analytics'],
    adminOnly: true,
    category: 'analytics',
  },

  // ERP Tools - Full access (2 tools, removed get_customer_concentration)
  get_erp_summary: {
    name: 'get_erp_summary',
    requiredScopes: ['tool:erp'],
    adminOnly: false,
    category: 'erp-full',
  },
  get_late_deliveries: {
    name: 'get_late_deliveries',
    requiredScopes: ['tool:erp'], // Fixed: requires tool:erp (was incorrectly tool:email)
    adminOnly: false,
    category: 'erp-full',
  },

  // ERP Orders Tools - tool:erp OR tool:erp-orders (3 tools, added get_orders_by_customer)
  get_last_weeks_orders: {
    name: 'get_last_weeks_orders',
    requiredScopes: ['tool:erp', 'tool:erp-orders'], // OR logic
    adminOnly: false,
    category: 'erp-orders',
  },
  get_last_months_orders: {
    name: 'get_last_months_orders',
    requiredScopes: ['tool:erp', 'tool:erp-orders'], // OR logic
    adminOnly: false,
    category: 'erp-orders',
  },
  get_orders_by_customer: {
    name: 'get_orders_by_customer',
    requiredScopes: ['tool:erp', 'tool:erp-orders'], // OR logic
    adminOnly: false,
    category: 'erp-orders',
  },

  // Power Tools - Kansofy admins + lz@ + fh@ (requires tool:power or tool:*)
  execute_sql: {
    name: 'execute_sql',
    requiredScopes: ['tool:power'],
    adminOnly: true,
    category: 'power',
  },
};

/**
 * Authorization matrix: tool -> user -> expected result
 *
 * EXPECTED SERVER BEHAVIOR as of 2026-01-24.
 * This encodes the designed authorization outcome for each user/tool combination.
 *
 * User Scopes:
 * - vadim@kansofy.com, zikasaks@gmail.com, aiops@zueggcom.it: tool:* (Kansofy admins)
 * - lz@: tool:email, tool:document, tool:erp, tool:erp-orders, tool:power
 * - fh@: tool:email, tool:document, tool:erp, tool:erp-orders, tool:power
 * - sp@, info@: tool:email, tool:document, tool:erp-orders
 * - sr@, pa@, cz@, pb@: tool:email, tool:document, tool:erp-orders
 * - lg@, jz@: tool:email, tool:document
 */
export const AUTHORIZATION_MATRIX: Record<string, Record<string, AccessResult>> = {
  // ==================== SCHEMA TOOLS (Kansofy admins only) ====================
  get_tables: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_schema: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  describe_table: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },

  // ==================== PIPELINE TOOLS (Kansofy admins only) ====================
  get_pipeline_stats: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_stuck_emails: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_processing_queue: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_sync_status: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },

  // ==================== POWER TOOLS (Kansofy admins + lz@ + fh@) ====================
  execute_sql: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',  // has tool:power
    'fh@zueggcom.it': 'allowed',  // has tool:power (NEW)
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },

  // ==================== ERP FULL TOOLS (Kansofy admins + lz@ + fh@) ====================
  get_erp_summary: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',  // has tool:erp
    'fh@zueggcom.it': 'allowed',  // has tool:erp
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_late_deliveries: {
    // Fixed: requires tool:erp (same as get_erp_summary)
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',  // has tool:erp
    'fh@zueggcom.it': 'allowed',  // has tool:erp
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },

  // ==================== ERP ORDERS TOOLS (all except lg@, jz@) ====================
  get_last_weeks_orders: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',  // has tool:erp
    'fh@zueggcom.it': 'allowed',  // has tool:erp
    'sp@zueggcom.it': 'allowed',  // has tool:erp-orders (NEW)
    'info@zueggcom.it': 'allowed', // has tool:erp-orders (NEW)
    'sr@zueggcom.it': 'allowed',  // has tool:erp-orders
    'pa@zueggcom.it': 'allowed',  // has tool:erp-orders
    'cz@zueggcom.it': 'allowed',  // has tool:erp-orders
    'pb@zueggcom.it': 'allowed',  // has tool:erp-orders
    'lg@zueggcom.it': 'denied',   // viewer only
    'jz@zueggcom.it': 'denied',   // viewer only
  },
  get_last_months_orders: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_orders_by_customer: {
    // NEW tool - same access as other ERP orders tools
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },

  // ==================== DOCUMENT TOOLS (ALL users) ====================
  get_documents: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'allowed',
    'jz@zueggcom.it': 'allowed',
  },
  get_doc_types: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'allowed',
    'jz@zueggcom.it': 'allowed',
  },

  // ==================== EMAIL TOOLS (ALL users) ====================
  get_recent_emails: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'allowed',
    'jz@zueggcom.it': 'allowed',
  },
  get_email_by_id: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'allowed',
    'jz@zueggcom.it': 'allowed',
  },
  search_emails: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'allowed',
    'jz@zueggcom.it': 'allowed',
  },
  get_emails_by_sender: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'allowed',
    'fh@zueggcom.it': 'allowed',
    'sp@zueggcom.it': 'allowed',
    'info@zueggcom.it': 'allowed',
    'sr@zueggcom.it': 'allowed',
    'pa@zueggcom.it': 'allowed',
    'cz@zueggcom.it': 'allowed',
    'pb@zueggcom.it': 'allowed',
    'lg@zueggcom.it': 'allowed',
    'jz@zueggcom.it': 'allowed',
  },

  // ==================== ANALYTICS TOOLS (Kansofy admins only) ====================
  get_daily_summary: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_volume_trends: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
  get_cascade_metrics: {
    'vadim@kansofy.com': 'allowed',
    'zikasaks@gmail.com': 'allowed',
    'aiops@zueggcom.it': 'allowed',
    'lz@zueggcom.it': 'denied',
    'fh@zueggcom.it': 'denied',
    'sp@zueggcom.it': 'denied',
    'info@zueggcom.it': 'denied',
    'sr@zueggcom.it': 'denied',
    'pa@zueggcom.it': 'denied',
    'cz@zueggcom.it': 'denied',
    'pb@zueggcom.it': 'denied',
    'lg@zueggcom.it': 'denied',
    'jz@zueggcom.it': 'denied',
  },
};

// Tool counts by category
export const TOOL_CATEGORIES = {
  schema: ['get_tables', 'get_schema', 'describe_table'],
  email: ['get_recent_emails', 'get_email_by_id', 'search_emails', 'get_emails_by_sender'],
  pipeline: ['get_pipeline_stats', 'get_stuck_emails', 'get_processing_queue', 'get_sync_status'],
  document: ['get_documents', 'get_doc_types'],
  analytics: ['get_daily_summary', 'get_volume_trends', 'get_cascade_metrics'],
  'erp-full': ['get_erp_summary', 'get_late_deliveries'],
  'erp-orders': ['get_last_weeks_orders', 'get_last_months_orders', 'get_orders_by_customer'],
  power: ['execute_sql'],
};

export const ALL_TOOLS = Object.keys(TOOLS);
export const ADMIN_ONLY_TOOLS = ALL_TOOLS.filter((t) => TOOLS[t].adminOnly);
export const CUSTOMER_TOOLS = ALL_TOOLS.filter((t) => !TOOLS[t].adminOnly);

// All users in the matrix
export const ALL_MATRIX_USERS = [
  'vadim@kansofy.com',
  'zikasaks@gmail.com',
  'aiops@zueggcom.it',
  'lz@zueggcom.it',
  'fh@zueggcom.it',
  'sp@zueggcom.it',
  'info@zueggcom.it',
  'sr@zueggcom.it',
  'pa@zueggcom.it',
  'cz@zueggcom.it',
  'pb@zueggcom.it',
  'lg@zueggcom.it',
  'jz@zueggcom.it',
];

/**
 * Get minimal test arguments for a tool
 *
 * Provides just enough arguments to test authorization without causing
 * unnecessary errors from missing required parameters
 */
export function getToolTestArgs(toolName: string): Record<string, unknown> {
  const defaultArgs: Record<string, Record<string, unknown>> = {
    // Schema tools
    get_tables: {},
    get_schema: {},
    describe_table: { table_name: 'raw_emails_v6' },

    // Email tools
    get_recent_emails: { hours: 24, limit: 5 },
    get_email_by_id: { id: '00000000-0000-0000-0000-000000000000' }, // Will 404 but tests auth
    search_emails: { query: 'test', field: 'subject', limit: 5 },
    get_emails_by_sender: { sender_email: 'test@example.com', limit: 5 },

    // Pipeline tools
    get_pipeline_stats: {},
    get_stuck_emails: {},
    get_processing_queue: {},
    get_sync_status: {},

    // Document tools
    get_documents: { limit: 5 },
    get_doc_types: {},

    // Analytics tools
    get_daily_summary: {},
    get_volume_trends: {},
    get_cascade_metrics: {},

    // ERP tools
    get_erp_summary: {},
    get_late_deliveries: {},
    get_last_weeks_orders: {},
    get_last_months_orders: {},
    get_orders_by_customer: { customer_name: 'test' },

    // Power tools
    execute_sql: { query: 'SELECT 1' },
  };

  return defaultArgs[toolName] || {};
}
