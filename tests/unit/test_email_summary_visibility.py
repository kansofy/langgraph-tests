"""
Unit tests for Email Summary Visibility module.

Tests visibility tier logic and mailbox filtering for email summaries.
"""

import pytest
from lcascade.langgraph_email_summary.visibility import (
    get_visible_mailboxes,
    filter_mailbox_summaries,
    calculate_user_metrics,
    get_unique_mailboxes_for_all_users,
)


class TestGetVisibleMailboxes:
    """Tests for get_visible_mailboxes function."""

    @pytest.fixture
    def all_mailboxes(self):
        """Sample list of all available mailboxes."""
        return [
            'sp@zueggcom.it',
            'orders@zueggcom.it',
            'info@zueggcom.it',
            'quality@zueggcom.it',
            'management@zueggcom.it',
        ]

    def test_all_tier_sees_all_mailboxes(self, all_mailboxes):
        """User with 'all' access tier should see all mailboxes."""
        user_config = {
            'access_tier': 'all',
            'user_email': 'ceo@zueggcom.it',
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == all_mailboxes
        assert len(visible) == 5

    def test_team_tier_sees_team_mailboxes_only(self, all_mailboxes):
        """User with 'team' access tier should see only team mailboxes."""
        user_config = {
            'access_tier': 'team',
            'user_email': 'sales_lead@zueggcom.it',
            'team_mailboxes': ['sp@zueggcom.it', 'orders@zueggcom.it'],
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == ['sp@zueggcom.it', 'orders@zueggcom.it']
        assert len(visible) == 2

    def test_team_tier_filters_to_existing_mailboxes(self, all_mailboxes):
        """Team tier should only return mailboxes that exist."""
        user_config = {
            'access_tier': 'team',
            'user_email': 'team_lead@zueggcom.it',
            'team_mailboxes': ['sp@zueggcom.it', 'nonexistent@zueggcom.it'],
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == ['sp@zueggcom.it']
        assert 'nonexistent@zueggcom.it' not in visible

    def test_team_tier_empty_team_mailboxes(self, all_mailboxes):
        """Team tier with empty team_mailboxes should return empty list."""
        user_config = {
            'access_tier': 'team',
            'user_email': 'team_lead@zueggcom.it',
            'team_mailboxes': [],
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == []

    def test_team_tier_none_team_mailboxes(self, all_mailboxes):
        """Team tier with None team_mailboxes should return empty list."""
        user_config = {
            'access_tier': 'team',
            'user_email': 'team_lead@zueggcom.it',
            'team_mailboxes': None,
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == []

    def test_self_tier_sees_own_mailbox_only(self, all_mailboxes):
        """User with 'self' access tier should see only their own mailbox."""
        user_config = {
            'access_tier': 'self',
            'user_email': 'sp@zueggcom.it',
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == ['sp@zueggcom.it']
        assert len(visible) == 1

    def test_self_tier_no_matching_mailbox(self, all_mailboxes):
        """Self tier user without matching mailbox should see empty list."""
        user_config = {
            'access_tier': 'self',
            'user_email': 'individual@zueggcom.it',
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == []

    def test_default_tier_is_self(self, all_mailboxes):
        """Missing access_tier should default to 'self'."""
        user_config = {
            'user_email': 'sp@zueggcom.it',
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == ['sp@zueggcom.it']

    def test_unknown_tier_defaults_to_self(self, all_mailboxes):
        """Unknown access_tier should be treated as 'self'."""
        user_config = {
            'access_tier': 'unknown_tier',
            'user_email': 'sp@zueggcom.it',
        }
        visible = get_visible_mailboxes(user_config, all_mailboxes)
        assert visible == ['sp@zueggcom.it']


class TestFilterMailboxSummaries:
    """Tests for filter_mailbox_summaries function."""

    @pytest.fixture
    def all_mailboxes(self):
        return ['sp@zueggcom.it', 'orders@zueggcom.it', 'info@zueggcom.it']

    @pytest.fixture
    def all_summaries(self):
        """Sample summaries for all mailboxes."""
        return {
            'sp@zueggcom.it': {
                'mailbox': 'sp@zueggcom.it',
                'email_count': 50,
                'summary': 'SP mailbox summary',
                'tokens_input': 1000,
                'tokens_output': 500,
            },
            'orders@zueggcom.it': {
                'mailbox': 'orders@zueggcom.it',
                'email_count': 30,
                'summary': 'Orders mailbox summary',
                'tokens_input': 800,
                'tokens_output': 400,
            },
            'info@zueggcom.it': {
                'mailbox': 'info@zueggcom.it',
                'email_count': 20,
                'summary': 'Info mailbox summary',
                'tokens_input': 600,
                'tokens_output': 300,
            },
        }

    def test_all_tier_gets_all_summaries(self, all_mailboxes, all_summaries):
        """User with 'all' tier should get all summaries."""
        user_config = {
            'access_tier': 'all',
            'user_email': 'ceo@zueggcom.it',
        }
        filtered = filter_mailbox_summaries(user_config, all_summaries, all_mailboxes)
        assert len(filtered) == 3

    def test_team_tier_gets_team_summaries(self, all_mailboxes, all_summaries):
        """User with 'team' tier should get team summaries only."""
        user_config = {
            'access_tier': 'team',
            'user_email': 'sales_lead@zueggcom.it',
            'team_mailboxes': ['sp@zueggcom.it', 'orders@zueggcom.it'],
        }
        filtered = filter_mailbox_summaries(user_config, all_summaries, all_mailboxes)
        assert len(filtered) == 2
        mailboxes = [s['mailbox'] for s in filtered]
        assert 'sp@zueggcom.it' in mailboxes
        assert 'orders@zueggcom.it' in mailboxes
        assert 'info@zueggcom.it' not in mailboxes

    def test_self_tier_gets_own_summary(self, all_mailboxes, all_summaries):
        """User with 'self' tier should get only their own summary."""
        user_config = {
            'access_tier': 'self',
            'user_email': 'sp@zueggcom.it',
        }
        filtered = filter_mailbox_summaries(user_config, all_summaries, all_mailboxes)
        assert len(filtered) == 1
        assert filtered[0]['mailbox'] == 'sp@zueggcom.it'

    def test_returns_empty_when_no_visible_mailboxes(self, all_mailboxes, all_summaries):
        """Should return empty list when user has no visible mailboxes."""
        user_config = {
            'access_tier': 'self',
            'user_email': 'nobody@zueggcom.it',
        }
        filtered = filter_mailbox_summaries(user_config, all_summaries, all_mailboxes)
        assert filtered == []

    def test_handles_missing_summary_for_mailbox(self, all_mailboxes):
        """Should handle case where mailbox has no summary."""
        partial_summaries = {
            'sp@zueggcom.it': {'mailbox': 'sp@zueggcom.it', 'email_count': 10},
            # orders@zueggcom.it is missing
        }
        user_config = {
            'access_tier': 'team',
            'user_email': 'lead@zueggcom.it',
            'team_mailboxes': ['sp@zueggcom.it', 'orders@zueggcom.it'],
        }
        filtered = filter_mailbox_summaries(user_config, partial_summaries, all_mailboxes)
        assert len(filtered) == 1
        assert filtered[0]['mailbox'] == 'sp@zueggcom.it'


class TestCalculateUserMetrics:
    """Tests for calculate_user_metrics function."""

    def test_calculates_total_emails(self):
        """Should sum email counts across summaries."""
        summaries = [
            {'mailbox': 'm1', 'email_count': 10},
            {'mailbox': 'm2', 'email_count': 20},
            {'mailbox': 'm3', 'email_count': 30},
        ]
        metrics = calculate_user_metrics(summaries)
        assert metrics['total_emails'] == 60

    def test_calculates_mailbox_count(self):
        """Should count number of mailboxes."""
        summaries = [
            {'mailbox': 'm1'},
            {'mailbox': 'm2'},
        ]
        metrics = calculate_user_metrics(summaries)
        assert metrics['mailbox_count'] == 2

    def test_calculates_token_totals(self):
        """Should sum token usage across summaries."""
        summaries = [
            {'tokens_input': 100, 'tokens_output': 50},
            {'tokens_input': 200, 'tokens_output': 100},
        ]
        metrics = calculate_user_metrics(summaries)
        assert metrics['tokens_input'] == 300
        assert metrics['tokens_output'] == 150

    def test_handles_empty_summaries(self):
        """Should handle empty summaries list."""
        metrics = calculate_user_metrics([])
        assert metrics['mailbox_count'] == 0
        assert metrics['total_emails'] == 0
        assert metrics['tokens_input'] == 0
        assert metrics['tokens_output'] == 0

    def test_handles_missing_fields(self):
        """Should handle summaries with missing fields."""
        summaries = [
            {'mailbox': 'm1'},  # No email_count, no tokens
            {'mailbox': 'm2', 'email_count': 10},
        ]
        metrics = calculate_user_metrics(summaries)
        assert metrics['total_emails'] == 10
        assert metrics['tokens_input'] == 0


class TestGetUniqueMailboxesForAllUsers:
    """Tests for get_unique_mailboxes_for_all_users function."""

    @pytest.fixture
    def all_mailboxes(self):
        return ['m1@test.com', 'm2@test.com', 'm3@test.com', 'm4@test.com']

    def test_combines_unique_mailboxes(self, all_mailboxes):
        """Should return unique set of mailboxes needed across all users."""
        configs = [
            {'access_tier': 'self', 'user_email': 'm1@test.com'},
            {'access_tier': 'self', 'user_email': 'm2@test.com'},
            {'access_tier': 'team', 'user_email': 'lead@test.com', 'team_mailboxes': ['m2@test.com', 'm3@test.com']},
        ]
        needed = get_unique_mailboxes_for_all_users(configs, all_mailboxes)
        assert needed == {'m1@test.com', 'm2@test.com', 'm3@test.com'}
        assert 'm4@test.com' not in needed

    def test_all_tier_includes_all(self, all_mailboxes):
        """'all' tier should include all mailboxes."""
        configs = [
            {'access_tier': 'all', 'user_email': 'ceo@test.com'},
        ]
        needed = get_unique_mailboxes_for_all_users(configs, all_mailboxes)
        assert needed == set(all_mailboxes)

    def test_deduplicates_mailboxes(self, all_mailboxes):
        """Should deduplicate mailboxes from multiple users."""
        configs = [
            {'access_tier': 'self', 'user_email': 'm1@test.com'},
            {'access_tier': 'self', 'user_email': 'm1@test.com'},  # Duplicate
            {'access_tier': 'team', 'user_email': 'lead@test.com', 'team_mailboxes': ['m1@test.com']},  # Overlap
        ]
        needed = get_unique_mailboxes_for_all_users(configs, all_mailboxes)
        assert needed == {'m1@test.com'}

    def test_empty_configs_returns_empty_set(self, all_mailboxes):
        """Empty configs should return empty set."""
        needed = get_unique_mailboxes_for_all_users([], all_mailboxes)
        assert needed == set()

    def test_returns_set_type(self, all_mailboxes):
        """Should return a set."""
        configs = [
            {'access_tier': 'self', 'user_email': 'm1@test.com'},
        ]
        needed = get_unique_mailboxes_for_all_users(configs, all_mailboxes)
        assert isinstance(needed, set)
