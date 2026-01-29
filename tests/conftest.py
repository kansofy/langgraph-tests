"""
LangGraph Tests - Pytest Configuration

Imports all fixtures from the harness for use in tests.
Adds airflow-pipelines to path for lcascade imports.
"""

import sys
from pathlib import Path

# Add harness to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Add airflow-pipelines to path for lcascade imports
AIRFLOW_PIPELINES_PATH = Path.home() / 'zueggcom' / 'airflow-pipelines-gitlab'
if AIRFLOW_PIPELINES_PATH.exists():
    sys.path.insert(0, str(AIRFLOW_PIPELINES_PATH))

# Import all fixtures from harness
from harness.fixtures import (
    dev_db_connection,
    dev_db_cursor,
    fresh_emails_24h,
    fresh_emails_48h,
    automated_emails,
    business_emails,
    envelopes_with_full_cascade,
    incoherent_envelopes,
    erp_customer_domains,
    sample_erp_customers,
    sample_coherent_cascade,
    sample_incoherent_cascade,
    v21_data_loader,
    requires_tunnel,
    expensive,
)

# Make fixtures available to pytest
__all__ = [
    'dev_db_connection',
    'dev_db_cursor',
    'fresh_emails_24h',
    'fresh_emails_48h',
    'automated_emails',
    'business_emails',
    'envelopes_with_full_cascade',
    'incoherent_envelopes',
    'erp_customer_domains',
    'sample_erp_customers',
    'sample_coherent_cascade',
    'sample_incoherent_cascade',
    'v21_data_loader',
    'requires_tunnel',
    'expensive',
]
