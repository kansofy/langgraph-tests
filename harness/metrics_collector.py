"""
Metrics Collector for V2.1 Test Harness

Collects and aggregates metrics during test execution:
- Pass/fail counts
- Execution times
- Token usage
- Cost estimates
"""

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class TestMetric:
    """Single test metric record."""
    test_name: str
    test_file: str
    test_class: str
    status: str  # 'passed', 'failed', 'skipped', 'error'
    duration_ms: int
    tokens_input: int = 0
    tokens_output: int = 0
    error_message: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'test_name': self.test_name,
            'test_file': self.test_file,
            'test_class': self.test_class,
            'status': self.status,
            'duration_ms': self.duration_ms,
            'tokens_input': self.tokens_input,
            'tokens_output': self.tokens_output,
            'error_message': self.error_message,
            'timestamp': self.timestamp.isoformat(),
        }


@dataclass
class CategoryMetrics:
    """Metrics aggregated by category (unit, integration, e2e)."""
    category: str
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    errors: int = 0
    total_duration_ms: int = 0
    total_tokens_input: int = 0
    total_tokens_output: int = 0

    @property
    def pass_rate(self) -> float:
        """Calculate pass rate as percentage."""
        if self.total == 0:
            return 0.0
        return (self.passed / self.total) * 100

    @property
    def cost_estimate(self) -> float:
        """Estimate cost based on token usage (Haiku/Sonnet mix)."""
        # Assume mix of Haiku ($0.25/M in, $1.25/M out) and Sonnet ($3/M in, $15/M out)
        # Conservative estimate using Sonnet pricing
        return (self.total_tokens_input * 3 / 1_000_000) + (self.total_tokens_output * 15 / 1_000_000)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'category': self.category,
            'total': self.total,
            'passed': self.passed,
            'failed': self.failed,
            'skipped': self.skipped,
            'errors': self.errors,
            'pass_rate': round(self.pass_rate, 1),
            'total_duration_ms': self.total_duration_ms,
            'total_tokens_input': self.total_tokens_input,
            'total_tokens_output': self.total_tokens_output,
            'cost_estimate': round(self.cost_estimate, 4),
        }


class MetricsCollector:
    """
    Collects and aggregates test metrics during V2.1 test runs.

    Usage:
        collector = MetricsCollector()

        # Record individual tests
        collector.record_test(
            test_name='test_coherence_rate',
            test_file='test_v21_coherence_integration.py',
            test_class='TestCoherenceOnRealData',
            status='passed',
            duration_ms=1234,
        )

        # Get aggregated results
        summary = collector.get_summary()
    """

    def __init__(self):
        self.metrics: List[TestMetric] = []
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None

    def start_run(self) -> None:
        """Mark the start of a test run."""
        self.start_time = datetime.now(timezone.utc)
        self.metrics = []

    def end_run(self) -> None:
        """Mark the end of a test run."""
        self.end_time = datetime.now(timezone.utc)

    def record_test(
        self,
        test_name: str,
        test_file: str,
        test_class: str,
        status: str,
        duration_ms: int,
        tokens_input: int = 0,
        tokens_output: int = 0,
        error_message: Optional[str] = None,
    ) -> None:
        """Record a single test result."""
        metric = TestMetric(
            test_name=test_name,
            test_file=test_file,
            test_class=test_class,
            status=status,
            duration_ms=duration_ms,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            error_message=error_message,
        )
        self.metrics.append(metric)

    def _categorize_test(self, test_file: str) -> str:
        """Determine test category from file path."""
        if 'e2e' in test_file:
            return 'e2e'
        elif 'integration' in test_file:
            return 'integration'
        else:
            return 'unit'

    def get_category_metrics(self, category: str) -> CategoryMetrics:
        """Get aggregated metrics for a specific category."""
        cm = CategoryMetrics(category=category)

        for m in self.metrics:
            if self._categorize_test(m.test_file) != category:
                continue

            cm.total += 1
            cm.total_duration_ms += m.duration_ms
            cm.total_tokens_input += m.tokens_input
            cm.total_tokens_output += m.tokens_output

            if m.status == 'passed':
                cm.passed += 1
            elif m.status == 'failed':
                cm.failed += 1
            elif m.status == 'skipped':
                cm.skipped += 1
            else:  # error
                cm.errors += 1

        return cm

    def get_summary(self) -> Dict[str, Any]:
        """Get complete test run summary."""
        unit_metrics = self.get_category_metrics('unit')
        integration_metrics = self.get_category_metrics('integration')
        e2e_metrics = self.get_category_metrics('e2e')

        total_tests = len(self.metrics)
        total_passed = sum(1 for m in self.metrics if m.status == 'passed')
        total_failed = sum(1 for m in self.metrics if m.status == 'failed')
        total_skipped = sum(1 for m in self.metrics if m.status == 'skipped')
        total_errors = sum(1 for m in self.metrics if m.status == 'error')

        total_duration = sum(m.duration_ms for m in self.metrics)
        total_tokens_in = sum(m.tokens_input for m in self.metrics)
        total_tokens_out = sum(m.tokens_output for m in self.metrics)

        # Calculate run duration
        run_duration_ms = 0
        if self.start_time and self.end_time:
            run_duration_ms = int((self.end_time - self.start_time).total_seconds() * 1000)

        return {
            'run_info': {
                'start_time': self.start_time.isoformat() if self.start_time else None,
                'end_time': self.end_time.isoformat() if self.end_time else None,
                'run_duration_ms': run_duration_ms,
            },
            'totals': {
                'tests': total_tests,
                'passed': total_passed,
                'failed': total_failed,
                'skipped': total_skipped,
                'errors': total_errors,
                'pass_rate': round(total_passed / total_tests * 100, 1) if total_tests > 0 else 0,
                'total_duration_ms': total_duration,
                'total_tokens_input': total_tokens_in,
                'total_tokens_output': total_tokens_out,
                'cost_estimate': round(
                    (total_tokens_in * 3 / 1_000_000) + (total_tokens_out * 15 / 1_000_000), 4
                ),
            },
            'by_category': {
                'unit': unit_metrics.to_dict(),
                'integration': integration_metrics.to_dict(),
                'e2e': e2e_metrics.to_dict(),
            },
        }

    def get_failures(self) -> List[Dict[str, Any]]:
        """Get list of failed tests with details."""
        return [
            m.to_dict() for m in self.metrics
            if m.status in ('failed', 'error')
        ]

    def get_slowest_tests(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the slowest tests."""
        sorted_metrics = sorted(self.metrics, key=lambda m: -m.duration_ms)
        return [m.to_dict() for m in sorted_metrics[:limit]]

    def get_expensive_tests(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get tests with highest token usage."""
        sorted_metrics = sorted(
            self.metrics,
            key=lambda m: -(m.tokens_input + m.tokens_output)
        )
        return [m.to_dict() for m in sorted_metrics[:limit] if m.tokens_input > 0]


# Global collector instance
_collector: Optional[MetricsCollector] = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create global metrics collector."""
    global _collector
    if _collector is None:
        _collector = MetricsCollector()
    return _collector


def reset_metrics_collector() -> MetricsCollector:
    """Reset and return fresh metrics collector."""
    global _collector
    _collector = MetricsCollector()
    return _collector


# Pytest plugin hooks for automatic collection
class V21MetricsPlugin:
    """Pytest plugin for automatic metrics collection."""

    def __init__(self):
        self.collector = get_metrics_collector()
        self._test_start_times: Dict[str, float] = {}

    def pytest_sessionstart(self, session):
        """Called at the start of test session."""
        self.collector = reset_metrics_collector()
        self.collector.start_run()

    def pytest_runtest_setup(self, item):
        """Called before test setup."""
        self._test_start_times[item.nodeid] = time.time()

    def pytest_runtest_makereport(self, item, call):
        """Called to create test report."""
        if call.when != 'call':
            return

        # Calculate duration
        start = self._test_start_times.get(item.nodeid, time.time())
        duration_ms = int((time.time() - start) * 1000)

        # Determine status
        if call.excinfo is None:
            status = 'passed'
            error_message = None
        elif call.excinfo.typename == 'Skipped':
            status = 'skipped'
            error_message = str(call.excinfo.value)
        else:
            status = 'failed'
            error_message = str(call.excinfo.value)

        # Extract test info
        test_file = item.fspath.basename if item.fspath else 'unknown'
        test_class = item.cls.__name__ if item.cls else 'unknown'
        test_name = item.name

        # Record metric
        self.collector.record_test(
            test_name=test_name,
            test_file=test_file,
            test_class=test_class,
            status=status,
            duration_ms=duration_ms,
            error_message=error_message,
        )

    def pytest_sessionfinish(self, session, exitstatus):
        """Called at the end of test session."""
        self.collector.end_run()
