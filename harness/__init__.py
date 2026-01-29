"""
LangGraph Test Harness

Provides fixtures, metrics collection, and reporting for L-Cascade V2.1 tests.

Usage:
    python -m harness.runner --all --report
"""

from .fixtures import (
    dev_db_connection,
    dev_db_cursor,
    fresh_emails_24h,
    fresh_emails_48h,
    business_emails,
    automated_emails,
    envelopes_with_full_cascade,
    erp_customer_domains,
    requires_tunnel,
    expensive,
)

from .metrics_collector import (
    MetricsCollector,
    get_metrics_collector,
    reset_metrics_collector,
)

from .report_generator import (
    generate_html_report,
    generate_json_report,
    generate_console_report,
)

__all__ = [
    # Fixtures
    'dev_db_connection',
    'dev_db_cursor',
    'fresh_emails_24h',
    'fresh_emails_48h',
    'business_emails',
    'automated_emails',
    'envelopes_with_full_cascade',
    'erp_customer_domains',
    'requires_tunnel',
    'expensive',
    # Metrics
    'MetricsCollector',
    'get_metrics_collector',
    'reset_metrics_collector',
    # Reports
    'generate_html_report',
    'generate_json_report',
    'generate_console_report',
]
