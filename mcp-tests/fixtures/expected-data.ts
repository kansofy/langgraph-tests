/**
 * Expected Data for Test Validation
 *
 * Based on DEV database queries from 2026-01-23
 */

export const EXPECTED_DATA = {
  // Email statistics
  email: {
    totalCount: 5000,
    dateRange: {
      earliest: '2023-02-01',
      latest: '2026-01-14',
    },
    byMailbox: {
      'pb@zueggcom.it': 1629,
      'cz@zueggcom.it': 1390,
      'lg@zueggcom.it': 668,
      'lz@zueggcom.it': 542,
      'fh@zueggcom.it': 315,
      'sr@zueggcom.it': 167,
      'info@zueggcom.it': 115,
      'sp@zueggcom.it': 73,
      'jz@zueggcom.it': 51,
      'pa@zueggcom.it': 37,
      'sales@zueggcom.it': 13,
    } as Record<string, number>,
    topSenders: [
      { email: 'cz@zueggcom.it', count: 1164 },
      { email: 'fh@zueggcom.it', count: 336 },
      { email: 'pa@zueggcom.it', count: 304 },
      { email: 'lheno@aromatech.fr', count: 263 },
      { email: 'noreply@notifications.hubspot.com', count: 249 },
    ],
  },

  // ERP statistics
  erp: {
    totalOrders: 4636,
    dateRange: {
      earliest: '2023-01-02',
      latest: '2025-12-30',
    },
    byYear: {
      2023: 1531,
      2024: 1610,
      2025: 1495,
    },
    byOrderType: {
      DL: 4231,
      VK: 405,
    },
    topCustomers: [
      { name: 'Sterilgarda Alimentari SpA', total: 11880039.35 },
      { name: 'Hermann Pfanner Getränke GmbH', total: 11386142.76 },
      { name: 'Henglein GmbH & Co. KG', total: 7382142.86 },
      { name: 'Zentis Fruchtwelt GmbH & Co. KG', total: 5089468.13 },
      { name: 'Parmalat Spa', total: 3503911.80 },
    ],
    topSuppliers: [
      { name: 'Aromatech SAS', count: 3043 },
      { name: 'Flagfood AG', count: 458 },
      { name: 'Iprona Lana SpA', count: 380 },
      { name: 'La Doria SpA', count: 243 },
      { name: 'RAPS GmbH & Co.KG', count: 138 },
    ],
  },

  // Document statistics (currently empty on DEV)
  documents: {
    totalCount: 0,
  },

  // Sample email IDs for specific mailbox testing
  sampleEmails: {
    'sp@zueggcom.it': [
      { id: '2cfe77ee-1571-4c1f-b4d5-aa176e4e28d2', from: 'sr@zueggcom.it', subject: 'I: PR 1351' },
      { id: '1cb80dc5-269f-4eb0-9df2-ed8ffcc749c4', from: 'noreply@dhl.com', subject: 'PR 1691' },
    ],
    'info@zueggcom.it': [
      { id: '707ec976-4bc8-4c81-bce2-45f8c6895a63', from: 'safiri@aromatech.fr', subject: 'RE: Auftragsbestätigung 4503459883' },
    ],
    'fh@zueggcom.it': [
      { id: '1357821a-705c-4c5e-8271-dedca0062091', from: 'hallo@foerderfactory.com', subject: 'Einladung zum Fördertalk' },
    ],
  },

  // User visibility configuration (from mcp.email_summary_visibility)
  userVisibility: {
    'lz@zueggcom.it': { tier: 'all', mailboxes: 11 },
    'fh@zueggcom.it': { tier: 'team', mailboxes: 6 },
    'sp@zueggcom.it': { tier: 'team', mailboxes: 2 },
    'sr@zueggcom.it': { tier: 'self', mailboxes: 1 },
    'lg@zueggcom.it': { tier: 'self', mailboxes: 1 },
    'pa@zueggcom.it': { tier: 'self', mailboxes: 1 },
    'jz@zueggcom.it': { tier: 'self', mailboxes: 1 },
    'cz@zueggcom.it': { tier: 'self', mailboxes: 1 },
    'pb@zueggcom.it': { tier: 'self', mailboxes: 1 },
  } as Record<string, { tier: string; mailboxes: number }>,
};

/**
 * Calculate expected email count for a user based on their mailboxes
 */
export function getExpectedEmailCount(userEmail: string): { min: number; max: number } {
  const visibility = EXPECTED_DATA.userVisibility[userEmail];
  if (!visibility) {
    return { min: 0, max: 0 };
  }

  if (visibility.tier === 'all') {
    return { min: 4500, max: 5500 };
  }

  // For team/self, sum up their mailboxes
  // This is an approximation - actual tests will verify
  const byMailbox = EXPECTED_DATA.email.byMailbox;
  let total = 0;

  if (visibility.tier === 'team') {
    // Team users have specific mailboxes
    if (userEmail === 'fh@zueggcom.it') {
      total = byMailbox['fh@zueggcom.it'] + byMailbox['sales@zueggcom.it'] +
              byMailbox['pa@zueggcom.it'] + byMailbox['pb@zueggcom.it'] +
              byMailbox['cz@zueggcom.it'] + byMailbox['sr@zueggcom.it'];
    } else if (userEmail === 'sp@zueggcom.it') {
      total = byMailbox['sp@zueggcom.it'] + byMailbox['info@zueggcom.it'];
    }
  } else {
    // Self users only see their own mailbox
    total = byMailbox[userEmail] || 0;
  }

  // Allow 20% variance for data changes
  return { min: Math.floor(total * 0.8), max: Math.ceil(total * 1.2) };
}
