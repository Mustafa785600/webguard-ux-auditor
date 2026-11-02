from typing import Optional, Dict, Any
import httpx
from app.models.schema import ScanResult, Severity


def _format_discord_payload(scan: ScanResult) -> Dict[str, Any]:
    critical_count = sum(1 for f in scan.findings if f.severity in (Severity.CRITICAL, Severity.HIGH))
    color = 0x10b981 if critical_count == 0 else (0xef4444 if critical_count > 2 else 0xf59e0b)

    fields = [
        {"name": "🛡️ Security Score", "value": f"**{scan.security_score}/100**", "inline": True},
        {"name": "🎨 UX Score", "value": f"**{scan.ux_score}/100**", "inline": True},
        {"name": "🚨 Critical / High", "value": f"**{critical_count}** issue(s)", "inline": True},
        {"name": "🔍 Total Findings", "value": str(len(scan.findings)), "inline": True},
        {"name": "🌐 Network Requests", "value": str(len(scan.network_traces or [])), "inline": True},
    ]

    top_crit = [f.title for f in scan.findings if f.severity == Severity.CRITICAL][:3]
    if top_crit:
        fields.append({
            "name": "⚠️ Top Critical Vulnerabilities",
            "value": "\n".join(f"• {t}" for t in top_crit),
            "inline": False
        })

    return {
        "username": "WebGuard Autonomous QA",
        "avatar_url": "https://raw.githubusercontent.com/Mustafa785600/webguard-ux-auditor/main/frontend/public/shield.png",
        "embeds": [{
            "title": f"Audit Completed: {scan.target_url}",
            "description": f"Autonomous audit finished with status **{scan.status}**.",
            "color": color,
            "fields": fields,
            "footer": {"text": f"Scan ID: {scan.scan_id[:8]} • WebGuard UX Auditor"}
        }]
    }


def _format_slack_payload(scan: ScanResult) -> Dict[str, Any]:
    critical_count = sum(1 for f in scan.findings if f.severity in (Severity.CRITICAL, Severity.HIGH))
    status_emoji = "✅" if critical_count == 0 else "🚨"

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{status_emoji} WebGuard Audit: {scan.target_url}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Security Score:*\n{scan.security_score}/100"},
                {"type": "mrkdwn", "text": f"*UX Score:*\n{scan.ux_score}/100"},
                {"type": "mrkdwn", "text": f"*Critical / High Issues:*\n{critical_count}"},
                {"type": "mrkdwn", "text": f"*Total Findings:*\n{len(scan.findings)}"}
            ]
        }
    ]

    return {"text": f"Audit Completed for {scan.target_url}", "blocks": blocks}


async def dispatch_webhook(webhook_url: str, scan_result: ScanResult) -> bool:
    """Dispatches formatted audit result to a webhook endpoint asynchronously."""
    if not webhook_url or not webhook_url.startswith(("http://", "https://")):
        return False

    if "discord.com/api/webhooks" in webhook_url:
        payload = _format_discord_payload(scan_result)
    elif "hooks.slack.com" in webhook_url:
        payload = _format_slack_payload(scan_result)
    else:
        payload = {
            "event": "webguard.scan_completed",
            "scan_id": scan_result.scan_id,
            "target_url": scan_result.target_url,
            "status": scan_result.status,
            "security_score": scan_result.security_score,
            "ux_score": scan_result.ux_score,
            "total_findings": len(scan_result.findings),
            "critical_count": sum(1 for f in scan_result.findings if f.severity == Severity.CRITICAL),
            "high_count": sum(1 for f in scan_result.findings if f.severity == Severity.HIGH),
        }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(webhook_url, json=payload)
            return resp.status_code in (200, 204)
    except Exception:
        return False
