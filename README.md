# Kansofy Test Framework

Comprehensive testing framework for Kansofy infrastructure:
- **LangGraph Tests** (Python) - L-Cascade V2.1 pipeline validation
- **MCP E2E Tests** (TypeScript) - OAuth, RBAC, and tool authorization

## Quick Start

### LangGraph Tests (Python)

```bash
# Setup
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run unit tests (no external dependencies)
python -m pytest tests/unit/ -v

# Run integration tests (requires SSH tunnel)
ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
python -m pytest tests/integration/ -v

# Run all with report
python -m harness.runner --all --report
```

### MCP E2E Tests (TypeScript)

```bash
cd mcp-tests
npm install
cp .env.example .env  # Configure credentials
npm test
```

## Directory Structure

```
langgraph-tests/
├── tests/                    # LangGraph Python tests
│   ├── unit/                 # Fast isolated tests
│   ├── integration/          # DEV database tests
│   └── e2e/                  # Full pipeline tests
├── harness/                  # Python test harness
│   ├── fixtures.py           # DEV DB fixtures
│   ├── metrics_collector.py  # Pass/fail tracking
│   ├── report_generator.py   # HTML/JSON reports
│   └── runner.py            # CLI runner
├── mcp-tests/               # MCP TypeScript tests
│   ├── tests/
│   │   ├── oauth/           # OAuth 2.1 PKCE tests
│   │   ├── rbac/            # Authorization matrix
│   │   └── workflows/       # Real-world workflows
│   ├── fixtures/            # Test users & expected data
│   └── helpers/             # OAuth & MCP clients
└── reports/                 # Generated reports
```

## LangGraph Test Suites

### Unit Tests (~180 tests)
- **Coherence Validator** - 7 cross-layer validation rules
- **Email Summary** - Visibility tiers and HTML/text formatting
- **Auto-Filter** - 3-tier filtering with ERP allowlist bypass
- **Curing Service** - L9 Sonnet escalation logic

### Integration Tests (~100 tests)
- Real DEV database queries via SSH tunnel
- Actual LangGraph component testing
- `@expensive` marker for Sonnet API calls

### Quality Thresholds
| Metric | Threshold |
|--------|-----------|
| Coherence rate | ≥70% |
| Auto-filter FP rate | ≤10% |
| ERP bypass rate | 100% |

## MCP Test Suites

### OAuth Flow (~36 tests)
- Full PKCE authentication for all 9 users
- Token refresh and expiration handling

### Tool Authorization Matrix (~207 tests)
- 23 tools × 9 users authorization validation
- Row-level data filtering verification

### Test Users
| User | Tier | Mailboxes | ERP Access |
|------|------|-----------|------------|
| lz@zueggcom.it | all | 11 | Full |
| fh@zueggcom.it | team | 6 | None |
| sp@zueggcom.it | team | 2 | None |
| sr@zueggcom.it | self | 1 | Orders only |

## Prerequisites

### SSH Tunnel to DEV (LangGraph tests)
```bash
ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
```

### Environment Variables

**LangGraph (.env):**
```env
DEV_POSTGRES_DSN=postgresql://airflow:airflow@localhost:5433/kansofy_data
ANTHROPIC_API_KEY=sk-ant-...
RUN_EXPENSIVE_TESTS=false
```

**MCP (mcp-tests/.env):**
```env
MCP_BASE_URL=https://dev-mcp.kansofy.com
TEST_USER_LZ_PASSWORD=...
TEST_USER_SP_PASSWORD=...
```

## CI/CD

```yaml
test:
  script:
    # LangGraph tests
    - python -m pytest tests/unit/ -v

    # MCP tests (if credentials configured)
    - cd mcp-tests && npm ci && npm test
  artifacts:
    paths:
      - reports/
      - mcp-tests/recordings/
```

## Reports

- **LangGraph**: `reports/langgraph_test_report.html`
- **MCP**: `mcp-tests/recordings/*.json`

## License

Internal - Kansofy Inc.
