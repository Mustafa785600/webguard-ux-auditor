import pytest
from app.models.schema import Severity, StructuredDataType
from app.services.seo_structured_data_auditor import SEOStructuredDataAuditor


def test_detect_missing_opengraph_and_twitter_cards():
    html_without_social = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Normal Sayfa Başlığı Çok Güzel</title>
        <meta name="description" content="Bu sayfa için yazılmış oldukça detaylı ve yeterli uzunlukta bir meta açıklama metnidir.">
        <link rel="canonical" href="https://example.com/page">
      </head>
      <body><h1>Hoş Geldiniz</h1></body>
    </html>
    """
    report, findings = SEOStructuredDataAuditor.audit(
        target_url="https://example.com/page",
        html_content=html_without_social,
    )

    assert report.seo_health_score < 100
    assert report.total_defects_count >= 3

    defect_titles = [d.title for d in report.defects]
    assert any("og:title" in t for t in defect_titles)
    assert any("og:image" in t for t in defect_titles)
    assert any("twitter:card" in t for t in defect_titles)

    # Finding üretilmiş olmalı
    assert len(findings) >= 1
    assert any("SEO" in f.title for f in findings)


def test_detect_invalid_json_ld_syntax_and_missing_properties():
    html_with_broken_jsonld = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>E-Ticaret Ürün Sayfası Resmi Mağaza</title>
        <meta name="description" content="En uygun fiyatlı kurumsal ürünler ve hızlı teslimat avantajları burada sizleri bekliyor.">
        <link rel="canonical" href="https://shop.example.com/item-1">
        <meta property="og:title" content="Ürün 1">
        <meta property="og:image" content="https://shop.example.com/item.jpg">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Kablosuz Kulaklık",
            "price": 199.99, // Hatalı JSON yorumu ve eksik kapanış
        </script>
      </head>
      <body></body>
    </html>
    """
    report, _ = SEOStructuredDataAuditor.audit(
        target_url="https://shop.example.com/item-1",
        html_content=html_with_broken_jsonld,
    )

    assert report.google_rich_result_eligible is False
    syntax_defects = [d for d in report.defects if d.data_type == StructuredDataType.JSON_LD]
    assert len(syntax_defects) >= 1
    assert any(d.severity == Severity.HIGH for d in syntax_defects)
    assert any("Sözdizimi" in d.title for d in syntax_defects)


def test_detect_missing_canonical_and_title_length_issues():
    html_short_title_no_canonical = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Kısa</title>
        <meta name="robots" content="noindex, nofollow">
      </head>
      <body></body>
    </html>
    """
    report, _ = SEOStructuredDataAuditor.audit(
        target_url="https://example.com/short",
        html_content=html_short_title_no_canonical,
    )

    defect_types = [d.data_type for d in report.defects]
    assert StructuredDataType.CANONICAL in defect_types
    assert StructuredDataType.META_TAGS in defect_types

    defect_titles = [d.title for d in report.defects]
    assert any("Başlık Uzunluğu" in t or "Sayfa Başlığı" in t for t in defect_titles)
    assert any("noindex" in t for t in defect_titles)


def test_generate_rich_social_previews_and_code_snippets():
    html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>WebGuard Güvenlik Platformu</title>
        <meta name="description" content="Web siteniz için otonom güvenlik, performans ve UX kalite kontrol denetleyicisi.">
        <meta property="og:title" content="WebGuard Autonomous Security">
        <meta property="og:description" content="Web siteniz için otonom güvenlik ve UX kalite kontrolü.">
        <meta property="og:image" content="https://webguard.dev/og.png">
        <meta property="og:url" content="https://webguard.dev">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="WebGuard Twitter Card">
        <link rel="canonical" href="https://webguard.dev">
      </head>
      <body></body>
    </html>
    """
    report, _ = SEOStructuredDataAuditor.audit(
        target_url="https://webguard.dev",
        html_content=html,
    )

    assert len(report.social_previews) == 4
    platforms = [p.platform for p in report.social_previews]
    assert "Google SERP" in platforms
    assert "Facebook / LinkedIn" in platforms
    assert "Twitter / X" in platforms
    assert "Slack / Discord" in platforms

    # Kod şablonları
    assert "export const metadata: Metadata" in report.recommended_nextjs_metadata_code
    assert "openGraph:" in report.recommended_nextjs_metadata_code
    assert "application/ld+json" in report.recommended_json_ld_code


def test_clean_hardened_seo_perfect_score():
    perfect_html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>WebGuard - Kurumsal Güvenlik & UX Kalite Denetleyicisi</title>
        <meta name="description" content="WebGuard ile web sitenizin güvenlik açıklarını, performans darboğazlarını ve UX kalitesini anında denetleyin.">
        <link rel="canonical" href="https://webguard.corp/tr">
        <meta name="robots" content="index, follow">
        <meta property="og:title" content="WebGuard - Kurumsal Güvenlik & UX Kalite Denetleyicisi">
        <meta property="og:description" content="WebGuard ile web sitenizin güvenlik açıklarını, performans darboğazlarını ve UX kalitesini anında denetleyin.">
        <meta property="og:image" content="https://webguard.corp/images/og-hero.png">
        <meta property="og:url" content="https://webguard.corp/tr">
        <meta property="og:type" content="website">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="WebGuard - Kurumsal Güvenlik Platformu">
        <meta name="twitter:image" content="https://webguard.corp/images/og-hero.png">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "WebGuard Technologies",
          "url": "https://webguard.corp",
          "logo": "https://webguard.corp/logo.png"
        }
        </script>
      </head>
      <body></body>
    </html>
    """
    report, findings = SEOStructuredDataAuditor.audit(
        target_url="https://webguard.corp/tr",
        html_content=perfect_html,
    )

    assert report.seo_health_score == 100
    assert report.google_rich_result_eligible is True
    assert report.total_defects_count == 0
    assert len(report.schema_entities) == 1
    assert report.schema_entities[0].is_valid is True
    assert len(findings) == 1
    assert findings[0].severity == Severity.INFO

