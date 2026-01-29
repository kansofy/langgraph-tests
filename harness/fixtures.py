"""
LangGraph Test Fixtures

Provides fixtures for:
- DEV database connection via SSH tunnel
- Fresh emails from sp@ mailbox (24h, 48h)
- Automated vs business email categorization
- Envelopes with full cascade data
- ERP allowlist domains

Prerequisites:
    SSH tunnel: ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
    Environment: DEV_POSTGRES_DSN (optional, defaults to tunnel DSN)
"""

import os
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from dotenv import load_dotenv

# Load environment
load_dotenv()
load_dotenv(Path.home() / '.env')

# Default DSN for DEV droplet via SSH tunnel
DEV_DEFAULT_DSN = 'postgresql://airflow:airflow@localhost:5433/kansofy_data'

# sp@ mailbox used for testing
SP_MAILBOX = 'sp@zueggcom.it'


def get_dev_dsn() -> str:
    """Get DEV database connection string."""
    return os.environ.get('DEV_POSTGRES_DSN', DEV_DEFAULT_DSN)


def check_ssh_tunnel() -> bool:
    """Check if SSH tunnel to DEV is active."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('localhost', 5433))
        sock.close()
        return result == 0
    except Exception:
        return False


# =============================================================================
# DATABASE FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def dev_db_connection():
    """
    Session-scoped connection to DEV database.

    Requires SSH tunnel:
        ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
    """
    if not check_ssh_tunnel():
        pytest.skip(
            "SSH tunnel to DEV not active. Run: "
            "ssh -f -N -L 5433:localhost:5434 root@165.232.86.131"
        )

    dsn = get_dev_dsn()
    try:
        conn = psycopg2.connect(dsn, connect_timeout=5)
        yield conn
        conn.close()
    except psycopg2.OperationalError as e:
        pytest.skip(f"DEV database connection failed: {e}")


@pytest.fixture(scope="session")
def dev_db_cursor(dev_db_connection):
    """Session-scoped cursor with dict rows."""
    return dev_db_connection.cursor(cursor_factory=RealDictCursor)


# =============================================================================
# EMAIL FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def fresh_emails_24h(dev_db_cursor) -> List[Dict[str, Any]]:
    """
    Get emails from sp@ mailbox received in the last 24 hours.

    Returns list of raw_emails_v6 records.
    """
    dev_db_cursor.execute("""
        SELECT
            id, message_id, sender_email, sender_name,
            subject, received_at, has_attachments,
            body_preview, mailbox
        FROM raw_emails_v6
        WHERE mailbox = %s
        AND received_at >= NOW() - INTERVAL '24 hours'
        ORDER BY received_at DESC
    """, (SP_MAILBOX,))

    emails = [dict(row) for row in dev_db_cursor.fetchall()]
    if not emails:
        pytest.skip("No fresh emails in last 24 hours")
    return emails


@pytest.fixture(scope="session")
def fresh_emails_48h(dev_db_cursor) -> List[Dict[str, Any]]:
    """
    Get emails from sp@ mailbox received in the last 48 hours.

    Returns list of raw_emails_v6 records.
    """
    dev_db_cursor.execute("""
        SELECT
            id, message_id, sender_email, sender_name,
            subject, received_at, has_attachments,
            body_preview, mailbox
        FROM raw_emails_v6
        WHERE mailbox = %s
        AND received_at >= NOW() - INTERVAL '48 hours'
        ORDER BY received_at DESC
    """, (SP_MAILBOX,))

    emails = [dict(row) for row in dev_db_cursor.fetchall()]
    if not emails:
        pytest.skip("No fresh emails in last 48 hours")
    return emails


@pytest.fixture(scope="session")
def automated_emails(fresh_emails_48h) -> List[Dict[str, Any]]:
    """
    Filter fresh emails to those likely automated/system emails.

    Based on sender patterns and subject patterns.
    """
    auto_sender_patterns = [
        'noreply', 'no-reply', 'postmaster', 'mailer-daemon',
        'notifications', 'alerts', 'system', 'automated',
    ]
    auto_domains = [
        'sidera.cloud', 'linkedin.com', 'booking.com', 'hubspot.com',
        'mailchimp.com', 'sendgrid.net',
    ]
    auto_subjects = [
        'quarantine', 'automatic reply', 'out of office',
        'delivery status', 'undeliverable', 'newsletter',
    ]

    automated = []
    for email in fresh_emails_48h:
        sender = (email.get('sender_email') or '').lower()
        subject = (email.get('subject') or '').lower()
        domain = sender.split('@')[-1] if '@' in sender else ''

        is_auto = (
            any(p in sender for p in auto_sender_patterns) or
            domain in auto_domains or
            any(p in subject for p in auto_subjects)
        )

        if is_auto:
            automated.append(email)

    return automated


@pytest.fixture(scope="session")
def business_emails(fresh_emails_48h, automated_emails) -> List[Dict[str, Any]]:
    """
    Filter fresh emails to business-relevant emails (not automated).

    These are emails that should go through L-Cascade processing.
    """
    auto_ids = {e['id'] for e in automated_emails}
    return [e for e in fresh_emails_48h if e['id'] not in auto_ids]


# =============================================================================
# ENVELOPE FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def envelopes_with_full_cascade(dev_db_cursor) -> List[Dict[str, Any]]:
    """
    Get envelopes that have completed full L9 cascade processing.

    Includes cascade data from L2-L9 tables.
    """
    dev_db_cursor.execute("""
        SELECT
            e.envelope_id, e.mail_subject, e.body_preview,
            e.from_email, e.mailbox, e.processing_state,
            e.created_at, e.updated_at,
            l2.intent as l2_intent,
            l2.sentiment as l2_sentiment,
            l2.routing_hint as l2_routing_hint,
            l5.urgency_score as l5_urgency_score,
            l7.complexity_score as l7_complexity_score,
            l7.est_minutes as l7_est_minutes,
            l7.suggested_owner as l7_suggested_owner,
            l9.executive_summary as l9_executive_summary,
            l9.recommended_priority as l9_priority,
            l9.confidence as l9_confidence
        FROM email_envelopes e
        LEFT JOIN l2_intent l2 ON e.envelope_id = l2.envelope_id
        LEFT JOIN l5_signals l5 ON e.envelope_id = l5.envelope_id
        LEFT JOIN l7_workload l7 ON e.envelope_id = l7.envelope_id
        LEFT JOIN l9_overview l9 ON e.envelope_id = l9.envelope_id
        WHERE e.processing_state = 'L9_complete'
        AND e.mailbox = %s
        ORDER BY e.updated_at DESC
        LIMIT 100
    """, (SP_MAILBOX,))

    envelopes = [dict(row) for row in dev_db_cursor.fetchall()]
    if not envelopes:
        pytest.skip("No L9-complete envelopes found")
    return envelopes


@pytest.fixture(scope="session")
def incoherent_envelopes(dev_db_cursor) -> List[Dict[str, Any]]:
    """
    Get envelopes that failed coherence validation.

    These are candidates for curing tests.
    """
    dev_db_cursor.execute("""
        SELECT
            cv.envelope_id, cv.coherence_score, cv.issue_count,
            cv.issues, cv.cascade_snapshot,
            cv.cure_attempt_count, cv.curing_exhausted,
            ee.mail_subject, ee.from_email
        FROM public.coherence_validation cv
        JOIN email_envelopes ee ON cv.envelope_id = ee.envelope_id
        WHERE cv.is_coherent = false
        AND cv.curing_exhausted = false
        ORDER BY cv.coherence_score ASC
        LIMIT 20
    """)

    envelopes = [dict(row) for row in dev_db_cursor.fetchall()]
    # Don't skip if empty - curing tests will handle this gracefully
    return envelopes


# =============================================================================
# ERP FIXTURES
# =============================================================================

@pytest.fixture(scope="session")
def erp_customer_domains(dev_db_cursor) -> Set[str]:
    """
    Get set of known customer domains from ERP unified_customers table.

    These domains should bypass auto-filter.
    """
    try:
        dev_db_cursor.execute("""
            SELECT DISTINCT LOWER(email_domain) as domain
            FROM erp.unified_customers
            WHERE email_domain IS NOT NULL
            AND is_active = TRUE
            LIMIT 500
        """)
        domains = {row['domain'] for row in dev_db_cursor.fetchall()}
        return domains
    except Exception:
        # ERP schema might not exist in all environments
        return set()


@pytest.fixture(scope="session")
def sample_erp_customers(dev_db_cursor) -> List[Dict[str, Any]]:
    """
    Get sample ERP customer records for enrichment testing.
    """
    try:
        dev_db_cursor.execute("""
            SELECT
                customer_number, company_name, email_domain,
                customer_tier, sales_rep_name, primary_type,
                is_active
            FROM erp.unified_customers
            WHERE is_active = TRUE
            LIMIT 10
        """)
        return [dict(row) for row in dev_db_cursor.fetchall()]
    except Exception:
        return []


# =============================================================================
# COHERENCE VALIDATION FIXTURES
# =============================================================================

@pytest.fixture
def sample_coherent_cascade() -> Dict[str, Any]:
    """Sample cascade data that should pass coherence validation."""
    return {
        'l2_intent': 'order',
        'l2_sentiment': 'neutral',
        'l2_routing_hint': 'sales',
        'l3_entities': [
            {'entity_type': 'order', 'entity_value': '12345'},
            {'entity_type': 'company', 'entity_value': 'Acme Corp'},
            {'entity_type': 'email', 'entity_value': 'john@acme.com'},
        ],
        'l4_sender_role': 'customer',
        'l4_sender_posture': 'requesting',
        'l5_urgency_score': 3,
        'l7_complexity_score': 3,
        'l7_est_minutes': 30,
        'l9_priority': 'medium',
        'l9_executive_summary': 'Customer requesting order status update for order #12345. Need to check delivery timeline.',
        'l9_action_items': [
            {'action': 'Check order #12345 status', 'priority': 'medium'},
        ],
    }


@pytest.fixture
def sample_incoherent_cascade() -> Dict[str, Any]:
    """Sample cascade data with coherence issues."""
    return {
        'l2_intent': 'complaint',
        'l2_sentiment': 'positive',  # Contradiction: complaint with positive sentiment
        'l2_routing_hint': 'management',
        'l3_entities': [
            {'entity_type': 'company', 'entity_value': 'Acme Corp'},
        ],
        'l4_sender_role': 'customer',
        'l4_sender_posture': 'confirming',  # Contradiction: complaint with confirming posture
        'l5_urgency_score': 5,  # High urgency
        'l7_complexity_score': 1,
        'l7_est_minutes': 5,  # Very low time for complexity 1
        'l9_priority': 'low',  # Mismatch: urgency 5 but low priority
        'l9_executive_summary': 'General inquiry.',  # Generic
        'l9_action_items': [
            {'action': 'Call customer', 'priority': 'low'},  # Ungrounded: no phone entity
        ],
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

class V21DataLoader:
    """Helper class to load V2.1 test data from DEV database."""

    def __init__(self, cursor):
        self.cur = cursor

    def get_coherence_stats(self) -> Dict[str, Any]:
        """Get coherence validation statistics."""
        self.cur.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_coherent THEN 1 ELSE 0 END) as coherent,
                SUM(CASE WHEN NOT is_coherent THEN 1 ELSE 0 END) as incoherent,
                AVG(coherence_score) as avg_score
            FROM public.coherence_validation
        """)
        return dict(self.cur.fetchone())

    def get_curing_stats(self) -> Dict[str, Any]:
        """Get curing service statistics."""
        self.cur.execute("""
            SELECT
                COUNT(*) as total_attempts,
                SUM(CASE WHEN is_coherent THEN 1 ELSE 0 END) as cured,
                SUM(CASE WHEN curing_exhausted THEN 1 ELSE 0 END) as exhausted
            FROM public.coherence_validation
            WHERE cure_attempt_count > 0
        """)
        return dict(self.cur.fetchone())

    def get_filter_stats(self) -> Dict[str, Any]:
        """Get auto-filter statistics from recent emails."""
        self.cur.execute("""
            SELECT
                COUNT(*) as total_emails,
                SUM(CASE WHEN auto_filter_result->>'should_skip' = 'true' THEN 1 ELSE 0 END) as filtered,
                SUM(CASE WHEN auto_filter_result->>'reason' = 'erp_allowlist' THEN 1 ELSE 0 END) as erp_bypass
            FROM raw_emails_v6
            WHERE auto_filter_result IS NOT NULL
            AND received_at >= NOW() - INTERVAL '7 days'
        """)
        row = self.cur.fetchone()
        return dict(row) if row else {'total_emails': 0, 'filtered': 0, 'erp_bypass': 0}

    def get_envelope_by_id(self, envelope_id: str) -> Optional[Dict[str, Any]]:
        """Get full envelope with cascade data."""
        self.cur.execute("""
            SELECT
                e.*, l2.*, l5.urgency_score as l5_urgency,
                l7.*, l9.*
            FROM email_envelopes e
            LEFT JOIN l2_intent l2 ON e.envelope_id = l2.envelope_id
            LEFT JOIN l5_signals l5 ON e.envelope_id = l5.envelope_id
            LEFT JOIN l7_workload l7 ON e.envelope_id = l7.envelope_id
            LEFT JOIN l9_overview l9 ON e.envelope_id = l9.envelope_id
            WHERE e.envelope_id = %s
        """, (envelope_id,))
        row = self.cur.fetchone()
        return dict(row) if row else None

    def get_l3_entities_for_envelope(self, envelope_id: str) -> List[Dict[str, Any]]:
        """Get L3 entities for an envelope."""
        self.cur.execute("""
            SELECT entity_type, entity_value, entity_context, confidence
            FROM l3_entities
            WHERE envelope_id = %s
        """, (envelope_id,))
        return [dict(row) for row in self.cur.fetchall()]

    def get_l9_action_items(self, envelope_id: str) -> List[Dict[str, Any]]:
        """Get L9 action items for an envelope."""
        self.cur.execute("""
            SELECT action, priority, owner, due_by, status
            FROM l9_action_items
            WHERE envelope_id = %s
        """, (envelope_id,))
        return [dict(row) for row in self.cur.fetchall()]


@pytest.fixture(scope="session")
def v21_data_loader(dev_db_cursor) -> V21DataLoader:
    """Data loader for V2.1 test data."""
    return V21DataLoader(dev_db_cursor)


# =============================================================================
# MARKERS FOR TEST CATEGORIZATION
# =============================================================================

# Mark expensive tests that call Sonnet/Opus
expensive = pytest.mark.skipif(
    os.environ.get('RUN_EXPENSIVE_TESTS', '').lower() not in ('true', '1', 'yes'),
    reason="Expensive test - requires RUN_EXPENSIVE_TESTS=true"
)

# Mark tests that require SSH tunnel
requires_tunnel = pytest.mark.skipif(
    not check_ssh_tunnel(),
    reason="Requires SSH tunnel to DEV: ssh -f -N -L 5433:localhost:5434 root@165.232.86.131"
)
