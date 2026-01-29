# MCP E2E Tests

Comprehensive end-to-end testing framework for the Kansofy MCP server.

## Overview

This test suite validates:
- **OAuth 2.1 PKCE authentication** for all 9 users
- **Tool authorization matrix** (23 tools × 9 users = 207 tests)
- **Row-level data filtering** (users only see their authorized data)
- **Real-world workflows** (sales rep, admin, viewer)

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with MCP base URL and user passwords

# Run all tests
npm test

# Run specific test suites
npm run test:oauth    # OAuth flow tests
npm run test:matrix   # Tool authorization matrix
npm run test:all      # All tests with verbose output
```

## Test Structure

```
mcp-e2e-tests/
├── fixtures/
│   ├── users.ts           # 9 test users with expected data
│   ├── tool-matrix.ts     # 23 tools × 9 users authorization matrix
│   └── expected-data.ts   # Expected counts from DEV database
├── helpers/
│   ├── oauth-client.ts    # OAuth 2.1 PKCE implementation
│   ├── mcp-client.ts      # MCP JSON-RPC client
│   └── recorder.ts        # JSON recording utility
├── tests/
│   ├── oauth/
│   │   ├── oauth-flow.test.ts      # Full PKCE authentication
│   │   └── token-refresh.test.ts   # Token refresh tests
│   ├── rbac/
│   │   ├── tool-matrix.test.ts     # Authorization matrix tests
│   │   └── data-access.test.ts     # Row-level filtering
│   └── workflows/
│       ├── sales-workflow.test.ts  # Sales rep daily workflow
│       ├── admin-workflow.test.ts  # Admin oversight workflow
│       └── viewer-workflow.test.ts # Limited user workflow
├── recordings/                      # JSON recordings output
├── setup.ts                         # Global test setup
└── vitest.config.ts                 # Vitest configuration
```

## Test Users

| User | Tier | Mailboxes | ERP Access |
|------|------|-----------|------------|
| lz@zueggcom.it | all | 11 (all) | Full |
| fh@zueggcom.it | team | 6 | None |
| sp@zueggcom.it | team | 2 | None |
| sr@zueggcom.it | self | 1 | Orders only |
| lg@zueggcom.it | self | 1 | None |
| pa@zueggcom.it | self | 1 | Orders only |
| jz@zueggcom.it | self | 1 | None |
| cz@zueggcom.it | self | 1 | Orders only |
| pb@zueggcom.it | self | 1 | Orders only |

## Environment Variables

```env
# MCP Server URL
MCP_BASE_URL=https://dev-mcp.kansofy.com

# User passwords (set for each user you want to test)
TEST_USER_LZ_PASSWORD=...
TEST_USER_FH_PASSWORD=...
TEST_USER_SP_PASSWORD=...
TEST_USER_SR_PASSWORD=...
TEST_USER_LG_PASSWORD=...
TEST_USER_PA_PASSWORD=...
TEST_USER_JZ_PASSWORD=...
TEST_USER_CZ_PASSWORD=...
TEST_USER_PB_PASSWORD=...
```

## JSON Recordings

Every test run generates a JSON recording in `recordings/`:

```json
{
  "sessionId": "tool-matrix-1706012345-abc123",
  "testSuite": "tool-matrix",
  "startedAt": "2026-01-23T10:00:00.000Z",
  "completedAt": "2026-01-23T10:05:00.000Z",
  "summary": {
    "totalTests": 207,
    "passed": 205,
    "failed": 2,
    "authorizationFailures": 1,
    "dataValidationFailures": 1
  },
  "records": [
    {
      "timestamp": "...",
      "tool": "get_recent_emails",
      "user": "sr@zueggcom.it",
      "userScopes": ["tool:email", "tool:erp-orders"],
      "input": { "hours": 24, "limit": 20 },
      "output": {
        "success": true,
        "duration": 234
      },
      "authorization": {
        "expected": "allowed",
        "actual": "allowed",
        "match": true
      }
    }
  ]
}
```

## Expected Test Counts

| Suite | Tests |
|-------|-------|
| OAuth Flow | 36 (4 tests × 9 users) |
| Token Refresh | 9 |
| Tool Matrix | 207 (23 tools × 9 users) |
| Data Access | ~50 |
| Workflows | ~45 |
| **Total** | ~350 |

## Running Against DEV

Tests run against the dev MCP server by default:

```bash
MCP_BASE_URL=https://dev-mcp.kansofy.com npm test
```

No changes are made to the dev server - tests only make read operations via HTTP.

## CI/CD Integration

Add to your CI pipeline:

```yaml
test:e2e:
  script:
    - npm ci
    - npm test
  artifacts:
    paths:
      - recordings/*.json
    when: always
```

## Debugging

```bash
# Run single test file
npx vitest run tests/oauth/oauth-flow.test.ts

# Run with debug output
DEBUG=* npm test

# Run specific user tests
npx vitest -t "sr@zueggcom.it"
```

## License

Internal - Kansofy Inc.
