import argparse
import asyncio
import json
import os
import sys
from typing import Optional

# Ensure UTF-8 output encoding across Windows terminals
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from app.services.orchestrator import execute_scan
from app.models.schema import ScanStatus, Severity


def _color(text: str, code: str) -> str:
    """ANSI color formatter."""
    return f"\033[{code}m{text}\033[0m"


async def run_cli_scan(
    target_url: str,
    prd: Optional[str] = None,
    webhook: Optional[str] = None,
    output_path: Optional[str] = None,
    fail_on_critical: bool = False,
) -> int:
    # Resolve PRD if it's a file path
    prd_text = prd
    if prd and os.path.isfile(prd):
        with open(prd, "r", encoding="utf-8") as f:
            prd_text = f.read()

    print(_color("\n=======================================================", "34"))
    print(_color(" 🛡️  WebGuard & UX Auditor — Autonomous QA Scanner", "1;36"))
    print(_color("=======================================================", "34"))
    print(f" Target URL: {_color(target_url, '1;37')}")
    if prd_text:
        print(f" PRD Spec:   {_color('Enabled (' + str(len(prd_text)) + ' chars)', '32')}")
    if webhook:
        print(f" Webhook:    {_color(webhook, '35')}")
    print(" Running autonomous security, UX, network & QA audit...\n")

    result = await execute_scan(target_url, prd_content=prd_text, webhook_url=webhook)

    if result.status == ScanStatus.FAILED:
        print(_color(f"[!] Scan Failed: {result.error_message}", "1;31"))
        return 2

    # Scores
    sec_color = "1;32" if result.security_score >= 80 else ("1;33" if result.security_score >= 50 else "1;31")
    ux_color = "1;32" if result.ux_score >= 80 else ("1;33" if result.ux_score >= 50 else "1;31")

    print(_color("--- Audit Summary ---", "1;34"))
    print(f" Security Score : {_color(str(result.security_score) + '/100', sec_color)}")
    print(f" UX Score       : {_color(str(result.ux_score) + '/100', ux_color)}")
    print(f" Total Findings : {_color(str(len(result.findings)), '1;37')}")
    print(f" Network Traces : {_color(str(len(result.network_traces or [])), '36')} requests")

    # Severity Breakdown
    sev_counts = {s: sum(1 for f in result.findings if f.severity == s) for s in Severity}
    print("\n Severity Breakdown:")
    for sev in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO):
        count = sev_counts[sev]
        c_code = "31" if sev in (Severity.CRITICAL, Severity.HIGH) else ("33" if sev == Severity.MEDIUM else "32")
        print(f"   • {sev.value:<8}: {_color(str(count), c_code)}")

    # PRD Scenarios
    if result.prd_analysis:
        print(_color(f"\n PRD Scenarios ({len(result.prd_analysis.scenarios)}):", "1;35"))
        for sc in result.prd_analysis.scenarios[:3]:
            print(f"   • [{sc.role}] {sc.title}")

    # Output file
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result.dict(), f, indent=2, default=str)
        print(_color(f"\n[+] Full report exported to: {output_path}", "32"))

    print(_color("=======================================================\n", "34"))

    # CI check
    if fail_on_critical and sev_counts[Severity.CRITICAL] > 0:
        print(_color(f"[!] CI Failure: Found {sev_counts[Severity.CRITICAL]} CRITICAL finding(s).", "1;31"))
        return 1

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="webguard",
        description="WebGuard & UX Auditor Autonomous CLI Scanner (TestSprite style)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Run autonomous audit on a target URL")
    scan_parser.add_argument("url", help="Target website URL (e.g. https://example.com)")
    scan_parser.add_argument("--prd", help="PRD file path or raw text specification for AI test generation", default=None)
    scan_parser.add_argument("--webhook", help="Slack / Discord webhook URL for notifications", default=None)
    scan_parser.add_argument("--output", "-o", help="Save audit result as JSON file", default=None)
    scan_parser.add_argument("--fail-on-critical", action="store_true", help="Exit code 1 if critical issues found (for CI/CD)")

    args = parser.parse_args()

    if args.command == "scan":
        code = asyncio.run(
            run_cli_scan(
                target_url=args.url,
                prd=args.prd,
                webhook=args.webhook,
                output_path=args.output,
                fail_on_critical=args.fail_on_critical,
            )
        )
        sys.exit(code)


if __name__ == "__main__":
    main()
