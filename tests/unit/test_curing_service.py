"""Unit tests for L9 Curing Service.

Tests the L9CuringService which re-processes incoherent envelopes
using Claude Sonnet for improved quality.
"""

import json
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, call

from lcascade.langgraph_common.curing_service import (
    L9CuringService,
    cure_incoherent_envelopes,
)


class TestL9CuringServiceInit:
    """Tests for L9CuringService initialization."""

    def test_default_max_attempts(self):
        """Test that default max_attempts is 3."""
        with patch.dict(os.environ, {}, clear=True):
            service = L9CuringService(postgres_dsn='postgresql://localhost/test')
            assert service.max_attempts == 3

    def test_env_var_max_attempts(self):
        """Test that max_attempts can be set via env var."""
        with patch.dict(os.environ, {'L9_CURING_MAX_ATTEMPTS': '5'}):
            service = L9CuringService(postgres_dsn='postgresql://localhost/test')
            assert service.max_attempts == 5

    def test_constructor_max_attempts_override(self):
        """Test that constructor arg overrides env var."""
        with patch.dict(os.environ, {'L9_CURING_MAX_ATTEMPTS': '5'}):
            service = L9CuringService(
                postgres_dsn='postgresql://localhost/test',
                max_attempts=2,
            )
            assert service.max_attempts == 2

    def test_cure_model_is_sonnet(self):
        """Test that CURE_MODEL is Sonnet."""
        assert L9CuringService.CURE_MODEL == 'claude-sonnet-4-5-20250514'

    def test_default_project_is_l9_curing(self):
        """Test that DEFAULT_PROJECT is l9-curing."""
        assert L9CuringService.DEFAULT_PROJECT == 'l9-curing'


class TestL9CuringServiceGetCandidates:
    """Tests for get_cure_candidates method."""

    @pytest.fixture
    def mock_db_connection(self):
        """Create mock database connection."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        return mock_conn, mock_cursor

    @patch('psycopg2.connect')
    def test_get_candidates_returns_list(self, mock_connect, mock_db_connection):
        """Test that get_cure_candidates returns a list."""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        result = service.get_cure_candidates(limit=10)

        assert isinstance(result, list)
        mock_conn.close.assert_called_once()

    @patch('psycopg2.connect')
    def test_get_candidates_with_score_filters(self, mock_connect, mock_db_connection):
        """Test that score filters are applied to query."""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        service.get_cure_candidates(limit=10, min_score=0.3, max_score=0.7)

        # Check that execute was called with score parameters
        call_args = mock_cursor.execute.call_args
        assert call_args is not None
        query = call_args[0][0]
        params = call_args[0][1]

        # Query should contain score filters
        assert 'coherence_score >=' in query
        assert 'coherence_score <=' in query
        # Params should include max_attempts, min_score, max_score, limit
        assert 0.3 in params
        assert 0.7 in params

    @patch('psycopg2.connect')
    def test_get_candidates_respects_max_attempts(self, mock_connect, mock_db_connection):
        """Test that max_attempts filter is applied."""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []

        service = L9CuringService(
            postgres_dsn='postgresql://localhost/test',
            max_attempts=5,
        )
        service.get_cure_candidates(limit=10)

        call_args = mock_cursor.execute.call_args
        query = call_args[0][0]
        params = call_args[0][1]

        assert 'cure_attempt_count <' in query
        assert 5 in params  # max_attempts value


class TestL9CuringServiceCureSingle:
    """Tests for cure_single method."""

    @pytest.fixture
    def mock_db_setup(self):
        """Create comprehensive mock database setup."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        # Mock coherence validation record
        cv_record = {
            'envelope_id': 'test-envelope-123',
            'coherence_score': 0.5,
            'issue_count': 3,
            'cascade_snapshot': json.dumps({
                'l2_intent': 'order',
                'l5_urgency_score': 3,
            }),
            'cure_attempt_count': 0,
            'original_score': None,
        }

        # Mock envelope record
        envelope_record = {
            'envelope_id': 'test-envelope-123',
            'envelope': {'metadata': {'subject': 'Test'}},
            'processing_state': 'L9_complete',
            'mail_subject': 'Test Subject',
            'body_preview': 'Test body',
            'from_email': 'test@example.com',
            'clean_body': 'Test clean body content',
        }

        # Mock prompt data
        prompt_record = {
            'prompt_content': 'You are an AI...',
            'prompt_version': 'v2.1',
            'model_used': 'claude-haiku-4-5-20251001',
        }

        return mock_conn, mock_cursor, cv_record, envelope_record, prompt_record

    @patch('psycopg2.connect')
    def test_cure_single_returns_error_if_no_cv_record(self, mock_connect):
        """Test that cure_single returns error if no coherence_validation record."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        # Return None for coherence_validation query
        mock_cursor.fetchone.return_value = None

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        result = service.cure_single('nonexistent-envelope')

        assert result['status'] == 'error'
        assert 'No coherence_validation record found' in result['error']

    @patch('psycopg2.connect')
    def test_cure_single_returns_exhausted_if_max_attempts_reached(self, mock_connect):
        """Test that cure_single returns exhausted status if max attempts reached."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        # Return CV record with max attempts reached
        mock_cursor.fetchone.return_value = {
            'envelope_id': 'test-envelope',
            'coherence_score': 0.5,
            'issue_count': 3,
            'cascade_snapshot': '{}',
            'cure_attempt_count': 3,  # Already at max
            'original_score': 0.4,
        }

        service = L9CuringService(
            postgres_dsn='postgresql://localhost/test',
            max_attempts=3,
        )
        result = service.cure_single('test-envelope')

        assert result['status'] == 'exhausted'
        assert 'Max attempts' in result['error']

    @patch('psycopg2.connect')
    @patch('lcascade.langgraph_common.curing_service.setup_langsmith')
    @patch('lcascade.langgraph_common.curing_service.load_active_prompt')
    def test_cure_single_returns_error_if_no_prompt(
        self, mock_load_prompt, mock_setup_ls, mock_connect, mock_db_setup
    ):
        """Test that cure_single returns error if no active prompt."""
        mock_conn, mock_cursor, cv_record, envelope_record, _ = mock_db_setup
        mock_connect.return_value = mock_conn

        # First fetchone returns CV record, second returns envelope
        mock_cursor.fetchone.side_effect = [cv_record, envelope_record]
        mock_load_prompt.return_value = None  # No prompt found

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        result = service.cure_single('test-envelope-123')

        assert result['status'] == 'error'
        assert 'No active L9 prompt' in result['error']


class TestL9CuringServiceCureBatch:
    """Tests for cure_batch method."""

    @patch.object(L9CuringService, 'get_cure_candidates')
    def test_cure_batch_returns_no_candidates_when_empty(self, mock_get_candidates):
        """Test that cure_batch returns no_candidates status when no candidates."""
        mock_get_candidates.return_value = []

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        result = service.cure_batch(limit=10)

        assert result['status'] == 'no_candidates'
        assert result['processed'] == 0

    @patch.object(L9CuringService, 'cure_single')
    @patch.object(L9CuringService, 'get_cure_candidates')
    def test_cure_batch_processes_candidates(self, mock_get_candidates, mock_cure_single):
        """Test that cure_batch processes all candidates."""
        mock_get_candidates.return_value = [
            {'envelope_id': 'env-1', 'cascade_snapshot': {}},
            {'envelope_id': 'env-2', 'cascade_snapshot': {}},
        ]
        mock_cure_single.return_value = {
            'status': 'cured',
            'new_score': 0.9,
            'tokens_in': 1000,
            'tokens_out': 500,
        }

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        result = service.cure_batch(limit=10, max_workers=2)

        assert result['status'] == 'completed'
        assert result['processed'] == 2
        assert result['cured'] == 2
        assert mock_cure_single.call_count == 2

    @patch.object(L9CuringService, 'cure_single')
    @patch.object(L9CuringService, 'get_cure_candidates')
    def test_cure_batch_tracks_metrics(self, mock_get_candidates, mock_cure_single):
        """Test that cure_batch correctly tracks all metrics."""
        mock_get_candidates.return_value = [
            {'envelope_id': 'env-1'},
            {'envelope_id': 'env-2'},
            {'envelope_id': 'env-3'},
        ]

        # Different results for different envelopes
        mock_cure_single.side_effect = [
            {'status': 'cured', 'tokens_in': 1000, 'tokens_out': 500},
            {'status': 'improved', 'tokens_in': 1000, 'tokens_out': 500},
            {'status': 'error', 'error': 'Something failed'},
        ]

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')
        result = service.cure_batch(limit=10)

        assert result['processed'] == 3
        assert result['cured'] == 1
        assert result['improved'] == 1
        assert result['errors'] == 1
        assert result['tokens_in'] == 2000  # Only cured and improved have tokens
        assert result['tokens_out'] == 1000

    @patch.object(L9CuringService, 'cure_single')
    @patch.object(L9CuringService, 'get_cure_candidates')
    def test_cure_batch_respects_max_workers_env(self, mock_get_candidates, mock_cure_single):
        """Test that cure_batch respects L9_CURING_MAX_WORKERS env var."""
        mock_get_candidates.return_value = []

        with patch.dict(os.environ, {'L9_CURING_MAX_WORKERS': '2'}):
            service = L9CuringService(postgres_dsn='postgresql://localhost/test')
            # Request 10 workers but env limits to 2
            service.cure_batch(limit=10, max_workers=10)
            # Can't easily verify worker count, but at least it doesn't error


class TestL9CuringServiceHelpers:
    """Tests for internal helper methods."""

    def test_update_coherence_validation_builds_correct_query(self):
        """Test that _update_coherence_validation builds correct SET clauses."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        service = L9CuringService(postgres_dsn='postgresql://localhost/test')

        # Test with various field types
        service._update_coherence_validation(
            mock_cursor, mock_conn, 'test-envelope',
            is_coherent=True,
            coherence_score=0.85,
            cure_result={'status': 'cured', 'improvement': 0.35},
        )

        # Verify execute was called
        assert mock_cursor.execute.called
        # Check that JSON field was serialized
        call_args = mock_cursor.execute.call_args_list
        # Should have SAVEPOINT, UPDATE, and RELEASE calls
        assert len(call_args) >= 2


class TestCureIncoherentEnvelopes:
    """Tests for convenience function."""

    @patch.object(L9CuringService, 'cure_batch')
    def test_cure_incoherent_envelopes_calls_batch(self, mock_cure_batch):
        """Test that convenience function calls cure_batch."""
        mock_cure_batch.return_value = {'status': 'completed', 'processed': 5}

        result = cure_incoherent_envelopes(
            postgres_dsn='postgresql://localhost/test',
            limit=10,
            max_workers=3,
        )

        mock_cure_batch.assert_called_once_with(limit=10, max_workers=3)
        assert result['status'] == 'completed'


class TestL9CuringServiceIntegration:
    """Integration-style tests (still mocked but test flow)."""

    @patch('psycopg2.connect')
    @patch('lcascade.langgraph_common.curing_service.setup_langsmith')
    @patch('lcascade.langgraph_common.curing_service.load_active_prompt')
    def test_cure_single_complete_flow_success(
        self, mock_load_prompt, mock_setup_ls, mock_connect
    ):
        """Test complete cure flow when curing succeeds."""
        # This is a more comprehensive test of the full flow
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        # Setup all the fetchone responses in sequence
        cv_record = {
            'envelope_id': 'test-env',
            'coherence_score': 0.5,
            'issue_count': 3,
            'cascade_snapshot': json.dumps({
                'l2_intent': 'order',
                'l2_summary': 'Customer order inquiry',
                'l5_urgency_score': 3,
                'l7_suggested_owner': 'sales',
            }),
            'cure_attempt_count': 0,
            'original_score': None,
        }

        envelope_record = {
            'envelope_id': 'test-env',
            'envelope': {'metadata': {'subject': 'Order #123'}},
            'processing_state': 'L9_complete',
            'mail_subject': 'Order #123 inquiry',
            'body_preview': 'I would like to know about my order',
            'from_email': 'customer@example.com',
            'clean_body': 'I would like to know about my order #123 status.',
        }

        mock_cursor.fetchone.side_effect = [cv_record, envelope_record]
        mock_load_prompt.return_value = {
            'prompt_content': 'You are an AI assistant...',
            'prompt_version': 'v2.1',
            'model_used': 'claude-haiku-4-5-20251001',
        }

        # Mock the L9 extraction to return a successful result
        with patch('lcascade.langgraph_l9.runner.run_l9_extraction') as mock_l9:
            mock_l9.return_value = {
                'status': 'success',
                'overview': {
                    'executive_summary': 'Customer inquiring about order #123 status',
                    'recommended_priority': 'medium',
                    'key_finding': 'Order status inquiry',
                    'response_recommendation': 'Provide order status',
                    'confidence': 0.9,
                },
                'action_items': [
                    {
                        'action': 'Check order #123 status',
                        'priority': 'medium',
                        'owner': 'sales',
                        'due_by': 'today',
                    }
                ],
                'tokens_input': 1500,
                'tokens_output': 800,
            }

            service = L9CuringService(postgres_dsn='postgresql://localhost/test')
            result = service.cure_single('test-env')

            # Verify L9 was called with Sonnet model
            mock_l9.assert_called_once()
            call_kwargs = mock_l9.call_args[1]
            assert call_kwargs['model'] == 'claude-sonnet-4-5-20250514'

            # Result should indicate curing status
            assert result['envelope_id'] == 'test-env'
            assert 'status' in result
