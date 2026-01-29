"""Unit tests for auto_filter module.

Tests the AutoFilterEngine which implements Tier 1 pre-L2 filtering
for automated email detection.
"""

import os
import pytest
from unittest.mock import patch

from lcascade.langgraph_common.auto_filter import (
    AutoFilterEngine,
    AutoFilterResult,
    get_auto_filter_engine,
    clear_auto_filter_cache,
)


class TestAutoFilterResult:
    """Tests for AutoFilterResult dataclass."""

    def test_to_dict_contains_all_fields(self):
        """Test that to_dict returns all expected fields."""
        result = AutoFilterResult(
            should_skip=True,
            reason='sender_pattern',
            confidence=0.95,
            matched_rule='sender_pattern',
            matched_value='^noreply@',
        )
        d = result.to_dict()

        assert d['should_skip'] is True
        assert d['reason'] == 'sender_pattern'
        assert d['confidence'] == 0.95
        assert d['matched_rule'] == 'sender_pattern'
        assert d['matched_value'] == '^noreply@'
        assert 'checked_at' in d

    def test_default_checked_at(self):
        """Test that checked_at is auto-populated."""
        result = AutoFilterResult(
            should_skip=False,
            reason='no_match',
            confidence=1.0,
            matched_rule='none',
        )
        assert result.checked_at is not None


class TestAutoFilterEngineSenderPatterns:
    """Tests for sender pattern matching."""

    @pytest.fixture
    def engine(self):
        """Create engine with filter enabled but not strict mode."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            yield engine

    def test_filters_noreply_sender(self, engine):
        """Test that noreply@ senders are filtered."""
        result = engine.check('noreply@company.com', 'Subject', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'sender_pattern'

    def test_filters_no_reply_sender(self, engine):
        """Test that no-reply@ senders are filtered."""
        result = engine.check('no-reply@company.com', 'Subject', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'sender_pattern'

    def test_filters_postmaster_sender(self, engine):
        """Test that postmaster@ senders are filtered."""
        result = engine.check('postmaster@company.com', 'Subject', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'sender_pattern'

    def test_filters_notifications_sender(self, engine):
        """Test that notifications@ senders are filtered."""
        result = engine.check('notifications@company.com', 'Subject', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'sender_pattern'

    def test_filters_alerts_sender(self, engine):
        """Test that alerts@ senders are filtered."""
        result = engine.check('alerts@monitoring.com', 'Subject', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'sender_pattern'

    def test_filters_messages_noreply(self, engine):
        """Test that messages-noreply@ senders are filtered (LinkedIn style)."""
        result = engine.check('messages-noreply@linkedin.com', 'New Message', skip_erp_check=True)
        assert result.should_skip is True

    def test_allows_regular_sender(self, engine):
        """Test that regular senders are allowed."""
        result = engine.check('john.doe@company.com', 'Order Request', skip_erp_check=True)
        assert result.should_skip is False
        assert result.reason == 'no_match'


class TestAutoFilterEngineDomainBlocklist:
    """Tests for domain blocklist matching."""

    @pytest.fixture
    def engine(self):
        """Create engine with filter enabled."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            yield engine

    def test_filters_sidera_cloud(self, engine):
        """Test that sidera.cloud (quarantine reports) is filtered."""
        result = engine.check('quarantine@sidera.cloud', 'Message Quarantine Report', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason in ('sender_pattern', 'domain_blocklist')

    def test_filters_linkedin_domain(self, engine):
        """Test that linkedin.com domain is filtered."""
        result = engine.check('someone@linkedin.com', 'You have a new connection', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'domain_blocklist'

    def test_filters_booking_domain(self, engine):
        """Test that booking.com domain is filtered."""
        result = engine.check('confirmation@booking.com', 'Your reservation', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'domain_blocklist'

    def test_filters_hubspot_domain(self, engine):
        """Test that hubspot.com domain is filtered."""
        result = engine.check('noreply@hubspot.com', 'New lead', skip_erp_check=True)
        # Could match sender pattern or domain blocklist
        assert result.should_skip is True

    def test_allows_unknown_domain(self, engine):
        """Test that unknown domains are allowed."""
        result = engine.check('sales@acme-corp.com', 'Purchase Order', skip_erp_check=True)
        assert result.should_skip is False


class TestAutoFilterEngineSubjectPatterns:
    """Tests for subject pattern matching."""

    @pytest.fixture
    def engine(self):
        """Create engine with filter enabled."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            yield engine

    def test_filters_quarantine_report_subject(self, engine):
        """Test that 'Message Quarantine Report' subject is filtered."""
        result = engine.check('unknown@unknown.com', 'Message Quarantine Report', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'subject_pattern'

    def test_filters_german_archive_warning(self, engine):
        """Test that German archive warning is filtered."""
        # Use sender that doesn't match any sender patterns
        result = engine.check('admin@internal.com', 'Das Archivpostfach ist fast voll', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'subject_pattern'

    def test_filters_automatic_reply_subject(self, engine):
        """Test that 'Automatic reply:' subject is filtered."""
        result = engine.check('colleague@company.com', 'Automatic reply: Out of office', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'subject_pattern'

    def test_filters_delivery_failure(self, engine):
        """Test that delivery failure notifications are filtered."""
        result = engine.check('mailer@company.com', 'Delivery Status Notification (Failure)', skip_erp_check=True)
        # Could match sender or subject pattern
        assert result.should_skip is True

    def test_allows_normal_subject(self, engine):
        """Test that normal business subjects are allowed."""
        result = engine.check('supplier@vendor.com', 'RE: Order 12345 - Delivery Update', skip_erp_check=True)
        assert result.should_skip is False


class TestAutoFilterEngineFeatureFlags:
    """Tests for feature flag behavior."""

    def test_disabled_filter_allows_all(self):
        """Test that disabled filter allows all emails."""
        with patch.dict(os.environ, {'AUTO_FILTER_ENABLED': 'false'}):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            result = engine.check('noreply@booking.com', 'Message Quarantine Report', skip_erp_check=True)
            assert result.should_skip is False
            assert result.reason == 'filter_disabled'

    def test_non_strict_mode_does_not_skip(self):
        """Test that non-strict mode tags but doesn't skip."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'false',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            result = engine.check('noreply@booking.com', 'Your reservation', skip_erp_check=True)
            # Should match but not skip
            assert result.should_skip is False
            assert result.reason in ('sender_pattern', 'domain_blocklist')
            assert result.matched_rule != 'none'

    def test_strict_mode_skips_matched(self):
        """Test that strict mode actually skips matched emails."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            result = engine.check('noreply@booking.com', 'Your reservation', skip_erp_check=True)
            assert result.should_skip is True


class TestAutoFilterEngineERPAllowlist:
    """Tests for ERP domain allowlist behavior."""

    @pytest.fixture
    def engine_with_erp(self):
        """Create engine with mocked ERP domains."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            # Manually set ERP domains
            engine._erp_domains = {'acme-corp.com', 'trusted-supplier.de', 'gold-customer.it'}
            engine._erp_domains_loaded = True
            yield engine

    def test_erp_customer_bypasses_filter(self, engine_with_erp):
        """Test that known ERP customer bypasses all filters."""
        # Even noreply@ from ERP customer should pass
        result = engine_with_erp.check('noreply@acme-corp.com', 'Your order confirmation')
        assert result.should_skip is False
        assert result.reason == 'erp_allowlist'

    def test_erp_supplier_bypasses_filter(self, engine_with_erp):
        """Test that known ERP supplier bypasses all filters."""
        result = engine_with_erp.check('alerts@trusted-supplier.de', 'Delivery Update')
        assert result.should_skip is False
        assert result.reason == 'erp_allowlist'

    def test_unknown_domain_still_filtered(self, engine_with_erp):
        """Test that unknown domains are still filtered."""
        result = engine_with_erp.check('noreply@unknown.com', 'Newsletter')
        assert result.should_skip is True


class TestAutoFilterEngineStats:
    """Tests for statistics methods."""

    def test_get_stats_returns_expected_fields(self):
        """Test that get_stats returns expected fields."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'false',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            stats = engine.get_stats()

            assert 'enabled' in stats
            assert 'strict_mode' in stats
            assert 'erp_domains_loaded' in stats
            assert 'erp_domains_count' in stats
            assert 'sender_patterns_count' in stats
            assert 'domain_blocklist_count' in stats
            assert 'subject_patterns_count' in stats

    def test_stats_reflect_config(self):
        """Test that stats reflect current configuration."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            stats = engine.get_stats()

            assert stats['enabled'] is True
            assert stats['strict_mode'] is True
            assert stats['sender_patterns_count'] > 0
            assert stats['domain_blocklist_count'] > 0
            assert stats['subject_patterns_count'] > 0


class TestAutoFilterEngineSingleton:
    """Tests for singleton pattern."""

    def test_clear_cache_resets_singleton(self):
        """Test that clear_auto_filter_cache resets the singleton."""
        with patch.dict(os.environ, {'AUTO_FILTER_ENABLED': 'true'}):
            engine1 = get_auto_filter_engine()
            engine2 = get_auto_filter_engine()
            assert engine1 is engine2  # Same instance

            clear_auto_filter_cache()

            engine3 = get_auto_filter_engine()
            assert engine3 is not engine1  # New instance after clear


class TestAutoFilterEngineEdgeCases:
    """Tests for edge cases and error handling."""

    @pytest.fixture
    def engine(self):
        """Create engine with filter enabled."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            yield engine

    def test_handles_empty_email(self, engine):
        """Test handling of empty email address."""
        result = engine.check('', 'Some subject', skip_erp_check=True)
        assert result.should_skip is False  # Can't match patterns

    def test_handles_none_email(self, engine):
        """Test handling of None email address."""
        result = engine.check(None, 'Some subject', skip_erp_check=True)
        assert result.should_skip is False

    def test_handles_empty_subject(self, engine):
        """Test handling of empty subject."""
        result = engine.check('noreply@company.com', '', skip_erp_check=True)
        assert result.should_skip is True  # Still matches sender pattern

    def test_handles_none_subject(self, engine):
        """Test handling of None subject."""
        result = engine.check('noreply@company.com', None, skip_erp_check=True)
        assert result.should_skip is True  # Still matches sender pattern

    def test_case_insensitive_matching(self, engine):
        """Test that matching is case-insensitive."""
        result = engine.check('NoReply@COMPANY.COM', 'Subject', skip_erp_check=True)
        assert result.should_skip is True
        assert result.reason == 'sender_pattern'

    def test_email_without_at_symbol(self, engine):
        """Test handling of malformed email without @."""
        result = engine.check('notanemail', 'Subject', skip_erp_check=True)
        assert result.should_skip is False  # No domain to check


class TestAutoFilterEngineConfidence:
    """Tests for confidence scoring."""

    @pytest.fixture
    def engine(self):
        """Create engine with filter enabled."""
        with patch.dict(os.environ, {
            'AUTO_FILTER_ENABLED': 'true',
            'AUTO_FILTER_STRICT_MODE': 'true',
        }):
            engine = AutoFilterEngine(postgres_dsn=None, load_erp_domains=False)
            yield engine

    def test_sender_pattern_has_high_confidence(self, engine):
        """Test that sender pattern matches have high confidence."""
        result = engine.check('noreply@company.com', 'Subject', skip_erp_check=True)
        assert result.confidence >= 0.9

    def test_domain_blocklist_has_moderate_confidence(self, engine):
        """Test that domain blocklist matches have moderate confidence."""
        # Use a domain that doesn't match sender patterns
        result = engine.check('someone@linkedin.com', 'New connection', skip_erp_check=True)
        assert result.confidence >= 0.85

    def test_subject_pattern_has_lower_confidence(self, engine):
        """Test that subject-only matches have slightly lower confidence."""
        result = engine.check('unknown@unknown.com', 'Message Quarantine Report', skip_erp_check=True)
        assert 0.8 <= result.confidence <= 0.9

    def test_no_match_has_full_confidence(self, engine):
        """Test that no match returns full confidence."""
        result = engine.check('sales@company.com', 'Order Request', skip_erp_check=True)
        assert result.confidence == 1.0
