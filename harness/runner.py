#!/usr/bin/env python3
"""
LangGraph Test Runner

Single entry point for running all LangGraph tests with reporting.

Usage:
    # Run all tests
    python -m harness.runner --all

    # Run specific categories
    python -m harness.runner --unit
    python -m harness.runner --integration
    python -m harness.runner --e2e

    # Include expensive (Sonnet) tests
    RUN_EXPENSIVE_TESTS=true python -m harness.runner --all --expensive

    # Generate HTML report
    python -m harness.runner --all --report

Prerequisites:
    For integration/e2e tests:
    ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
"""

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from .fixtures import check_ssh_tunnel
from .metrics_collector import get_metrics_collector, reset_metrics_collector
from .report_generator import (
    generate_html_report,
    generate_json_report,
    generate_console_report,
)


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).parent.parent


def run_pytest(
    test_paths: list[str],
    markers: list[str] = None,
    verbose: bool = True,
    report_xml: str = None,
    extra_args: list[str] = None,
) -> int:
    """
    Run pytest with specified paths and options.

    Returns:
        Exit code from pytest
    """
    project_root = get_project_root()

    cmd = ['python', '-m', 'pytest']

    # Add test paths
    for path in test_paths:
        cmd.append(str(project_root / path))

    # Add markers
    if markers:
        cmd.extend(['-m', ' or '.join(markers)])

    # Verbose output
    if verbose:
        cmd.append('-v')

    # XML report for CI
    if report_xml:
        cmd.extend(['--junitxml', report_xml])

    # Extra args
    if extra_args:
        cmd.extend(extra_args)

    print(f"\nRunning: {' '.join(cmd)}\n")
    return subprocess.call(cmd)


def run_unit_tests(verbose: bool = True) -> int:
    """Run unit tests only."""
    return run_pytest(
        test_paths=['tests/unit/'],
        verbose=verbose,
    )


def run_integration_tests(verbose: bool = True, expensive: bool = False) -> int:
    """Run integration tests."""
    if not check_ssh_tunnel():
        print("\nWARNING: SSH tunnel to DEV not active.")
        print("Run: ssh -f -N -L 5433:localhost:5434 root@165.232.86.131")
        print("Integration tests will be skipped.\n")

    extra_args = []
    if not expensive:
        extra_args.extend(['-m', 'not expensive'])

    return run_pytest(
        test_paths=['tests/integration/'],
        verbose=verbose,
        extra_args=extra_args,
    )


def run_e2e_tests(verbose: bool = True, expensive: bool = False) -> int:
    """Run end-to-end tests."""
    if not check_ssh_tunnel():
        print("\nWARNING: SSH tunnel to DEV not active.")
        print("Run: ssh -f -N -L 5433:localhost:5434 root@165.232.86.131")
        print("E2E tests will be skipped.\n")

    extra_args = []
    if not expensive:
        extra_args.extend(['-m', 'not expensive'])

    return run_pytest(
        test_paths=['tests/e2e/'],
        verbose=verbose,
        extra_args=extra_args,
    )


def run_all_tests(verbose: bool = True, expensive: bool = False) -> int:
    """Run all tests."""
    exit_codes = []

    print("\n" + "=" * 60)
    print("RUNNING UNIT TESTS")
    print("=" * 60)
    exit_codes.append(run_unit_tests(verbose))

    print("\n" + "=" * 60)
    print("RUNNING INTEGRATION TESTS")
    print("=" * 60)
    exit_codes.append(run_integration_tests(verbose, expensive))

    print("\n" + "=" * 60)
    print("RUNNING E2E TESTS")
    print("=" * 60)
    exit_codes.append(run_e2e_tests(verbose, expensive))

    # Return non-zero if any failed
    return max(exit_codes) if exit_codes else 0


def generate_reports(output_dir: str = None) -> None:
    """Generate test reports."""
    if output_dir is None:
        output_dir = get_project_root() / 'reports'

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Get collector
    collector = get_metrics_collector()

    # Generate HTML report
    html_path = output_dir / f'langgraph_test_report_{timestamp}.html'
    generate_html_report(collector, str(html_path))
    print(f"HTML report: {html_path}")

    # Generate JSON report
    json_path = output_dir / f'langgraph_test_report_{timestamp}.json'
    generate_json_report(collector, str(json_path))
    print(f"JSON report: {json_path}")

    # Print console report
    print(generate_console_report(collector))

    # Also save a "latest" symlink
    latest_html = output_dir / 'langgraph_test_report.html'
    latest_json = output_dir / 'langgraph_test_report.json'

    # Remove old symlinks if they exist
    for f in [latest_html, latest_json]:
        if f.exists() or f.is_symlink():
            f.unlink()

    # Create new symlinks
    latest_html.symlink_to(html_path.name)
    latest_json.symlink_to(json_path.name)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='LangGraph Test Runner',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
    python -m harness.runner --unit          # Unit tests only
    python -m harness.runner --integration   # Integration tests
    python -m harness.runner --e2e           # E2E tests
    python -m harness.runner --all           # All tests
    python -m harness.runner --all --report  # All tests with report

Prerequisites:
    SSH tunnel: ssh -f -N -L 5433:localhost:5434 root@165.232.86.131
    Expensive tests: export RUN_EXPENSIVE_TESTS=true
        '''
    )

    parser.add_argument('--unit', action='store_true', help='Run unit tests')
    parser.add_argument('--integration', action='store_true', help='Run integration tests')
    parser.add_argument('--e2e', action='store_true', help='Run end-to-end tests')
    parser.add_argument('--all', action='store_true', help='Run all tests')
    parser.add_argument('--expensive', action='store_true', help='Include expensive (Sonnet) tests')
    parser.add_argument('--report', action='store_true', help='Generate HTML/JSON reports')
    parser.add_argument('--output-dir', type=str, default='reports', help='Report output directory')
    parser.add_argument('-v', '--verbose', action='store_true', default=True, help='Verbose output')
    parser.add_argument('-q', '--quiet', action='store_true', help='Quiet output')

    args = parser.parse_args()

    # Set verbose based on quiet flag
    verbose = not args.quiet

    # Set expensive test env var if flag provided
    if args.expensive:
        os.environ['RUN_EXPENSIVE_TESTS'] = 'true'

    # Reset metrics collector
    reset_metrics_collector()

    exit_code = 0

    if args.all:
        exit_code = run_all_tests(verbose, args.expensive)
    elif args.unit:
        exit_code = run_unit_tests(verbose)
    elif args.integration:
        exit_code = run_integration_tests(verbose, args.expensive)
    elif args.e2e:
        exit_code = run_e2e_tests(verbose, args.expensive)
    else:
        # Default: run all
        print("No test category specified. Running all tests...")
        exit_code = run_all_tests(verbose, args.expensive)

    # Generate reports if requested
    if args.report:
        generate_reports(args.output_dir)

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
