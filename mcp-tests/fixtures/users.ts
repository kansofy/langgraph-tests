/**
 * Test Users for MCP E2E Testing
 *
 * Based on mcp.email_summary_visibility table from DEV database
 * Updated: 2026-01-24
 */

export interface TestUser {
  email: string;
  name: string;
  accessTier: 'all' | 'team' | 'self' | 'admin';
  teamMailboxes: string[];
  expectedEmailCount: {
    min: number;
    max: number;
  };
  expectedScopes: string[];
  hasErpAccess: boolean;
  hasErpOrdersOnly: boolean;
}

export const TEST_USERS: Record<string, TestUser> = {
  // ==================== KANSOFY ADMINS ====================

  // Kansofy Admin - Full access
  'vadim@kansofy.com': {
    email: 'vadim@kansofy.com',
    name: 'Vadim Linchevsky',
    accessTier: 'admin',
    teamMailboxes: ['sp', 'info', 'sr', 'fh', 'lg', 'pa', 'jz', 'cz', 'pb', 'sales', 'lz'],
    expectedEmailCount: { min: 4500, max: 5500 },
    expectedScopes: ['tool:*', 'prompt:*'],
    hasErpAccess: true,
    hasErpOrdersOnly: false,
  },

  // Kansofy Admin - Full access
  'zikasaks@gmail.com': {
    email: 'zikasaks@gmail.com',
    name: 'Zika Saks',
    accessTier: 'admin',
    teamMailboxes: ['sp', 'info', 'sr', 'fh', 'lg', 'pa', 'jz', 'cz', 'pb', 'sales', 'lz'],
    expectedEmailCount: { min: 4500, max: 5500 },
    expectedScopes: ['tool:*', 'prompt:*'],
    hasErpAccess: true,
    hasErpOrdersOnly: false,
  },

  // AiOps Service Account - Full access
  'aiops@zueggcom.it': {
    email: 'aiops@zueggcom.it',
    name: 'AiOps Service',
    accessTier: 'admin',
    teamMailboxes: ['sp', 'info', 'sr', 'fh', 'lg', 'pa', 'jz', 'cz', 'pb', 'sales', 'lz'],
    expectedEmailCount: { min: 4500, max: 5500 },
    expectedScopes: ['tool:*', 'prompt:*'],
    hasErpAccess: true,
    hasErpOrdersOnly: false,
  },

  // ==================== ZUEGG USERS ====================

  // Zuegg Admin - Full Zuegg access (no schema/pipeline/analytics)
  'lz@zueggcom.it': {
    email: 'lz@zueggcom.it',
    name: 'Luca Zuegg',
    accessTier: 'all',
    teamMailboxes: ['sp', 'info', 'sr', 'fh', 'lg', 'pa', 'jz', 'cz', 'pb', 'sales', 'lz'],
    expectedEmailCount: { min: 4500, max: 5500 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp', 'tool:erp-orders', 'tool:power', 'prompt:analyst'],
    hasErpAccess: true,
    hasErpOrdersOnly: false,
  },

  // Team Lead - Extended team access (6 mailboxes), has ERP + SQL access
  'fh@zueggcom.it': {
    email: 'fh@zueggcom.it',
    name: 'Franziska Hillebrand',
    accessTier: 'team',
    teamMailboxes: ['fh', 'sales', 'pa', 'pb', 'cz', 'sr'],
    expectedEmailCount: { min: 3200, max: 3900 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp', 'tool:erp-orders', 'tool:power', 'prompt:analyst'],
    hasErpAccess: true,
    hasErpOrdersOnly: false,
  },

  // Admin Support - Limited team access (2 mailboxes), has ERP orders
  'sp@zueggcom.it': {
    email: 'sp@zueggcom.it',
    name: 'Steffi Runggaldier',
    accessTier: 'team',
    teamMailboxes: ['sp', 'info'],
    expectedEmailCount: { min: 150, max: 250 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp-orders', 'prompt:analyst'],
    hasErpAccess: false,
    hasErpOrdersOnly: true,
  },

  // Info mailbox handler - Stefi
  'info@zueggcom.it': {
    email: 'info@zueggcom.it',
    name: 'Stefi',
    accessTier: 'team',
    teamMailboxes: ['info', 'sp'],
    expectedEmailCount: { min: 100, max: 200 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp-orders', 'prompt:analyst'],
    hasErpAccess: false,
    hasErpOrdersOnly: true,
  },

  // Sales Rep - Self only with ERP orders access
  'sr@zueggcom.it': {
    email: 'sr@zueggcom.it',
    name: 'Stefan Rauch',
    accessTier: 'self',
    teamMailboxes: ['sr'],
    expectedEmailCount: { min: 140, max: 200 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp-orders'],
    hasErpAccess: false,
    hasErpOrdersOnly: true,
  },

  // Sales Rep - Self only with ERP orders access
  'pa@zueggcom.it': {
    email: 'pa@zueggcom.it',
    name: 'Peter Aigner',
    accessTier: 'self',
    teamMailboxes: ['pa'],
    expectedEmailCount: { min: 30, max: 50 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp-orders'],
    hasErpAccess: false,
    hasErpOrdersOnly: true,
  },

  // Sales Rep - Self only with ERP orders access
  'cz@zueggcom.it': {
    email: 'cz@zueggcom.it',
    name: 'Christian Zuegg',
    accessTier: 'self',
    teamMailboxes: ['cz'],
    expectedEmailCount: { min: 1300, max: 1500 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp-orders'],
    hasErpAccess: false,
    hasErpOrdersOnly: true,
  },

  // Sales Rep - Self only with ERP orders access
  'pb@zueggcom.it': {
    email: 'pb@zueggcom.it',
    name: 'Paolo Bianchi',
    accessTier: 'self',
    teamMailboxes: ['pb'],
    expectedEmailCount: { min: 1500, max: 1800 },
    expectedScopes: ['tool:email', 'tool:document', 'tool:erp-orders'],
    hasErpAccess: false,
    hasErpOrdersOnly: true,
  },

  // Viewer - Self only, no ERP orders
  'lg@zueggcom.it': {
    email: 'lg@zueggcom.it',
    name: 'Lorenzo Gorfer',
    accessTier: 'self',
    teamMailboxes: ['lg'],
    expectedEmailCount: { min: 600, max: 750 },
    expectedScopes: ['tool:email', 'tool:document'],
    hasErpAccess: false,
    hasErpOrdersOnly: false,
  },

  // Viewer - Self only, no ERP orders
  'jz@zueggcom.it': {
    email: 'jz@zueggcom.it',
    name: 'Julia Zuegg',
    accessTier: 'self',
    teamMailboxes: ['jz'],
    expectedEmailCount: { min: 40, max: 70 },
    expectedScopes: ['tool:email', 'tool:document'],
    hasErpAccess: false,
    hasErpOrdersOnly: false,
  },
};

// Convenience groupings
export const USERS_BY_TIER = {
  admin: ['vadim@kansofy.com', 'zikasaks@gmail.com', 'aiops@zueggcom.it'],
  all: ['lz@zueggcom.it'],
  team: ['fh@zueggcom.it', 'sp@zueggcom.it', 'info@zueggcom.it'],
  self: ['sr@zueggcom.it', 'pa@zueggcom.it', 'cz@zueggcom.it', 'pb@zueggcom.it', 'lg@zueggcom.it', 'jz@zueggcom.it'],
};

// Kansofy admins have tool:* (full system access)
export const KANSOFY_ADMINS = ['vadim@kansofy.com', 'zikasaks@gmail.com', 'aiops@zueggcom.it'];

// Users with tool:power (execute_sql access)
export const POWER_USERS = [...KANSOFY_ADMINS, 'lz@zueggcom.it', 'fh@zueggcom.it'];

// Users with tool:erp (full ERP access)
export const ERP_FULL_USERS = [...KANSOFY_ADMINS, 'lz@zueggcom.it', 'fh@zueggcom.it'];

// Users with tool:erp-orders (basic orders access)
export const ERP_ORDERS_USERS = [...ERP_FULL_USERS, 'sp@zueggcom.it', 'info@zueggcom.it', 'sr@zueggcom.it', 'pa@zueggcom.it', 'cz@zueggcom.it', 'pb@zueggcom.it'];

// Sales reps (self-access with ERP orders)
export const SALES_REPS = ['sr@zueggcom.it', 'pa@zueggcom.it', 'cz@zueggcom.it', 'pb@zueggcom.it'];

// Viewers (no ERP access at all)
export const VIEWERS = ['lg@zueggcom.it', 'jz@zueggcom.it'];

// All Zuegg users
export const ZUEGG_USERS = ['lz@zueggcom.it', 'fh@zueggcom.it', 'sp@zueggcom.it', 'info@zueggcom.it', 'sr@zueggcom.it', 'pa@zueggcom.it', 'cz@zueggcom.it', 'pb@zueggcom.it', 'lg@zueggcom.it', 'jz@zueggcom.it'];

// All users
export const ALL_USERS = [...KANSOFY_ADMINS, ...ZUEGG_USERS];

// Backwards compatibility exports (tests reference these)
export const ADMIN_USERS = ['lz@zueggcom.it'];  // Zuegg admin (not Kansofy admins)
export const NON_ERP_USERS = VIEWERS;  // Users with no ERP access

/**
 * Get password for test user from environment
 */
export function getUserPassword(email: string): string {
  const key = email.split('@')[0].toUpperCase();
  const password = process.env[`TEST_USER_${key}_PASSWORD`];
  if (!password) {
    throw new Error(`Missing password for ${email}. Set TEST_USER_${key}_PASSWORD env var.`);
  }
  return password;
}
