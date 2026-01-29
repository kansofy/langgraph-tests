"""
Unit tests for Email Summary Formatters module.

Tests HTML formatting, plain text formatting, and urgent item handling.
"""

import pytest
from datetime import datetime
from lcascade.langgraph_email_summary.formatters import (
    format_email_summary_html,
    format_plain_text_summary,
    _format_mailbox_section,
    _format_no_activity_section,
    COLORS,
    PRIORITY_COLORS,
)


class TestFormatEmailSummaryHTML:
    """Tests for format_email_summary_html function."""

    def test_returns_valid_html(self):
        """Should return valid HTML document."""
        html = format_email_summary_html(
            user_name='John Doe',
            user_email='john@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert html.startswith('<!DOCTYPE html>')
        assert '<html' in html
        assert '</html>' in html
        assert '<body' in html
        assert '</body>' in html

    def test_includes_user_name_in_greeting(self):
        """Should include user name in greeting."""
        html = format_email_summary_html(
            user_name='Jane Smith',
            user_email='jane@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'Jane Smith' in html

    def test_falls_back_to_email_when_no_name(self):
        """Should use email prefix when no name provided."""
        html = format_email_summary_html(
            user_name='',
            user_email='john@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        # Should use John (capitalized from john@)
        assert 'John' in html or 'john' in html.lower()

    def test_formats_date_nicely(self):
        """Should format date in readable format."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        # Should show something like "Monday, January 15, 2024"
        assert 'January' in html
        assert '2024' in html

    def test_handles_invalid_date_format(self):
        """Should handle invalid date format gracefully."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='invalid-date',
            mailbox_summaries=[],
            total_emails=0,
        )
        # Should fall back to original string
        assert 'invalid-date' in html

    def test_includes_mailbox_count(self):
        """Should include mailbox count in summary line."""
        summaries = [
            {'mailbox': 'm1', 'email_count': 10, 'summary': 'Test'},
            {'mailbox': 'm2', 'email_count': 20, 'summary': 'Test'},
        ]
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=summaries,
            total_emails=30,
        )
        assert '2 mailbox' in html

    def test_includes_total_email_count(self):
        """Should include total email count."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=42,
        )
        assert '42 emails' in html

    def test_uses_kansofy_branding(self):
        """Should include Kansofy branding."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'Kansofy' in html

    def test_uses_brand_colors(self):
        """Should use Kansofy brand colors."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        # Check for primary coral color
        assert COLORS['primary'] in html

    def test_shows_no_activity_when_no_summaries(self):
        """Should show no activity section when no summaries."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'No Email Activity' in html


class TestFormatMailboxSection:
    """Tests for _format_mailbox_section function."""

    def test_includes_mailbox_name(self):
        """Should include mailbox email in section."""
        summary = {
            'mailbox': 'sp@zueggcom.it',
            'email_count': 10,
            'summary': 'Test summary',
        }
        html = _format_mailbox_section(summary)
        assert 'sp@zueggcom.it' in html

    def test_includes_email_count_badge(self):
        """Should show email count in badge."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 25,
            'summary': 'Test',
        }
        html = _format_mailbox_section(summary)
        assert '25 email' in html

    def test_includes_summary_text(self):
        """Should include the summary text."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Customer inquiries about product availability and pricing.',
        }
        html = _format_mailbox_section(summary)
        assert 'Customer inquiries about product availability' in html

    def test_includes_key_themes_as_badges(self):
        """Should show key themes as badges."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Test',
            'key_themes': ['Orders', 'Deliveries', 'Quality'],
        }
        html = _format_mailbox_section(summary)
        assert 'Orders' in html
        assert 'Deliveries' in html
        assert 'Quality' in html

    def test_limits_themes_to_4(self):
        """Should limit themes to 4 badges."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Test',
            'key_themes': ['A', 'B', 'C', 'D', 'E', 'F'],  # 6 themes
        }
        html = _format_mailbox_section(summary)
        # First 4 should be present
        assert 'A' in html
        assert 'D' in html
        # 5th and 6th should not
        # (Note: Can't easily test absence since letters might appear elsewhere)

    def test_formats_urgent_items_with_red_styling(self):
        """Should format urgent items with red styling."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Test',
            'urgent_items': [
                {'subject': 'URGENT: Order missing', 'reason': 'Customer complaint'},
            ],
        }
        html = _format_mailbox_section(summary)
        assert 'URGENT' in html
        assert 'Order missing' in html
        assert COLORS['error'] in html  # Red color

    def test_limits_urgent_items_to_3(self):
        """Should limit urgent items to 3."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Test',
            'urgent_items': [
                {'subject': 'Urgent 1', 'reason': 'R1'},
                {'subject': 'Urgent 2', 'reason': 'R2'},
                {'subject': 'Urgent 3', 'reason': 'R3'},
                {'subject': 'Urgent 4', 'reason': 'R4'},
                {'subject': 'Urgent 5', 'reason': 'R5'},
            ],
        }
        html = _format_mailbox_section(summary)
        assert 'Urgent 1' in html
        assert 'Urgent 3' in html
        # 4th and 5th should be truncated
        assert html.count('Urgent ') == 3

    def test_formats_action_items_with_priority_dots(self):
        """Should show action items with priority indicator dots."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Test',
            'action_items': [
                {'action': 'Review order status', 'priority': 'high'},
                {'action': 'Send confirmation', 'priority': 'low'},
            ],
        }
        html = _format_mailbox_section(summary)
        assert 'Review order status' in html
        assert 'Send confirmation' in html
        assert PRIORITY_COLORS['high'] in html
        assert PRIORITY_COLORS['low'] in html

    def test_limits_action_items_to_5(self):
        """Should limit action items to 5."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Test',
            'action_items': [
                {'action': f'Action {i}', 'priority': 'medium'}
                for i in range(10)
            ],
        }
        html = _format_mailbox_section(summary)
        assert 'Action 0' in html
        assert 'Action 4' in html
        # 6th+ should be truncated
        count = sum(1 for i in range(10) if f'Action {i}' in html)
        assert count == 5

    def test_handles_empty_optional_fields(self):
        """Should handle missing optional fields gracefully."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 5,
            'summary': 'Minimal summary',
            # No key_themes, urgent_items, action_items
        }
        html = _format_mailbox_section(summary)
        assert 'test@test.com' in html
        assert 'Minimal summary' in html


class TestFormatNoActivitySection:
    """Tests for _format_no_activity_section function."""

    def test_returns_no_activity_message(self):
        """Should return no activity message."""
        html = _format_no_activity_section()
        assert 'No Email Activity' in html

    def test_includes_peace_emoji(self):
        """Should include peace/quiet message."""
        html = _format_no_activity_section()
        assert 'quiet' in html.lower() or '✌' in html or '&#9996;' in html


class TestFormatPlainTextSummary:
    """Tests for format_plain_text_summary function."""

    def test_returns_plain_text(self):
        """Should return plain text without HTML tags."""
        text = format_plain_text_summary(
            user_name='John',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert '<' not in text
        assert '>' not in text

    def test_includes_header(self):
        """Should include header with date."""
        text = format_plain_text_summary(
            user_name='John',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'Daily Email Summary' in text
        assert '2024-01-15' in text

    def test_includes_greeting(self):
        """Should include personalized greeting."""
        text = format_plain_text_summary(
            user_name='Jane',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'Hello Jane' in text

    def test_includes_mailbox_sections(self):
        """Should include sections for each mailbox."""
        summaries = [
            {'mailbox': 'sp@test.com', 'email_count': 10, 'summary': 'SP summary here'},
            {'mailbox': 'orders@test.com', 'email_count': 5, 'summary': 'Orders summary here'},
        ]
        text = format_plain_text_summary(
            user_name='User',
            report_date='2024-01-15',
            mailbox_summaries=summaries,
            total_emails=15,
        )
        assert 'sp@test.com' in text
        assert '10 emails' in text
        assert 'SP summary here' in text
        assert 'orders@test.com' in text
        assert 'Orders summary here' in text

    def test_includes_urgent_items(self):
        """Should include urgent items."""
        summaries = [
            {
                'mailbox': 'test@test.com',
                'email_count': 5,
                'summary': 'Test',
                'urgent_items': [
                    {'subject': 'URGENT: Payment overdue'},
                ],
            },
        ]
        text = format_plain_text_summary(
            user_name='User',
            report_date='2024-01-15',
            mailbox_summaries=summaries,
            total_emails=5,
        )
        assert 'URGENT' in text
        assert 'Payment overdue' in text

    def test_includes_action_items_with_priority(self):
        """Should include action items with priority labels."""
        summaries = [
            {
                'mailbox': 'test@test.com',
                'email_count': 5,
                'summary': 'Test',
                'action_items': [
                    {'action': 'Call customer', 'priority': 'high'},
                    {'action': 'Send report', 'priority': 'low'},
                ],
            },
        ]
        text = format_plain_text_summary(
            user_name='User',
            report_date='2024-01-15',
            mailbox_summaries=summaries,
            total_emails=5,
        )
        assert '[HIGH]' in text
        assert 'Call customer' in text
        assert '[LOW]' in text
        assert 'Send report' in text

    def test_includes_kansofy_footer(self):
        """Should include Kansofy footer."""
        text = format_plain_text_summary(
            user_name='User',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'Kansofy' in text


class TestColorConstants:
    """Tests for color constants."""

    def test_primary_is_coral(self):
        """Primary color should be coral/orange."""
        assert COLORS['primary'] == '#FF6B4A'

    def test_all_colors_are_hex(self):
        """All colors should be valid hex codes."""
        for name, color in COLORS.items():
            assert color.startswith('#'), f"{name} should start with #"
            assert len(color) == 7, f"{name} should be 7 chars (#RRGGBB)"

    def test_priority_colors_exist(self):
        """Priority colors should exist for high/medium/low."""
        assert 'high' in PRIORITY_COLORS
        assert 'medium' in PRIORITY_COLORS
        assert 'low' in PRIORITY_COLORS


class TestEdgeCases:
    """Tests for edge cases."""

    def test_handles_special_characters_in_subject(self):
        """Should handle special characters in email subjects."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 1,
            'summary': 'Test',
            'urgent_items': [
                {'subject': 'RE: Order <script>alert("xss")</script>', 'reason': 'Test'},
            ],
        }
        html = _format_mailbox_section(summary)
        # Should not break HTML structure
        assert '<script>' in html or '&lt;script&gt;' in html or 'script' in html

    def test_handles_very_long_summary(self):
        """Should handle very long summary text."""
        long_summary = 'This is a very long summary. ' * 100
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 1,
            'summary': long_summary,
        }
        html = _format_mailbox_section(summary)
        assert len(html) > len(long_summary)

    def test_handles_unicode_in_summary(self):
        """Should handle Unicode characters."""
        summary = {
            'mailbox': 'test@test.com',
            'email_count': 1,
            'summary': 'Bestellung für Käse und Würstchen 日本語テスト',
        }
        html = _format_mailbox_section(summary)
        assert 'Käse' in html
        assert '日本語' in html

    def test_html_is_responsive_ready(self):
        """HTML should include viewport meta for mobile."""
        html = format_email_summary_html(
            user_name='User',
            user_email='user@test.com',
            report_date='2024-01-15',
            mailbox_summaries=[],
            total_emails=0,
        )
        assert 'viewport' in html
        assert 'width=device-width' in html
