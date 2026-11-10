import pytest
from app.models.schema import Category, Finding, IncidentChannel, Severity
from app.services.incident_dispatcher import IncidentDispatcherHub


def create_sample_finding(title: str, severity: Severity, category: Category = Category.SECURITY) -> Finding:
    return Finding(
        id="test-f1",
        category=category,
        severity=severity,
        title=title,
        description="Örnek güvenlik açığı detaylı açıklaması ve kök neden analizi.",
        remediation="Gerekli güvenlik yamalarını uygulayın ve giriş doğrulamasını sıkılaştırın.",
    )


def test_slack_block_kit_payload_generation():
    finding = create_sample_finding("SQL Injection Açığı Tespit Edildi", Severity.CRITICAL)
    report, findings = IncidentDispatcherHub.generate_incident_hub(
        target_url="https://app.securebank.com",
        findings=[finding],
        scan_id="scan-test-123",
    )

    assert report.total_incidents_generated >= 5
    assert report.critical_count == 1
    assert report.high_count == 0

    slack_cards = [c for c in report.cards if c.channel == IncidentChannel.SLACK]
    assert len(slack_cards) >= 1
    card = slack_cards[0]

    assert card.severity == Severity.CRITICAL
    payload = card.formatted_payload
    assert "text" in payload
    assert "blocks" in payload
    assert len(payload["blocks"]) >= 4

    # Header bloğu kontrolü
    assert payload["blocks"][0]["type"] == "header"
    assert "SQL Injection" in payload["blocks"][0]["text"]["text"]

    # Alanlar (fields) kontrolü
    section_fields = payload["blocks"][1]["fields"]
    field_texts = [f["text"] for f in section_fields]
    assert any("https://app.securebank.com" in t for t in field_texts)
    assert any("CRITICAL" in t for t in field_texts)

    # curl komutu
    assert card.curl_preview.startswith("curl -X POST")
    assert "hooks.slack.com" in card.curl_preview


def test_teams_adaptive_card_payload_generation():
    finding = create_sample_finding("Zayıf TLS 1.0 Desteği", Severity.HIGH)
    report, _ = IncidentDispatcherHub.generate_incident_hub(
        target_url="https://portal.company.com",
        findings=[finding],
    )

    teams_cards = [c for c in report.cards if c.channel == IncidentChannel.TEAMS]
    assert len(teams_cards) >= 1
    card = teams_cards[0]

    payload = card.formatted_payload
    assert payload["type"] == "message"
    attachment = payload["attachments"][0]
    assert attachment["contentType"] == "application/vnd.microsoft.card.adaptive"

    content = attachment["content"]
    assert content["type"] == "AdaptiveCard"
    assert content["version"] == "1.4"

    # FactSet doğrulaması
    body = content["body"]
    fact_sets = [b for b in body if b.get("type") == "FactSet"]
    assert len(fact_sets) >= 1
    facts = fact_sets[0]["facts"]
    fact_dict = {f["title"]: f["value"] for f in facts}
    assert fact_dict.get("Kritiklik") == "HIGH"
    assert "portal.company.com" in fact_dict.get("Hedef URL", "")


def test_discord_embed_payload_generation():
    critical_finding = create_sample_finding("Uzaktan Kod Yürütme (RCE)", Severity.CRITICAL)
    report, _ = IncidentDispatcherHub.generate_incident_hub(
        target_url="https://api.gateway.internal",
        findings=[critical_finding],
    )

    discord_cards = [c for c in report.cards if c.channel == IncidentChannel.DISCORD]
    assert len(discord_cards) >= 1
    card = discord_cards[0]

    payload = card.formatted_payload
    assert "embeds" in payload
    embed = payload["embeds"][0]

    # Discord kırmızı renk (CRITICAL = 15158332 / 0xE74C3C)
    assert embed["color"] == 15158332
    assert "Uzaktan Kod Yürütme" in embed["title"]
    assert any(f["name"] == "Seviye" and f["value"] == "CRITICAL" for f in embed["fields"])
    assert "footer" in embed
    assert "ISO 27035" in embed["footer"]["text"]


def test_jira_rest_payload_generation():
    finding = create_sample_finding("CORS Yetkisiz Origin İzni", Severity.CRITICAL)
    report, _ = IncidentDispatcherHub.generate_incident_hub(
        target_url="https://auth.banking.corp",
        findings=[finding],
        scan_id="scan-jira-99",
    )

    jira_cards = [c for c in report.cards if c.channel == IncidentChannel.JIRA]
    assert len(jira_cards) >= 1
    card = jira_cards[0]

    payload = card.formatted_payload
    fields = payload["fields"]
    assert fields["project"]["key"] == "SEC"
    assert "[WebGuard]" in fields["summary"]
    assert fields["issuetype"]["name"] == "Bug"
    assert fields["priority"]["name"] == "Highest"
    assert "webguard" in fields["labels"]


def test_clean_state_and_generic_webhook():
    # Hiç bulgu yok (temiz durum)
    report, incident_findings = IncidentDispatcherHub.generate_incident_hub(
        target_url="https://clean-site.example.com",
        findings=[],
    )

    assert report.total_incidents_generated == 5
    assert report.critical_count == 0
    assert report.high_count == 0
    assert len(incident_findings) == 1
    assert incident_findings[0].severity == Severity.INFO
    assert "Sistem Sağlıklı" in incident_findings[0].title

    siem_cards = [c for c in report.cards if c.channel == IncidentChannel.GENERIC_WEBHOOK]
    assert len(siem_cards) == 1
    card = siem_cards[0]

    assert card.status == "SIMULATED_SUCCESS"
    payload = card.formatted_payload
    assert payload["event_type"] == "SECURITY_INCIDENT_RESOLVED"
    assert "integrity_hash" in payload
    assert payload["integrity_hash"].startswith("sha256:")
    assert "CEF:0|WebGuard" in payload["cef_format"]
