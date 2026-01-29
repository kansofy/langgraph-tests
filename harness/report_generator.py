"""
Report Generator for V2.1 Test Harness

Generates HTML and JSON reports from test metrics.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .metrics_collector import MetricsCollector, get_metrics_collector


def generate_html_report(
    collector: Optional[MetricsCollector] = None,
    output_path: Optional[str] = None,
) -> str:
    """
    Generate HTML report from test metrics.

    Args:
        collector: MetricsCollector instance (uses global if not provided)
        output_path: Path to save HTML file (optional)

    Returns:
        HTML content as string
    """
    if collector is None:
        collector = get_metrics_collector()

    summary = collector.get_summary()
    failures = collector.get_failures()
    slowest = collector.get_slowest_tests(5)

    # Build HTML
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V2.1 Test Report - {datetime.now().strftime('%Y-%m-%d %H:%M')}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #FF6B4A, #E55A3C);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .header h1 {{
            font-size: 28px;
            margin-bottom: 10px;
        }}
        .header .meta {{
            font-size: 14px;
            opacity: 0.9;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .summary-card {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .summary-card h3 {{
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 10px;
        }}
        .summary-card .value {{
            font-size: 36px;
            font-weight: bold;
            color: #333;
        }}
        .summary-card .value.success {{ color: #48BB78; }}
        .summary-card .value.warning {{ color: #ED8936; }}
        .summary-card .value.error {{ color: #F56565; }}
        .section {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .section h2 {{
            font-size: 18px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th, td {{
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }}
        th {{
            background: #f9f9f9;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            color: #666;
        }}
        .status {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }}
        .status.passed {{ background: #C6F6D5; color: #276749; }}
        .status.failed {{ background: #FED7D7; color: #C53030; }}
        .status.skipped {{ background: #FEEBC8; color: #C05621; }}
        .progress-bar {{
            height: 8px;
            background: #eee;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }}
        .progress-bar .fill {{
            height: 100%;
            background: #48BB78;
        }}
        .category-row {{ display: flex; justify-content: space-between; margin-bottom: 10px; }}
        .category-label {{ font-weight: 500; }}
        .category-value {{ color: #666; }}
        .footer {{
            text-align: center;
            color: #666;
            font-size: 12px;
            padding: 20px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>L-Cascade V2.1 Test Report</h1>
            <div class="meta">
                Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}<br>
                Duration: {summary['run_info']['run_duration_ms'] / 1000:.1f}s
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">{summary['totals']['tests']}</div>
            </div>
            <div class="summary-card">
                <h3>Pass Rate</h3>
                <div class="value {'success' if summary['totals']['pass_rate'] >= 70 else 'warning' if summary['totals']['pass_rate'] >= 50 else 'error'}">{summary['totals']['pass_rate']}%</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value {'error' if summary['totals']['failed'] > 0 else ''}">{summary['totals']['failed']}</div>
            </div>
            <div class="summary-card">
                <h3>Cost Estimate</h3>
                <div class="value">${summary['totals']['cost_estimate']:.4f}</div>
            </div>
        </div>

        <div class="section">
            <h2>Results by Category</h2>
            {_generate_category_table(summary['by_category'])}
        </div>

        {_generate_failures_section(failures) if failures else ''}

        <div class="section">
            <h2>Slowest Tests</h2>
            {_generate_slowest_table(slowest)}
        </div>

        <div class="footer">
            <p>Generated by Kansofy V2.1 Test Harness</p>
        </div>
    </div>
</body>
</html>'''

    if output_path:
        Path(output_path).write_text(html)

    return html


def _generate_category_table(categories: Dict[str, Dict]) -> str:
    """Generate HTML table for category metrics."""
    rows = []
    for cat_name, metrics in categories.items():
        pass_rate = metrics['pass_rate']
        rows.append(f'''
            <tr>
                <td><strong>{cat_name.upper()}</strong></td>
                <td>{metrics['total']}</td>
                <td><span class="status passed">{metrics['passed']}</span></td>
                <td><span class="status failed">{metrics['failed']}</span></td>
                <td><span class="status skipped">{metrics['skipped']}</span></td>
                <td>
                    {pass_rate}%
                    <div class="progress-bar"><div class="fill" style="width: {pass_rate}%"></div></div>
                </td>
                <td>{metrics['total_duration_ms'] / 1000:.1f}s</td>
            </tr>
        ''')

    return f'''
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Skipped</th>
                    <th>Pass Rate</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
    '''


def _generate_failures_section(failures: List[Dict]) -> str:
    """Generate HTML section for failed tests."""
    rows = []
    for f in failures[:10]:  # Limit to 10
        rows.append(f'''
            <tr>
                <td>{f['test_class']}</td>
                <td>{f['test_name']}</td>
                <td><span class="status failed">{f['status']}</span></td>
                <td><code style="font-size: 11px; color: #C53030;">{(f.get('error_message') or 'N/A')[:100]}</code></td>
            </tr>
        ''')

    return f'''
        <div class="section">
            <h2>Failed Tests ({len(failures)})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Test</th>
                        <th>Status</th>
                        <th>Error</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(rows)}
                </tbody>
            </table>
        </div>
    '''


def _generate_slowest_table(slowest: List[Dict]) -> str:
    """Generate HTML table for slowest tests."""
    rows = []
    for t in slowest:
        rows.append(f'''
            <tr>
                <td>{t['test_class']}</td>
                <td>{t['test_name']}</td>
                <td>{t['duration_ms'] / 1000:.2f}s</td>
                <td><span class="status {t['status']}">{t['status']}</span></td>
            </tr>
        ''')

    return f'''
        <table>
            <thead>
                <tr>
                    <th>Class</th>
                    <th>Test</th>
                    <th>Duration</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
    '''


def generate_json_report(
    collector: Optional[MetricsCollector] = None,
    output_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate JSON report from test metrics.

    Args:
        collector: MetricsCollector instance (uses global if not provided)
        output_path: Path to save JSON file (optional)

    Returns:
        Report as dictionary
    """
    if collector is None:
        collector = get_metrics_collector()

    report = {
        'version': '2.1',
        'generated_at': datetime.now().isoformat(),
        'summary': collector.get_summary(),
        'failures': collector.get_failures(),
        'slowest_tests': collector.get_slowest_tests(10),
        'expensive_tests': collector.get_expensive_tests(10),
    }

    if output_path:
        Path(output_path).write_text(json.dumps(report, indent=2))

    return report


def generate_console_report(
    collector: Optional[MetricsCollector] = None,
) -> str:
    """
    Generate console-friendly text report.

    Args:
        collector: MetricsCollector instance (uses global if not provided)

    Returns:
        Text report as string
    """
    if collector is None:
        collector = get_metrics_collector()

    summary = collector.get_summary()
    failures = collector.get_failures()

    lines = [
        "",
        "=" * 60,
        "L-CASCADE V2.1 TEST REPORT",
        "=" * 60,
        "",
        f"Run Duration: {summary['run_info']['run_duration_ms'] / 1000:.1f}s",
        "",
        "SUMMARY",
        "-" * 40,
        f"  Total Tests:  {summary['totals']['tests']}",
        f"  Passed:       {summary['totals']['passed']}",
        f"  Failed:       {summary['totals']['failed']}",
        f"  Skipped:      {summary['totals']['skipped']}",
        f"  Pass Rate:    {summary['totals']['pass_rate']}%",
        f"  Cost Est:     ${summary['totals']['cost_estimate']:.4f}",
        "",
        "BY CATEGORY",
        "-" * 40,
    ]

    for cat_name, metrics in summary['by_category'].items():
        if metrics['total'] > 0:
            lines.append(
                f"  {cat_name.upper():12s} "
                f"{metrics['passed']:3d}/{metrics['total']:3d} passed "
                f"({metrics['pass_rate']:5.1f}%) "
                f"[{metrics['total_duration_ms']/1000:.1f}s]"
            )

    if failures:
        lines.extend([
            "",
            "FAILURES",
            "-" * 40,
        ])
        for f in failures[:5]:
            lines.append(f"  [{f['test_class']}] {f['test_name']}")
            if f.get('error_message'):
                lines.append(f"    Error: {f['error_message'][:60]}...")

    lines.extend([
        "",
        "=" * 60,
        "",
    ])

    return "\n".join(lines)
