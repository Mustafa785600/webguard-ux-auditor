import pytest
from bs4 import BeautifulSoup
from app.models.schema import SectorType, Severity
from app.scanners.security.compliance import ComplianceScanner
from tests.conftest import MockResponse

@pytest.mark.asyncio
async def test_detect_sector_ecommerce():
    scanner = ComplianceScanner()
    html = "<html><body><h1>Online Mağaza</h1><p>Ürün fiyat ve sepet detayları. Sepete ekle ve sipariş ver.</p></body></html>"
    soup = BeautifulSoup(html, "html.parser")
    sector = scanner.detect_sector(soup, "https://shop.example.com", html)
    assert sector == SectorType.ECOMMERCE

@pytest.mark.asyncio
async def test_detect_sector_healthcare():
    scanner = ComplianceScanner()
    html = "<html><body><h1>Özel Klinik</h1><p>Online randevu al, uzman hekim ve poliklinik muayene hizmetleri.</p></body></html>"
    soup = BeautifulSoup(html, "html.parser")
    sector = scanner.detect_sector(soup, "https://klinik.example.com", html)
    assert sector == SectorType.HEALTHCARE

@pytest.mark.asyncio
async def test_detect_sector_gov():
    scanner = ComplianceScanner()
    html = "<html><body><h1>T.C. Çankaya Belediyesi</h1><p>Kurumsal faaliyet raporu ve başkan mesajı.</p></body></html>"
    soup = BeautifulSoup(html, "html.parser")
    sector = scanner.detect_sector(soup, "https://cankaya.bel.gov.tr", html)
    assert sector == SectorType.CORPORATE_GOV

@pytest.mark.asyncio
async def test_detect_sector_saas():
    scanner = ComplianceScanner()
    html = "<html><body><h1>Cloud API Platform</h1><p>Read our developer documentation, SDK and API reference for pricing tiers.</p></body></html>"
    soup = BeautifulSoup(html, "html.parser")
    sector = scanner.detect_sector(soup, "https://cloudapi.io", html)
    assert sector == SectorType.SAAS_API

@pytest.mark.asyncio
async def test_pci_dss_missing_sri(mock_client_factory):
    html = """
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
        <a href="/gizlilik">Gizlilik Politikası</a>
      </head>
      <body></body>
    </html>
    """
    client = mock_client_factory(default=MockResponse(200, html, {"Content-Type": "text/html"}))
    scanner = ComplianceScanner(requested_sector=SectorType.ECOMMERCE)
    findings = await scanner.scan("https://example.com", client)

    sri_findings = [f for f in findings if f.id == "SEC_PCI_MISSING_SRI"]
    assert len(sri_findings) == 1
    assert "PCI-DSS v4.0 Req 6.4.3" in (sri_findings[0].compliance_standard or "")
    assert sri_findings[0].severity == Severity.MEDIUM

@pytest.mark.asyncio
async def test_pci_dss_with_valid_sri(mock_client_factory):
    html = """
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"
                integrity="sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p"
                crossorigin="anonymous"></script>
        <a href="/kvkk">KVKK Aydınlatma Metni</a>
      </head>
      <body></body>
    </html>
    """
    client = mock_client_factory(default=MockResponse(200, html, {"Content-Type": "text/html"}))
    scanner = ComplianceScanner(requested_sector=SectorType.ECOMMERCE)
    findings = await scanner.scan("https://example.com", client)

    sri_findings = [f for f in findings if f.id == "SEC_PCI_MISSING_SRI"]
    assert len(sri_findings) == 0

@pytest.mark.asyncio
async def test_pci_dss_exposed_keys(mock_client_factory):
    dummy_key = "sk_" + "live_" + "51Abcdefghijklmnopqrstuvwxyz12345"
    html = f"""
    <html>
      <head><a href="/gizlilik">Gizlilik</a></head>
      <body>
        <script>
          const stripeSecret = "{dummy_key}";
        </script>
      </body>
    </html>
    """
    client = mock_client_factory(default=MockResponse(200, html, {"Content-Type": "text/html"}))
    scanner = ComplianceScanner(requested_sector=SectorType.ECOMMERCE)
    findings = await scanner.scan("https://example.com", client)

    key_findings = [f for f in findings if f.id == "SEC_PCI_EXPOSED_SECRET_KEY"]
    assert len(key_findings) == 1
    assert key_findings[0].severity == Severity.CRITICAL
    assert "PCI-DSS" in (key_findings[0].compliance_standard or "")

@pytest.mark.asyncio
async def test_kvkk_privacy_policy_missing(mock_client_factory):
    html = "<html><body><h1>Basit Bir Sayfa</h1><p>Hiçbir yasal metin linki yok.</p></body></html>"
    client = mock_client_factory(default=MockResponse(200, html, {"Content-Type": "text/html"}))
    scanner = ComplianceScanner(requested_sector=SectorType.CORPORATE_GOV)
    findings = await scanner.scan("https://example.com", client)

    kvkk_findings = [f for f in findings if f.id == "SEC_KVKK_PRIVACY_POLICY_MISSING"]
    assert len(kvkk_findings) == 1
    assert "KVKK Madde 10" in (kvkk_findings[0].compliance_standard or "")

@pytest.mark.asyncio
async def test_kvkk_cookie_consent_missing(mock_client_factory):
    html = """
    <html>
      <head>
        <script src="https://www.googletagmanager.com/gtm.js?id=GTM-12345"></script>
        <a href="/aydinlatma-metni">KVKK Aydınlatma Metni</a>
      </head>
      <body><h1>Takipçili Sayfa</h1></body>
    </html>
    """
    client = mock_client_factory(default=MockResponse(200, html, {"Content-Type": "text/html"}))
    scanner = ComplianceScanner(requested_sector=SectorType.GENERAL)
    findings = await scanner.scan("https://example.com", client)

    cookie_findings = [f for f in findings if f.id == "SEC_KVKK_COOKIE_CONSENT_MISSING"]
    assert len(cookie_findings) == 1
    assert "ePrivacy" in (cookie_findings[0].compliance_standard or "")

@pytest.mark.asyncio
async def test_hipaa_tracker_leakage(mock_client_factory):
    html = """
    <html>
      <head>
        <a href="/gizlilik">Gizlilik</a>
        <script>
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          fbq('init', '1234567890');
          }(window, document,'script', 'https://connect.facebook.net/en_US/fbevents.js');
        </script>
      </head>
      <body>
        <h1>Hastane Randevu Sistemi</h1>
        <p>Hasta poliklinik doktor muayene randevusu.</p>
      </body>
    </html>
    """
    client = mock_client_factory(default=MockResponse(200, html, {"Content-Type": "text/html"}))
    scanner = ComplianceScanner(requested_sector=SectorType.HEALTHCARE)
    findings = await scanner.scan("https://hastane.example.com", client)

    hipaa_findings = [f for f in findings if f.id == "SEC_HIPAA_TRACKER_LEAKAGE"]
    assert len(hipaa_findings) == 1
    assert hipaa_findings[0].severity == Severity.HIGH
    assert "HIPAA" in (hipaa_findings[0].compliance_standard or "")

@pytest.mark.asyncio
async def test_cors_wildcard(mock_client_factory):
    html = "<html><head><a href='/gizlilik'>Gizlilik</a></head><body>API</body></html>"
    client = mock_client_factory(
        default=MockResponse(
            200,
            html,
            {
                "Content-Type": "text/html",
                "Access-Control-Allow-Origin": "*"
            }
        )
    )
    scanner = ComplianceScanner(requested_sector=SectorType.SAAS_API)
    findings = await scanner.scan("https://example.com", client)

    cors_findings = [f for f in findings if f.id == "SEC_API_WILDCARD_CORS"]
    assert len(cors_findings) == 1
    assert "OWASP API" in (cors_findings[0].compliance_standard or "")
