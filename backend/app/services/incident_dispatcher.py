import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.models.schema import (
    Category,
    Finding,
    IncidentChannel,
    IncidentHubReport,
    IncidentPayloadCard,
    RCACategory,
    Severity,
)


class IncidentDispatcherHub:
    """
    Otonom Olay Köprüsü ve Webhook Entegrasyon Merkezi (Incident Hub).
    Tarama sırasında tespit edilen kritik/yüksek güvenlik ve dayanıklılık bulgularını
    kurumsal iletişim ve olay yönetim araçlarına (Slack, Teams, Discord, Jira, SIEM)
    uygun zengin veri yüklerine (payload) dönüştürür.
    """

    WEBHOOK_DEFAULTS = {
        IncidentChannel.SLACK: "https://hooks.slack.com/services/T00/B00/XXXXX",
        IncidentChannel.TEAMS: "https://outlook.office.com/webhook/XXXXX",
        IncidentChannel.DISCORD: "https://discord.com/api/webhooks/XXXXX",
        IncidentChannel.JIRA: "https://company.atlassian.net/rest/api/3/issue",
        IncidentChannel.GENERIC_WEBHOOK: "https://siem.corp.internal/v1/incidents",
    }

    @classmethod
    def generate_incident_hub(
        cls,
        target_url: str,
        findings: List[Finding],
        scan_id: Optional[str] = None,
    ) -> Tuple[IncidentHubReport, List[Finding]]:
        """
        Bulguları analiz ederek Slack, Teams, Discord, Jira ve SIEM için
        olay kartları (IncidentPayloadCard) üretir.
        """
        scan_reference = scan_id or f"scan-{uuid.uuid4().hex[:8]}"

        # Kritiklik sırasına göre filtrele
        critical_findings = [f for f in findings if f.severity == Severity.CRITICAL]
        high_findings = [f for f in findings if f.severity == Severity.HIGH]
        medium_findings = [f for f in findings if f.severity == Severity.MEDIUM]

        target_findings = critical_findings + high_findings
        if not target_findings and medium_findings:
            target_findings = medium_findings[:2]

        cards: List[IncidentPayloadCard] = []

        if target_findings:
            # En öncelikli bulgulardan olay kartları üret (en fazla 3 bulgu)
            for finding in target_findings[:3]:
                for channel in [
                    IncidentChannel.SLACK,
                    IncidentChannel.TEAMS,
                    IncidentChannel.DISCORD,
                    IncidentChannel.JIRA,
                    IncidentChannel.GENERIC_WEBHOOK,
                ]:
                    card = cls._create_card_for_finding(
                        target_url=target_url,
                        finding=finding,
                        channel=channel,
                        scan_reference=scan_reference,
                    )
                    cards.append(card)
        else:
            # Temiz durum: Sistem sağlıklı, 0 kritik olay bildirimi üret
            for channel in [
                IncidentChannel.SLACK,
                IncidentChannel.TEAMS,
                IncidentChannel.DISCORD,
                IncidentChannel.JIRA,
                IncidentChannel.GENERIC_WEBHOOK,
            ]:
                card = cls._create_clean_health_card(
                    target_url=target_url,
                    channel=channel,
                    scan_reference=scan_reference,
                )
                cards.append(card)

        # Rapor nesnesi oluştur
        report = IncidentHubReport(
            total_incidents_generated=len(cards),
            critical_count=len(critical_findings),
            high_count=len(high_findings),
            medium_count=len(medium_findings),
            channels_supported=["Slack", "Microsoft Teams", "Discord", "Jira Cloud", "SIEM / Generic Webhook"],
            cards=cards,
            webhook_endpoints_configured=list(cls.WEBHOOK_DEFAULTS.values()),
            audited_at=datetime.utcnow(),
        )

        # Scan finding oluştur
        incident_findings: List[Finding] = []
        if critical_findings or high_findings:
            incident_findings.append(
                Finding(
                    id=str(uuid.uuid4()),
                    category=Category.SECURITY,
                    severity=Severity.CRITICAL if critical_findings else Severity.HIGH,
                    title=f"Otonom Olay Köprüsü: {len(critical_findings)} Kritik, {len(high_findings)} Yüksek Olay Sevkiyata Hazır",
                    description=(
                        f"WebGuard Otonom Olay Köprüsü (Incident Dispatcher), tarama sırasında tespit edilen "
                        f"{len(critical_findings)} kritik ve {len(high_findings)} yüksek riskli bulguyu "
                        f"Slack Block Kit, MS Teams Adaptive Card, Discord Embed, Jira REST API ve SIEM CEF "
                        f"formatlarına otomatik dönüştürdü."
                    ),
                    remediation=(
                        "Olay Köprüsü sekmesinden üretilen yükleri inceleyin, hedef webhook uç noktalarınızı doğrulayın "
                        "ve kritik olayların DevOps/Security ekiplerine anında iletilmesi için webhook tetiğini aktifleştirin."
                    ),
                    compliance_standard="ISO/IEC 27035 Information Security Incident Management",
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="DevSecOps & Platform Security",
                )
            )
        else:
            incident_findings.append(
                Finding(
                    id=str(uuid.uuid4()),
                    category=Category.SECURITY,
                    severity=Severity.INFO,
                    title="Otonom Olay Köprüsü: Sistem Sağlıklı, Bekleyen Kritik Güvenlik Olayı Yok",
                    description=(
                        "WebGuard Olay Köprüsü tarama sonuçlarını denetledi; sevkiyat gerektiren herhangi bir "
                        "kritik veya yüksek seviyeli güvenlik/dayanıklılık açığı tespit edilmedi. "
                        "Tüm entegrasyon kanalları (Slack, Teams, Discord, Jira, SIEM) için hazır sağlık kontrol kartları oluşturuldu."
                    ),
                    remediation="Rutin otomatik taramaların ve webhook bildirim kanallarının açık kalmasını sağlayın.",
                    compliance_standard="ISO/IEC 27035 Information Security Incident Management",
                    rca_category=RCACategory.EXPECTED_BEHAVIOR,
                    team_assignment="DevSecOps & SRE",
                )
            )

        return report, incident_findings

    # ── Yardımcı Fonksiyonlar ───────────────────────────────────────────────

    @classmethod
    def _create_card_for_finding(
        cls,
        target_url: str,
        finding: Finding,
        channel: IncidentChannel,
        scan_reference: str,
    ) -> IncidentPayloadCard:
        card_id = f"inc-{uuid.uuid4().hex[:8]}"
        webhook_url = cls.WEBHOOK_DEFAULTS[channel]

        if channel == IncidentChannel.SLACK:
            payload = cls._build_slack_payload(target_url, finding, scan_reference)
        elif channel == IncidentChannel.TEAMS:
            payload = cls._build_teams_payload(target_url, finding, scan_reference)
        elif channel == IncidentChannel.DISCORD:
            payload = cls._build_discord_payload(target_url, finding, scan_reference)
        elif channel == IncidentChannel.JIRA:
            payload = cls._build_jira_payload(target_url, finding, scan_reference)
        else:
            payload = cls._build_siem_payload(target_url, finding, scan_reference)

        curl_cmd = cls._build_curl(webhook_url, payload)

        return IncidentPayloadCard(
            card_id=card_id,
            channel=channel,
            target_url=target_url,
            title=f"[{channel.value}] {finding.title}",
            severity=finding.severity,
            category=finding.category,
            formatted_payload=payload,
            curl_preview=curl_cmd,
            status="READY_TO_DISPATCH",
            recommended_action=finding.remediation[:180] if finding.remediation else "İnceleme önerilir.",
            created_at=datetime.utcnow(),
        )

    @classmethod
    def _create_clean_health_card(
        cls,
        target_url: str,
        channel: IncidentChannel,
        scan_reference: str,
    ) -> IncidentPayloadCard:
        card_id = f"inc-clean-{uuid.uuid4().hex[:8]}"
        webhook_url = cls.WEBHOOK_DEFAULTS[channel]

        clean_finding = Finding(
            id=str(uuid.uuid4()),
            category=Category.SECURITY,
            severity=Severity.INFO,
            title="Sistem Sağlıklı: Sıfır Kritik Zafiyet",
            description=f"{target_url} için gerçekleştirilen güvenlik ve dayanıklılık taramasında kritik risk saptanmadı.",
            remediation="Mevcut güvenlik standartlarını koruyun ve periyodik taramaları sürdürün.",
        )

        if channel == IncidentChannel.SLACK:
            payload = cls._build_slack_payload(target_url, clean_finding, scan_reference, is_clean=True)
        elif channel == IncidentChannel.TEAMS:
            payload = cls._build_teams_payload(target_url, clean_finding, scan_reference, is_clean=True)
        elif channel == IncidentChannel.DISCORD:
            payload = cls._build_discord_payload(target_url, clean_finding, scan_reference, is_clean=True)
        elif channel == IncidentChannel.JIRA:
            payload = cls._build_jira_payload(target_url, clean_finding, scan_reference, is_clean=True)
        else:
            payload = cls._build_siem_payload(target_url, clean_finding, scan_reference, is_clean=True)

        curl_cmd = cls._build_curl(webhook_url, payload)

        return IncidentPayloadCard(
            card_id=card_id,
            channel=channel,
            target_url=target_url,
            title=f"[{channel.value}] Sistem Sağlıklı - Sıfır Zafiyet",
            severity=Severity.INFO,
            category=Category.SECURITY,
            formatted_payload=payload,
            curl_preview=curl_cmd,
            status="SIMULATED_SUCCESS",
            recommended_action="Mevcut güvenlik profilini koruyun.",
            created_at=datetime.utcnow(),
        )

    # ── Kanal Bazlı Payload Oluşturucular ────────────────────────────────────

    @classmethod
    def _build_slack_payload(
        cls,
        target_url: str,
        finding: Finding,
        scan_reference: str,
        is_clean: bool = False,
    ) -> Dict[str, Any]:
        emoji = "✅" if is_clean else ("🚨" if finding.severity == Severity.CRITICAL else "⚠️")
        headline = "WebGuard Sağlık Bildirimi" if is_clean else f"WebGuard Olay Uyarısı: {finding.title}"

        return {
            "text": f"{emoji} {headline}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} {headline[:100]}",
                        "emoji": True,
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Hedef:*\n<{target_url}|{target_url}>"},
                        {"type": "mrkdwn", "text": f"*Kritiklik:*\n`{finding.severity.value}`"},
                        {"type": "mrkdwn", "text": f"*Kategori:*\n`{finding.category.value}`"},
                        {"type": "mrkdwn", "text": f"*Tarama ID:*\n`{scan_reference}`"},
                    ],
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Açıklama & Kök Neden:*\n{finding.description}",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Önerilen Aksiyon (Remediation):*\n{finding.remediation}",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "WebGuard Paneline Git"},
                            "url": target_url,
                            "style": "primary" if is_clean else "danger",
                        }
                    ],
                },
            ],
        }

    @classmethod
    def _build_teams_payload(
        cls,
        target_url: str,
        finding: Finding,
        scan_reference: str,
        is_clean: bool = False,
    ) -> Dict[str, Any]:
        color = "Good" if is_clean else ("Attention" if finding.severity == Severity.CRITICAL else "Warning")
        title_prefix = "✅ WebGuard Sağlık Bildirimi" if is_clean else "🚨 WebGuard Güvenlik Olayı"

        return {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.4",
                        "msteams": {"width": "Full"},
                        "body": [
                            {
                                "type": "TextBlock",
                                "text": title_prefix,
                                "weight": "Bolder",
                                "size": "Medium",
                                "color": color,
                            },
                            {
                                "type": "TextBlock",
                                "text": finding.title,
                                "weight": "Bolder",
                                "size": "Large",
                                "wrap": True,
                            },
                            {
                                "type": "FactSet",
                                "facts": [
                                    {"title": "Hedef URL", "value": target_url},
                                    {"title": "Kritiklik", "value": finding.severity.value},
                                    {"title": "Kategori", "value": finding.category.value},
                                    {"title": "Tarama No", "value": scan_reference},
                                ],
                            },
                            {
                                "type": "TextBlock",
                                "text": f"**Detay:** {finding.description}",
                                "wrap": True,
                            },
                            {
                                "type": "TextBlock",
                                "text": f"**Çözüm Adımı:** {finding.remediation}",
                                "wrap": True,
                            },
                        ],
                        "actions": [
                            {
                                "type": "Action.OpenUrl",
                                "title": "WebGuard Raporunu Aç",
                                "url": target_url,
                            }
                        ],
                    },
                }
            ],
        }

    @classmethod
    def _build_discord_payload(
        cls,
        target_url: str,
        finding: Finding,
        scan_reference: str,
        is_clean: bool = False,
    ) -> Dict[str, Any]:
        # Discord Renk Kodları (Decimal):
        # Kırmızı: 15158332 (#E74C3C), Turuncu: 15105570 (#E67E22), Sarı: 15844367 (#F1C40F), Yeşil: 3066993 (#2ECC71)
        if is_clean:
            color = 3066993
        elif finding.severity == Severity.CRITICAL:
            color = 15158332
        elif finding.severity == Severity.HIGH:
            color = 15105570
        else:
            color = 15844367

        return {
            "content": "🛡️ **WebGuard Otonom Güvenlik & Olay Bildirimi**",
            "embeds": [
                {
                    "title": finding.title[:250],
                    "description": finding.description[:2000],
                    "color": color,
                    "fields": [
                        {"name": "Hedef URL", "value": target_url, "inline": True},
                        {"name": "Seviye", "value": finding.severity.value, "inline": True},
                        {"name": "Kategori", "value": finding.category.value, "inline": True},
                        {"name": "Önerilen Aksiyon", "value": finding.remediation[:1000], "inline": False},
                    ],
                    "footer": {
                        "text": f"WebGuard Incident Hub • Scan ID: {scan_reference} • ISO 27035 Compliant"
                    },
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
            ],
        }

    @classmethod
    def _build_jira_payload(
        cls,
        target_url: str,
        finding: Finding,
        scan_reference: str,
        is_clean: bool = False,
    ) -> Dict[str, Any]:
        priority_map = {
            Severity.CRITICAL: "Highest",
            Severity.HIGH: "High",
            Severity.MEDIUM: "Medium",
            Severity.LOW: "Low",
            Severity.INFO: "Lowest",
        }
        jira_priority = priority_map.get(finding.severity, "Medium")

        return {
            "fields": {
                "project": {"key": "SEC"},
                "summary": f"[WebGuard] {finding.title}"[:250],
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"WebGuard Otonom Tarama Motoru ({scan_reference}) tarafından raporlanmıştır.",
                                }
                            ],
                        },
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        f"Hedef URL: {target_url}\n"
                                        f"Seviye: {finding.severity.value}\n"
                                        f"Kategori: {finding.category.value}\n\n"
                                        f"Açıklama:\n{finding.description}\n\n"
                                        f"Önerilen Düzeltme:\n{finding.remediation}"
                                    ),
                                }
                            ],
                        },
                    ],
                },
                "issuetype": {"name": "Task" if is_clean else "Bug"},
                "priority": {"name": jira_priority},
                "labels": ["webguard", "automated-incident", "security-audit", finding.category.value.lower()],
            }
        }

    @classmethod
    def _build_siem_payload(
        cls,
        target_url: str,
        finding: Finding,
        scan_reference: str,
        is_clean: bool = False,
    ) -> Dict[str, Any]:
        now_iso = datetime.utcnow().isoformat() + "Z"
        raw_msg = f"{finding.title} | {finding.description}"
        signature_hash = hashlib.sha256(raw_msg.encode("utf-8")).hexdigest()

        cef_severity = 10 if finding.severity == Severity.CRITICAL else (7 if finding.severity == Severity.HIGH else 3)
        cef_string = (
            f"CEF:0|WebGuard|AutonomousScanner|1.0|INC-{finding.severity.value}|{finding.title}|"
            f"{cef_severity}|src={target_url} msg={finding.description[:100]} cs1={scan_reference}"
        )

        return {
            "event_id": f"evt-{uuid.uuid4().hex[:12]}",
            "event_type": "SECURITY_INCIDENT_RESOLVED" if is_clean else "SECURITY_INCIDENT_ALERT",
            "source": "WebGuard-Autonomous-Scanner",
            "timestamp": now_iso,
            "target_url": target_url,
            "incident_title": finding.title,
            "severity": finding.severity.value,
            "category": finding.category.value,
            "scan_id": scan_reference,
            "remediation": finding.remediation,
            "cef_format": cef_string,
            "integrity_hash": f"sha256:{signature_hash}",
            "rfc3339_timestamp": now_iso,
        }

    @classmethod
    def _build_curl(cls, endpoint: str, payload: Dict[str, Any]) -> str:
        payload_json = json.dumps(payload, ensure_ascii=False)
        # Bash / PowerShell uyumlu tek satır curl komutu
        escaped_payload = payload_json.replace('"', '\\"')
        return f'curl -X POST -H "Content-Type: application/json" -d "{escaped_payload}" "{endpoint}"'
