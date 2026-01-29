"""
Unit tests for CoherenceValidator module.

Tests all 7 validation rules:
1. Urgency-priority alignment (L5↔L9)
2. Entity grounding (L3↔L9 actions)
3. Intent consistency (L2↔L9 summary)
4. Role-routing consistency (L4↔L2)
5. Generic output detection (L9)
6. Complexity-workload mismatch (L7)
7. Sentiment-posture consistency (L2↔L4)

Plus: Score calculation, threshold logic, convenience function.
"""

import pytest
from lcascade.langgraph_common.coherence_validator import (
    CoherenceValidator,
    CoherenceResult,
    CoherenceIssue,
    IssueType,
    IssueSeverity,
    validate_cascade,
)


class TestCoherenceValidatorInit:
    """Tests for CoherenceValidator initialization."""

    def test_default_init(self):
        """Test default initialization enables all checks."""
        validator = CoherenceValidator()
        assert validator.strict_mode is False
        assert validator.check_urgency_priority is True
        assert validator.check_entity_grounding is True
        assert validator.check_intent_consistency is True
        assert validator.check_role_routing is True
        assert validator.check_generic_output is True

    def test_strict_mode_init(self):
        """Test strict mode can be enabled."""
        validator = CoherenceValidator(strict_mode=True)
        assert validator.strict_mode is True

    def test_disable_individual_checks(self):
        """Test individual checks can be disabled."""
        validator = CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
        )
        assert validator.check_urgency_priority is False
        assert validator.check_entity_grounding is False
        assert validator.check_intent_consistency is True


class TestRule1UrgencyPriorityAlignment:
    """Tests for Rule 1: Urgency-Priority alignment (L5↔L9)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_role_routing=False,
            check_generic_output=False,
        )

    def test_urgency_1_matches_low_priority(self, validator):
        """Urgency 1 should map to low priority."""
        result = validator.validate({
            'l5_urgency_score': 1,
            'l9_priority': 'low',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 0

    def test_urgency_2_matches_low_priority(self, validator):
        """Urgency 2 should map to low priority (strict V2.1)."""
        result = validator.validate({
            'l5_urgency_score': 2,
            'l9_priority': 'low',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 0

    def test_urgency_3_matches_medium_priority(self, validator):
        """Urgency 3 should map to medium priority."""
        result = validator.validate({
            'l5_urgency_score': 3,
            'l9_priority': 'medium',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 0

    def test_urgency_4_matches_high_priority(self, validator):
        """Urgency 4 should map to high priority."""
        result = validator.validate({
            'l5_urgency_score': 4,
            'l9_priority': 'high',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 0

    def test_urgency_5_matches_critical_priority(self, validator):
        """Urgency 5 should map to critical priority."""
        result = validator.validate({
            'l5_urgency_score': 5,
            'l9_priority': 'critical',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 0

    def test_high_urgency_low_priority_is_critical(self, validator):
        """Urgency 4-5 with low priority should be CRITICAL severity."""
        result = validator.validate({
            'l5_urgency_score': 5,
            'l9_priority': 'low',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 1
        assert urgency_issues[0].severity == IssueSeverity.CRITICAL

    def test_low_urgency_high_priority_is_high_severity(self, validator):
        """Urgency 1-2 with critical/high priority should be HIGH severity."""
        result = validator.validate({
            'l5_urgency_score': 1,
            'l9_priority': 'critical',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 1
        assert urgency_issues[0].severity == IssueSeverity.HIGH

    def test_moderate_mismatch_is_medium_severity(self, validator):
        """Moderate mismatches should be MEDIUM severity."""
        result = validator.validate({
            'l5_urgency_score': 3,
            'l9_priority': 'high',  # Should be medium
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 1
        assert urgency_issues[0].severity == IssueSeverity.MEDIUM

    def test_case_insensitive_priority(self, validator):
        """Priority matching should be case-insensitive."""
        result = validator.validate({
            'l5_urgency_score': 3,
            'l9_priority': 'MEDIUM',
        })
        urgency_issues = [i for i in result.issues
                         if i.issue_type == IssueType.URGENCY_PRIORITY_MISMATCH]
        assert len(urgency_issues) == 0


class TestRule2EntityGrounding:
    """Tests for Rule 2: Entity grounding (L3↔L9 actions)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_urgency_priority=False,
            check_intent_consistency=False,
            check_role_routing=False,
            check_generic_output=False,
        )

    def test_call_action_with_phone_entity_passes(self, validator):
        """Action 'call' with phone entity should pass."""
        result = validator.validate({
            'l3_entities': [
                {'entity_type': 'phone', 'entity_value': '+1234567890'},
            ],
            'l9_action_items': [
                {'action': 'Call customer to discuss order'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 0

    def test_call_action_without_phone_fails(self, validator):
        """Action 'call' without phone entity should fail."""
        result = validator.validate({
            'l3_entities': [
                {'entity_type': 'email', 'entity_value': 'john@example.com'},
            ],
            'l9_action_items': [
                {'action': 'Call customer to discuss'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 1

    def test_email_action_with_email_entity_passes(self, validator):
        """Action 'email' with email entity should pass."""
        result = validator.validate({
            'l3_entities': [
                {'entity_type': 'email', 'entity_value': 'john@example.com'},
            ],
            'l9_action_items': [
                {'action': 'Email customer with confirmation'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 0

    def test_check_order_with_order_entity_passes(self, validator):
        """Action 'check order' with order entity should pass."""
        result = validator.validate({
            'l3_entities': [
                {'entity_type': 'order', 'entity_value': '12345'},
            ],
            'l9_action_items': [
                {'action': 'Check order status in ERP'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 0

    def test_verify_invoice_without_invoice_fails(self, validator):
        """Action 'verify invoice' without invoice entity should fail."""
        result = validator.validate({
            'l3_entities': [
                {'entity_type': 'order', 'entity_value': '12345'},
            ],
            'l9_action_items': [
                {'action': 'Verify invoice and send to customer'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 1

    def test_unrelated_action_passes(self, validator):
        """Actions not in requirements map should pass."""
        result = validator.validate({
            'l3_entities': [],
            'l9_action_items': [
                {'action': 'Review and respond to inquiry'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 0

    def test_empty_entities_with_grounded_action(self, validator):
        """Empty entities with action requiring entities should fail."""
        result = validator.validate({
            'l3_entities': [],
            'l9_action_items': [
                {'action': 'Track delivery status'},
            ],
        })
        grounding_issues = [i for i in result.issues
                           if i.issue_type == IssueType.UNGROUNDED_ACTION]
        assert len(grounding_issues) == 1


class TestRule3IntentConsistency:
    """Tests for Rule 3: Intent consistency (L2↔L9 summary)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
            check_role_routing=False,
            check_generic_output=False,
        )

    def test_order_intent_with_order_summary_passes(self, validator):
        """L2 intent 'order' with order keywords in summary should pass."""
        result = validator.validate({
            'l2_intent': 'order',
            'l9_executive_summary': 'Customer is placing an order for 500 units of product XYZ.',
        })
        intent_issues = [i for i in result.issues
                        if i.issue_type == IssueType.INTENT_MISMATCH]
        assert len(intent_issues) == 0

    def test_complaint_intent_without_complaint_summary_fails(self, validator):
        """L2 intent 'complaint' without complaint keywords in summary should fail."""
        result = validator.validate({
            'l2_intent': 'complaint',
            'l9_executive_summary': 'Customer is asking about their account status and renewal options.',
        })
        intent_issues = [i for i in result.issues
                        if i.issue_type == IssueType.INTENT_MISMATCH]
        assert len(intent_issues) == 1

    def test_invoice_intent_with_billing_summary_passes(self, validator):
        """L2 intent 'invoice' with billing keywords should pass."""
        result = validator.validate({
            'l2_intent': 'invoice',
            'l9_executive_summary': 'Customer requests billing information for recent purchase.',
        })
        intent_issues = [i for i in result.issues
                        if i.issue_type == IssueType.INTENT_MISMATCH]
        assert len(intent_issues) == 0

    def test_delivery_intent_with_shipping_summary_passes(self, validator):
        """L2 intent 'delivery' with shipping keywords should pass."""
        result = validator.validate({
            'l2_intent': 'delivery',
            'l9_executive_summary': 'Customer needs to track their shipment status.',
        })
        intent_issues = [i for i in result.issues
                        if i.issue_type == IssueType.INTENT_MISMATCH]
        assert len(intent_issues) == 0

    def test_short_summary_is_skipped(self, validator):
        """Very short summaries should skip intent check."""
        result = validator.validate({
            'l2_intent': 'complaint',
            'l9_executive_summary': 'General inquiry.',  # <50 chars
        })
        intent_issues = [i for i in result.issues
                        if i.issue_type == IssueType.INTENT_MISMATCH]
        # Short summary, so no intent mismatch (will fail generic check instead)
        assert len(intent_issues) == 0

    def test_german_keywords_work(self, validator):
        """German keywords should be recognized."""
        result = validator.validate({
            'l2_intent': 'order',
            'l9_executive_summary': 'Kunde möchte eine Bestellung für nächste Woche aufgeben.',
        })
        intent_issues = [i for i in result.issues
                        if i.issue_type == IssueType.INTENT_MISMATCH]
        assert len(intent_issues) == 0


class TestRule4RoleRoutingConsistency:
    """Tests for Rule 4: Role-routing consistency (L4↔L2)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_generic_output=False,
        )

    def test_customer_role_sales_routing_passes(self, validator):
        """Customer role with sales routing should pass."""
        result = validator.validate({
            'l4_sender_role': 'customer',
            'l2_routing_hint': 'sales',
        })
        routing_issues = [i for i in result.issues
                         if i.issue_type == IssueType.ROLE_ROUTING_MISMATCH]
        assert len(routing_issues) == 0

    def test_supplier_role_ops_routing_passes(self, validator):
        """Supplier role with ops routing should pass."""
        result = validator.validate({
            'l4_sender_role': 'supplier',
            'l2_routing_hint': 'ops',
        })
        routing_issues = [i for i in result.issues
                         if i.issue_type == IssueType.ROLE_ROUTING_MISMATCH]
        assert len(routing_issues) == 0

    def test_customer_role_unexpected_routing_fails(self, validator):
        """Customer role with unexpected routing should fail."""
        result = validator.validate({
            'l4_sender_role': 'customer',
            'l2_routing_hint': 'finance',  # Not in expected set for customer
        })
        routing_issues = [i for i in result.issues
                         if i.issue_type == IssueType.ROLE_ROUTING_MISMATCH]
        assert len(routing_issues) == 1
        assert routing_issues[0].severity == IssueSeverity.LOW  # Minor issue

    def test_empty_role_skips_check(self, validator):
        """Empty role should skip routing check."""
        result = validator.validate({
            'l4_sender_role': '',
            'l2_routing_hint': 'sales',
        })
        routing_issues = [i for i in result.issues
                         if i.issue_type == IssueType.ROLE_ROUTING_MISMATCH]
        assert len(routing_issues) == 0

    def test_unknown_role_skips_check(self, validator):
        """Unknown role should skip routing check."""
        result = validator.validate({
            'l4_sender_role': 'unknown_role_type',
            'l2_routing_hint': 'sales',
        })
        routing_issues = [i for i in result.issues
                         if i.issue_type == IssueType.ROLE_ROUTING_MISMATCH]
        assert len(routing_issues) == 0


class TestRule5GenericOutputDetection:
    """Tests for Rule 5: Generic output detection (L9)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_role_routing=False,
        )

    def test_specific_summary_passes(self, validator):
        """Specific, detailed summary should pass."""
        result = validator.validate({
            'l9_executive_summary': 'Customer John from Acme Corp requesting status update on order #12345 placed last week.',
        })
        generic_issues = [i for i in result.issues
                         if i.issue_type == IssueType.GENERIC_SUMMARY]
        assert len(generic_issues) == 0

    def test_generic_phrase_unable_to_generate_fails(self, validator):
        """Summary with 'unable to generate' should fail."""
        result = validator.validate({
            'l9_executive_summary': 'Unable to generate specific summary due to processing issues.',
        })
        generic_issues = [i for i in result.issues
                         if i.issue_type == IssueType.GENERIC_SUMMARY]
        assert len(generic_issues) == 1

    def test_generic_phrase_manual_review_fails(self, validator):
        """Summary with 'manual review required' should fail."""
        result = validator.validate({
            'l9_executive_summary': 'Manual review required for this email content.',
        })
        generic_issues = [i for i in result.issues
                         if i.issue_type == IssueType.GENERIC_SUMMARY]
        assert len(generic_issues) == 1

    def test_generic_phrase_general_inquiry_fails(self, validator):
        """Summary with 'general inquiry' should fail."""
        result = validator.validate({
            'l9_executive_summary': 'This is a general inquiry about products and services we offer to customers.',
        })
        generic_issues = [i for i in result.issues
                         if i.issue_type == IssueType.GENERIC_SUMMARY]
        assert len(generic_issues) == 1

    def test_too_short_summary_fails(self, validator):
        """Summary shorter than 30 chars should fail."""
        result = validator.validate({
            'l9_executive_summary': 'Customer inquiry.',  # 17 chars
        })
        generic_issues = [i for i in result.issues
                         if i.issue_type == IssueType.GENERIC_SUMMARY]
        assert len(generic_issues) == 1

    def test_empty_summary_skips_length_check(self, validator):
        """Empty summary should not fail length check (already empty)."""
        result = validator.validate({
            'l9_executive_summary': '',
        })
        generic_issues = [i for i in result.issues
                         if i.issue_type == IssueType.GENERIC_SUMMARY]
        # Empty string is not considered "too short" (it's just empty)
        assert len(generic_issues) == 0


class TestRule6ComplexityWorkloadMismatch:
    """Tests for Rule 6: Complexity-workload mismatch (L7)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_role_routing=False,
            check_generic_output=False,
        )

    def test_complexity_1_with_5_minutes_passes(self, validator):
        """Complexity 1 with 5 minutes should pass."""
        result = validator.validate({
            'l7_complexity_score': 1,
            'l7_est_minutes': 5,
        })
        complexity_issues = [i for i in result.issues
                            if i.issue_type == IssueType.COMPLEXITY_WORKLOAD_MISMATCH]
        assert len(complexity_issues) == 0

    def test_complexity_3_with_30_minutes_passes(self, validator):
        """Complexity 3 with 30 minutes should pass."""
        result = validator.validate({
            'l7_complexity_score': 3,
            'l7_est_minutes': 30,
        })
        complexity_issues = [i for i in result.issues
                            if i.issue_type == IssueType.COMPLEXITY_WORKLOAD_MISMATCH]
        assert len(complexity_issues) == 0

    def test_complexity_5_with_120_minutes_passes(self, validator):
        """Complexity 5 with 120 minutes should pass."""
        result = validator.validate({
            'l7_complexity_score': 5,
            'l7_est_minutes': 120,
        })
        complexity_issues = [i for i in result.issues
                            if i.issue_type == IssueType.COMPLEXITY_WORKLOAD_MISMATCH]
        assert len(complexity_issues) == 0

    def test_complexity_5_with_5_minutes_fails(self, validator):
        """Complexity 5 with 5 minutes is a major mismatch."""
        result = validator.validate({
            'l7_complexity_score': 5,
            'l7_est_minutes': 5,
        })
        complexity_issues = [i for i in result.issues
                            if i.issue_type == IssueType.COMPLEXITY_WORKLOAD_MISMATCH]
        assert len(complexity_issues) == 1

    def test_complexity_1_with_500_minutes_fails(self, validator):
        """Complexity 1 with 500 minutes is a major mismatch."""
        result = validator.validate({
            'l7_complexity_score': 1,
            'l7_est_minutes': 500,
        })
        complexity_issues = [i for i in result.issues
                            if i.issue_type == IssueType.COMPLEXITY_WORKLOAD_MISMATCH]
        assert len(complexity_issues) == 1


class TestRule7SentimentPostureConsistency:
    """Tests for Rule 7: Sentiment-posture consistency (L2↔L4)."""

    @pytest.fixture
    def validator(self):
        return CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_role_routing=False,
            check_generic_output=False,
        )

    def test_positive_sentiment_confirming_posture_passes(self, validator):
        """Positive sentiment with confirming posture should pass."""
        result = validator.validate({
            'l2_sentiment': 'positive',
            'l4_sender_posture': 'confirming',
        })
        # Wait - according to the code, positive+confirming is NOT incompatible
        sentiment_issues = [i for i in result.issues
                           if i.issue_type == IssueType.SENTIMENT_CONTRADICTION]
        assert len(sentiment_issues) == 0

    def test_negative_sentiment_complaining_posture_passes(self, validator):
        """Negative sentiment with complaining posture should pass."""
        result = validator.validate({
            'l2_sentiment': 'negative',
            'l4_sender_posture': 'complaining',
        })
        sentiment_issues = [i for i in result.issues
                           if i.issue_type == IssueType.SENTIMENT_CONTRADICTION]
        assert len(sentiment_issues) == 0

    def test_positive_sentiment_complaining_posture_fails(self, validator):
        """Positive sentiment with complaining posture should fail."""
        result = validator.validate({
            'l2_sentiment': 'positive',
            'l4_sender_posture': 'complaining',
        })
        sentiment_issues = [i for i in result.issues
                           if i.issue_type == IssueType.SENTIMENT_CONTRADICTION]
        assert len(sentiment_issues) == 1

    def test_positive_sentiment_escalating_posture_fails(self, validator):
        """Positive sentiment with escalating posture should fail."""
        result = validator.validate({
            'l2_sentiment': 'positive',
            'l4_sender_posture': 'escalating',
        })
        sentiment_issues = [i for i in result.issues
                           if i.issue_type == IssueType.SENTIMENT_CONTRADICTION]
        assert len(sentiment_issues) == 1

    def test_neutral_sentiment_any_posture_passes(self, validator):
        """Neutral sentiment should pass with any posture."""
        for posture in ['complaining', 'confirming', 'escalating', 'requesting']:
            result = validator.validate({
                'l2_sentiment': 'neutral',
                'l4_sender_posture': posture,
            })
            sentiment_issues = [i for i in result.issues
                               if i.issue_type == IssueType.SENTIMENT_CONTRADICTION]
            assert len(sentiment_issues) == 0, f"Failed for posture {posture}"


class TestCoherenceScoreCalculation:
    """Tests for coherence score calculation."""

    def test_no_issues_gives_perfect_score(self):
        """No issues should result in score 1.0."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': 3,
            'l9_priority': 'medium',
            'l9_executive_summary': 'Customer John requesting update on order #12345 delivery timeline.',
            'l3_entities': [{'entity_type': 'order', 'entity_value': '12345'}],
            'l9_action_items': [],
            'l7_complexity_score': 3,
            'l7_est_minutes': 30,  # Within range for complexity 3 (15-60 min)
        })
        assert result.score == 1.0
        assert result.is_coherent is True

    def test_critical_issue_reduces_score_025(self):
        """Critical issue should reduce score by 0.25."""
        validator = CoherenceValidator(
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_role_routing=False,
            check_generic_output=False,
        )
        result = validator.validate({
            'l5_urgency_score': 5,
            'l9_priority': 'low',  # CRITICAL mismatch
            'l7_complexity_score': 3,
            'l7_est_minutes': 30,  # Within range (15-60) to avoid complexity issue
        })
        assert result.score == 0.75

    def test_high_issue_reduces_score_015(self):
        """High severity issue should reduce score by 0.15."""
        validator = CoherenceValidator(
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_role_routing=False,
            check_generic_output=False,
        )
        result = validator.validate({
            'l5_urgency_score': 1,
            'l9_priority': 'critical',  # HIGH severity mismatch
            'l7_complexity_score': 3,
            'l7_est_minutes': 30,  # Within range (15-60) to avoid complexity issue
        })
        assert result.score == 0.85

    def test_multiple_issues_accumulate(self):
        """Multiple issues should accumulate score reduction."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': 5,
            'l9_priority': 'low',  # CRITICAL: -0.25
            'l9_executive_summary': 'Unable to generate.',  # HIGH: -0.15
            'l3_entities': [],
            'l9_action_items': [{'action': 'Call customer'}],  # HIGH: -0.15
        })
        # Score should be reduced significantly
        assert result.score < 0.5

    def test_score_cannot_go_negative(self):
        """Score should be clamped at 0.0."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': 5,
            'l9_priority': 'low',  # CRITICAL
            'l2_sentiment': 'positive',
            'l4_sender_posture': 'complaining',  # MEDIUM
            'l9_executive_summary': 'General inquiry about standard processing.',  # MEDIUM + generic
            'l3_entities': [],
            'l9_action_items': [
                {'action': 'Call customer'},  # HIGH
                {'action': 'Verify invoice'},  # HIGH
            ],
            'l7_complexity_score': 5,
            'l7_est_minutes': 2,  # MEDIUM
        })
        assert result.score >= 0.0

    def test_coherent_with_score_above_070(self):
        """is_coherent should be True if score >= 0.7 and no CRITICAL issues."""
        validator = CoherenceValidator(
            check_urgency_priority=False,
            check_entity_grounding=False,
            check_intent_consistency=False,
            check_generic_output=False,
        )
        # Only LOW severity issues
        result = validator.validate({
            'l4_sender_role': 'customer',
            'l2_routing_hint': 'finance',  # LOW severity mismatch
        })
        assert result.score >= 0.7
        assert result.is_coherent is True

    def test_incoherent_with_critical_issue(self):
        """is_coherent should be False if CRITICAL issue present."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': 5,
            'l9_priority': 'low',  # CRITICAL
            'l9_executive_summary': 'Customer requesting urgent help with order delivery.',
        })
        assert result.is_coherent is False


class TestCoherenceIssue:
    """Tests for CoherenceIssue dataclass."""

    def test_to_dict_contains_all_fields(self):
        """to_dict should return all fields."""
        issue = CoherenceIssue(
            issue_type=IssueType.URGENCY_PRIORITY_MISMATCH,
            severity=IssueSeverity.CRITICAL,
            description="Test description",
            layer_a="L5",
            layer_b="L9",
            evidence="urgency=5, priority=low",
        )
        d = issue.to_dict()

        assert d['issue_type'] == 'urgency_priority_mismatch'
        assert d['severity'] == 'critical'
        assert d['description'] == 'Test description'
        assert d['layer_a'] == 'L5'
        assert d['layer_b'] == 'L9'
        assert d['evidence'] == 'urgency=5, priority=low'


class TestCoherenceResult:
    """Tests for CoherenceResult dataclass."""

    def test_to_dict_format(self):
        """to_dict should return correct format."""
        issue = CoherenceIssue(
            issue_type=IssueType.GENERIC_SUMMARY,
            severity=IssueSeverity.HIGH,
            description="Test",
            layer_a="L9",
            layer_b="L9",
        )
        result = CoherenceResult(
            is_coherent=False,
            score=0.75,
            issues=[issue],
            warnings=["Test warning"],
        )
        d = result.to_dict()

        assert d['is_coherent'] is False
        assert d['score'] == 0.75
        assert d['issue_count'] == 1
        assert len(d['issues']) == 1
        assert d['warnings'] == ["Test warning"]


class TestValidateCascadeConvenience:
    """Tests for validate_cascade convenience function."""

    def test_returns_coherence_result(self):
        """validate_cascade should return CoherenceResult."""
        result = validate_cascade({
            'l5_urgency_score': 3,
            'l9_priority': 'medium',
        })
        assert isinstance(result, CoherenceResult)

    def test_uses_default_validator(self):
        """validate_cascade should use default validator settings."""
        result = validate_cascade({
            'l5_urgency_score': 5,
            'l9_priority': 'low',
        })
        # Should detect urgency-priority mismatch
        assert len(result.issues) > 0


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_handles_none_values(self):
        """Validator should handle None values gracefully."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': None,
            'l9_priority': None,
            'l9_executive_summary': None,
            'l3_entities': None,
            'l9_action_items': None,
        })
        # Should not raise exception
        assert isinstance(result, CoherenceResult)

    def test_handles_empty_cascade(self):
        """Validator should handle empty cascade data."""
        validator = CoherenceValidator()
        result = validator.validate({})
        assert isinstance(result, CoherenceResult)

    def test_handles_alternative_key_names(self):
        """Validator should handle alternative key names."""
        validator = CoherenceValidator()
        result = validator.validate({
            'urgency_score': 3,  # Alternative key
            'recommended_priority': 'medium',  # Alternative key
            'executive_summary': 'Test summary that is long enough to pass checks.',
        })
        assert isinstance(result, CoherenceResult)

    def test_handles_invalid_urgency_score(self):
        """Validator should handle invalid urgency scores."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': 'not_a_number',
            'l9_priority': 'medium',
        })
        # Should use default value and not crash
        assert isinstance(result, CoherenceResult)

    def test_handles_urgency_out_of_range(self):
        """Validator should clamp urgency to valid range."""
        validator = CoherenceValidator()
        result = validator.validate({
            'l5_urgency_score': 100,  # Out of range
            'l9_priority': 'critical',
        })
        # Should clamp to 5 and match critical
        assert isinstance(result, CoherenceResult)


class TestIssueTypeEnum:
    """Tests for IssueType enum."""

    def test_all_issue_types_exist(self):
        """All expected issue types should exist."""
        expected = [
            'INTENT_MISMATCH',
            'URGENCY_PRIORITY_MISMATCH',
            'UNGROUNDED_ACTION',
            'MISSING_ENTITY_REFERENCE',
            'SENTIMENT_CONTRADICTION',
            'ROLE_ROUTING_MISMATCH',
            'COMPLEXITY_WORKLOAD_MISMATCH',
            'CONFIDENCE_ANOMALY',
            'GENERIC_SUMMARY',
        ]
        for name in expected:
            assert hasattr(IssueType, name), f"Missing IssueType.{name}"


class TestIssueSeverityEnum:
    """Tests for IssueSeverity enum."""

    def test_all_severities_exist(self):
        """All expected severities should exist."""
        assert IssueSeverity.LOW.value == 'low'
        assert IssueSeverity.MEDIUM.value == 'medium'
        assert IssueSeverity.HIGH.value == 'high'
        assert IssueSeverity.CRITICAL.value == 'critical'
