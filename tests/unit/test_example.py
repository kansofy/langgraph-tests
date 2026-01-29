"""
Example unit tests to verify harness structure.

These tests run without any external dependencies.
"""

import pytest


class TestHarnessSetup:
    """Verify test harness is working."""

    def test_fixtures_importable(self):
        """Verify fixtures can be imported."""
        from harness.fixtures import check_ssh_tunnel
        assert callable(check_ssh_tunnel)

    def test_metrics_importable(self):
        """Verify metrics collector can be imported."""
        from harness.metrics_collector import get_metrics_collector
        collector = get_metrics_collector()
        assert collector is not None

    def test_reports_importable(self):
        """Verify report generator can be imported."""
        from harness.report_generator import generate_console_report
        assert callable(generate_console_report)


class TestSampleCoherentCascade:
    """Tests using sample_coherent_cascade fixture."""

    def test_sample_has_l2_intent(self, sample_coherent_cascade):
        """Sample should have L2 intent."""
        assert sample_coherent_cascade['l2_intent'] == 'order'

    def test_sample_has_l5_urgency(self, sample_coherent_cascade):
        """Sample should have L5 urgency score."""
        assert sample_coherent_cascade['l5_urgency_score'] == 3

    def test_sample_has_l9_priority(self, sample_coherent_cascade):
        """Sample should have L9 priority."""
        assert sample_coherent_cascade['l9_priority'] == 'medium'


class TestSampleIncoherentCascade:
    """Tests using sample_incoherent_cascade fixture."""

    def test_has_mismatched_urgency_priority(self, sample_incoherent_cascade):
        """Sample should have urgency/priority mismatch."""
        assert sample_incoherent_cascade['l5_urgency_score'] == 5
        assert sample_incoherent_cascade['l9_priority'] == 'low'

    def test_has_sentiment_posture_mismatch(self, sample_incoherent_cascade):
        """Sample should have sentiment/posture contradiction."""
        assert sample_incoherent_cascade['l2_sentiment'] == 'positive'
        assert sample_incoherent_cascade['l4_sender_posture'] == 'confirming'
        # Complaint intent with positive sentiment is a contradiction
        assert sample_incoherent_cascade['l2_intent'] == 'complaint'
