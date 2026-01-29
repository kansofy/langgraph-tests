# LangGraph Tests

Comprehensive testing framework for L-Cascade V2.1 LangGraph pipelines.

## Overview

This test suite validates:
- **Coherence Validation** - 7 cross-layer consistency rules
- **Auto-Filter** - 3-tier email filtering with ERP allowlist bypass
- **Curing Service** - L9 Sonnet escalation for incoherent envelopes
- **Enrichment Service** - ERP, HubSpot, email history context
- **Email Summary** - Visibility tiers and HTML/text formatting

## Quick Start

```bash
# Create virtual environment
python3.13 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run unit tests (no external dependencies)
python -m pytest tests/unit/ -v

# Run integration tests (requires SSH tunnel)
ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
python -m pytest tests/integration/ -v

# Run all tests with report
python -m harness.runner --all --report
```

## Test Structure

```
langgraph-tests/
├── tests/
│   ├── unit/                    # Fast, isolated tests
│   │   ├── test_coherence_validator.py
│   │   ├── test_email_summary_visibility.py
│   │   └── test_email_summary_formatters.py
│   ├── integration/             # DEV database tests
│   │   ├── test_auto_filter_integration.py
│   │   ├── test_curing_integration.py
│   │   ├── test_coherence_integration.py
│   │   ├── test_enrichment_integration.py
│   │   ├── test_hubspot_integration.py
│   │   └── test_email_summary_integration.py
│   └── e2e/                     # Full pipeline tests
│       └── test_full_cascade.py
├── harness/
│   ├── runner.py                # CLI test runner
│   ├── fixtures.py              # DEV database fixtures
│   ├── metrics_collector.py     # Pass/fail, tokens, cost
│   └── report_generator.py      # HTML/JSON reports
├── fixtures/                    # Test data files
├── docs/                        # Test documentation
└── reports/                     # Generated reports
```

## Prerequisites

### SSH Tunnel to DEV

Integration and E2E tests require access to the DEV database:

```bash
ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
```

### Environment Variables

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `DEV_POSTGRES_DSN` - DEV database connection
- `ANTHROPIC_API_KEY` - For Sonnet curing tests (optional)
- `RUN_EXPENSIVE_TESTS` - Set to `true` to run Sonnet tests

## Test Runner

```bash
# Unit tests only (fast)
python -m harness.runner --unit

# Integration tests
python -m harness.runner --integration

# E2E tests
python -m harness.runner --e2e

# All tests
python -m harness.runner --all

# With HTML/JSON reports
python -m harness.runner --all --report

# Include expensive (Sonnet) tests
RUN_EXPENSIVE_TESTS=true python -m harness.runner --all --expensive
```

## Quality Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Coherence rate | ≥70% | L-Cascade output quality |
| Auto-filter FP rate | ≤10% | False positives on business emails |
| ERP bypass rate | 100% | Known customers always pass |
| CRITICAL issues | <10% | Severe coherence failures |

## Test Categories

### Unit Tests (~180 tests)
- `test_coherence_validator.py` - 7 validation rules (64 tests)
- `test_email_summary_visibility.py` - Visibility tiers (22 tests)
- `test_email_summary_formatters.py` - HTML/text formatting (38 tests)
- Plus existing auto_filter and curing_service tests

### Integration Tests (~100 tests)
- Real DEV database queries
- Actual LangGraph component testing
- @expensive marker for Sonnet API calls

### E2E Tests (~20 tests)
- Full pipeline flow validation
- Quality threshold enforcement
- Pipeline metrics reporting

## Reports

After running with `--report`, find reports in `reports/`:
- `v21_test_report_YYYYMMDD_HHMMSS.html` - Visual HTML report
- `v21_test_report_YYYYMMDD_HHMMSS.json` - Machine-readable JSON
- `v21_test_report.html` - Symlink to latest

## Development

### Adding New Tests

1. Place unit tests in `tests/unit/`
2. Place integration tests in `tests/integration/`
3. Use `@requires_tunnel` marker for DB-dependent tests
4. Use `@expensive` marker for API-calling tests

### Test Fixtures

Common fixtures in `harness/fixtures.py`:
- `dev_db_connection` - Database connection
- `fresh_emails_48h` - Recent emails from sp@ mailbox
- `business_emails` - Filtered business emails
- `envelopes_with_full_cascade` - L9-complete data
- `erp_customer_domains` - ERP allowlist

## License

Internal - Kansofy Inc.
