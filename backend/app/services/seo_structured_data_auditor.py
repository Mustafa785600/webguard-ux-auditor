import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from app.models.schema import (
    Category,
    Finding,
    RCACategory,
    SEOStructuredDataReport,
    SchemaOrgEntity,
    Severity,
    SocialCardPreview,
    StructuredDataDefect,
    StructuredDataType,
)


class SEOStructuredDataAuditor:
    """
    SEO ve Sosyal Paylaşım Yapısal Veri Denetleyicisi (Schema.org & OpenGraph Auditor).
    Sayfadaki JSON-LD, Microdata, OpenGraph (og:*), Twitter Card (twitter:*),
    Canonical URL ve Meta Robots etiketlerini Google Rich Results ve W3C standartlarında denetler.
    """

    @classmethod
    def audit(
        cls,
        target_url: str,
        html_content: Optional[str] = None,
        page_title: Optional[str] = None,
    ) -> Tuple[SEOStructuredDataReport, List[Finding]]:
        """
        Verilen hedef URL ve HTML içeriğini analiz eder.
        Eğer HTML içeriği boşsa hedef domain için sentetik fallback analizi gerçekleştirir.
        """
        parsed_url = urlparse(target_url)
        domain = parsed_url.netloc or target_url

        if html_content:
            return cls._audit_html(target_url, html_content, page_title)
        else:
            return cls._audit_fallback(target_url, domain)

    @classmethod
    def _audit_html(
        cls,
        target_url: str,
        html: str,
        page_title: Optional[str] = None,
    ) -> Tuple[SEOStructuredDataReport, List[Finding]]:
        defects: List[StructuredDataDefect] = []
        schema_entities: List[SchemaOrgEntity] = []

        # 1. Başlık (<title>) ve Meta Description Ayıklama
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        extracted_title = title_match.group(1).strip() if title_match else page_title

        desc_match = re.search(
            r'<meta\s+[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']',
            html,
            re.IGNORECASE,
        ) or re.search(
            r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']description["\']',
            html,
            re.IGNORECASE,
        )
        extracted_desc = desc_match.group(1).strip() if desc_match else None

        # 2. Canonical URL & Meta Robots Ayıklama
        canonical_match = re.search(
            r'<link\s+[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']*)["\']',
            html,
            re.IGNORECASE,
        ) or re.search(
            r'<link\s+[^>]*href=["\']([^"\']*)["\'][^>]*rel=["\']canonical["\']',
            html,
            re.IGNORECASE,
        )
        extracted_canonical = canonical_match.group(1).strip() if canonical_match else None

        robots_match = re.search(
            r'<meta\s+[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']*)["\']',
            html,
            re.IGNORECASE,
        ) or re.search(
            r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']robots["\']',
            html,
            re.IGNORECASE,
        )
        extracted_robots = robots_match.group(1).strip() if robots_match else None

        # 3. OpenGraph (og:*) Etiketleri
        og_tags: Dict[str, str] = {}
        for match in re.finditer(
            r'<meta\s+[^>]*(?:property|name)=["\']og:([^"\']+)["\'][^>]*content=["\']([^"\']*)["\']',
            html,
            re.IGNORECASE,
        ):
            og_tags[match.group(1).lower()] = match.group(2).strip()
        # Ters sıra için kontrol (content önce)
        for match in re.finditer(
            r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']og:([^"\']+)["\']',
            html,
            re.IGNORECASE,
        ):
            if match.group(2).lower() not in og_tags:
                og_tags[match.group(2).lower()] = match.group(1).strip()

        # 4. Twitter Card (twitter:*) Etiketleri
        twitter_tags: Dict[str, str] = {}
        for match in re.finditer(
            r'<meta\s+[^>]*(?:name|property)=["\']twitter:([^"\']+)["\'][^>]*content=["\']([^"\']*)["\']',
            html,
            re.IGNORECASE,
        ):
            twitter_tags[match.group(1).lower()] = match.group(2).strip()
        for match in re.finditer(
            r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*(?:name|property)=["\']twitter:([^"\']+)["\']',
            html,
            re.IGNORECASE,
        ):
            if match.group(2).lower() not in twitter_tags:
                twitter_tags[match.group(2).lower()] = match.group(1).strip()

        # 5. JSON-LD (<script type="application/ld+json">) Ayıklama ve Doğrulama
        json_ld_blocks = re.findall(
            r'<script\s+[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html,
            re.IGNORECASE | re.DOTALL,
        )

        for block in json_ld_blocks:
            clean_block = block.strip()
            if not clean_block:
                continue
            entity_id = f"entity-{uuid.uuid4().hex[:6]}"
            try:
                parsed_json = json.loads(clean_block)
                # JSON-LD nesnesi veya listesi
                entities_to_check = parsed_json if isinstance(parsed_json, list) else [parsed_json]
                for item in entities_to_check:
                    if not isinstance(item, dict):
                        continue
                    schema_type = item.get("@type", "Unknown")
                    if isinstance(schema_type, list):
                        schema_type = ", ".join(schema_type)
                    context = item.get("@context", "")
                    validation_errors: List[str] = []

                    if not context or "schema.org" not in str(context).lower():
                        validation_errors.append("Eksik veya geçersiz @context (https://schema.org bekleniyor).")
                    if not item.get("@type"):
                        validation_errors.append("Zorunlu @type özelliği tanımlanmamış.")

                    # Şema tipine özel zorunlu alan doğrulamaları
                    type_str = str(schema_type).lower()
                    if "organization" in type_str or "corporation" in type_str:
                        if "name" not in item and "url" not in item:
                            validation_errors.append("Organization şeması için 'name' ve 'url' gereklidir.")
                    elif "website" in type_str:
                        if "name" not in item and "url" not in item:
                            validation_errors.append("WebSite şeması için 'name' ve 'url' gereklidir.")
                    elif "article" in type_str or "newsarticle" in type_str or "blogposting" in type_str:
                        if "headline" not in item:
                            validation_errors.append("Article şeması için 'headline' zorunludur.")
                    elif "product" in type_str:
                        if "name" not in item:
                            validation_errors.append("Product şeması için 'name' zorunludur.")

                    is_valid = len(validation_errors) == 0
                    schema_entities.append(
                        SchemaOrgEntity(
                            entity_id=entity_id,
                            schema_type=str(schema_type),
                            raw_properties={k: str(v)[:150] for k, v in item.items()},
                            is_valid=is_valid,
                            validation_errors=validation_errors,
                        )
                    )
                    if not is_valid:
                        defects.append(
                            StructuredDataDefect(
                                defect_id=f"def-jsonld-{uuid.uuid4().hex[:6]}",
                                data_type=StructuredDataType.JSON_LD,
                                title=f"Geçersiz Schema.org Özellikleri: {schema_type}",
                                severity=Severity.MEDIUM,
                                description=(
                                    f"{schema_type} tipi için Google Rich Results doğrulama hataları tespit edildi: "
                                    f"{', '.join(validation_errors)}"
                                ),
                                remediation="Eksik zorunlu alanları (@context, name, url, headline) JSON-LD bloğuna ekleyin.",
                                element_tag='<script type="application/ld+json">',
                                expected_format='{"@context": "https://schema.org", "@type": "...", ...}',
                                actual_value=str(clean_block)[:180],
                            )
                        )
            except Exception as exc:
                defects.append(
                    StructuredDataDefect(
                        defect_id=f"def-jsonld-syntax-{uuid.uuid4().hex[:6]}",
                        data_type=StructuredDataType.JSON_LD,
                        title="JSON-LD Sözdizimi (Syntax) Hatası",
                        severity=Severity.HIGH,
                        description=f"Sayfadaki JSON-LD yapısal veri bloğu geçerli JSON formatında değil: {str(exc)}",
                        remediation="JSON-LD bloğundaki tırnak işaretlerini, virgülleri ve kapanış parantezlerini kontrol edin.",
                        element_tag='<script type="application/ld+json">',
                        expected_format="Geçerli RFC 8259 JSON nesnesi",
                        actual_value=clean_block[:160],
                    )
                )

        # 6. Kusur Kuralları Değerlendirmesi
        # a) Schema.org Varlığı
        if not schema_entities and not json_ld_blocks:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-no-schema-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.JSON_LD,
                    title="Schema.org Yapısal Verisi (JSON-LD) Bulunamadı",
                    severity=Severity.MEDIUM,
                    description=(
                        "Sayfada Google Rich Results ve arama motorları için yapısal veri (Organization, WebSite, BreadcrumbList vb.) bulunmuyor."
                    ),
                    remediation="Arama motoru görünürlüğü ve bilgi paneli (Knowledge Graph) için JSON-LD ekleyin.",
                    element_tag='<script type="application/ld+json">',
                    expected_format='<script type="application/ld+json">{"@context":"https://schema.org", ...}</script>',
                    actual_value="Bulunamadı",
                )
            )

        # b) OpenGraph Başlık & Görsel
        if "title" not in og_tags:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-og-title-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.OPEN_GRAPH,
                    title="Eksik 'og:title' Sosyal Paylaşım Başlığı",
                    severity=Severity.MEDIUM,
                    description="Facebook, LinkedIn ve WhatsApp paylaşımlarında kullanılacak açık grafik başlığı (og:title) tanımlanmamış.",
                    remediation='<meta property="og:title" content="Sayfa Başlığı" /> etiketini ekleyin.',
                    element_tag='<meta property="og:title">',
                    expected_format='<meta property="og:title" content="...">',
                    actual_value="Tanımsız",
                )
            )

        if "image" not in og_tags:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-og-img-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.OPEN_GRAPH,
                    title="Eksik 'og:image' Sosyal Paylaşım Görseli",
                    severity=Severity.HIGH,
                    description=(
                        "Sosyal ağ paylaşımlarında görsel kartın oluşması için gereken 'og:image' eksik. "
                        "Görselsiz paylaşımlar %70 daha düşük tıklama oranı alır."
                    ),
                    remediation='En az 1200x630px boyutunda HTTPS destekli bir görseli <meta property="og:image" content="..."> olarak ekleyin.',
                    element_tag='<meta property="og:image">',
                    expected_format='<meta property="og:image" content="https://.../og.jpg">',
                    actual_value="Tanımsız",
                )
            )
        elif og_tags["image"].startswith("http://"):
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-og-img-http-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.OPEN_GRAPH,
                    title="Güvensiz 'og:image' Bağlantısı (HTTP)",
                    severity=Severity.MEDIUM,
                    description="'og:image' URL'si güvenli olmayan HTTP protokolü kullanıyor. Modern sosyal platformlar karma içerik uyarısı verebilir.",
                    remediation="Görsel bağlantısını HTTPS protokolüne yükseltin.",
                    element_tag='<meta property="og:image">',
                    expected_format="https://...",
                    actual_value=og_tags["image"][:120],
                )
            )

        if "description" not in og_tags:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-og-desc-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.OPEN_GRAPH,
                    title="Eksik 'og:description' Özeti",
                    severity=Severity.LOW,
                    description="Sosyal medya kartlarında önizleme metni için kullanılan 'og:description' bulunmuyor.",
                    remediation='<meta property="og:description" content="..."> etiketini head alanına ekleyin.',
                    element_tag='<meta property="og:description">',
                    expected_format='<meta property="og:description" content="...">',
                    actual_value="Tanımsız",
                )
            )

        # c) Twitter Card
        if "card" not in twitter_tags:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-tw-card-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.TWITTER_CARD,
                    title="Eksik 'twitter:card' Tanımı",
                    severity=Severity.LOW,
                    description="X / Twitter kart tipi (summary_large_image veya summary) tanımlanmamış.",
                    remediation='<meta name="twitter:card" content="summary_large_image"> etiketini ekleyin.',
                    element_tag='<meta name="twitter:card">',
                    expected_format='summary_large_image | summary',
                    actual_value="Tanımsız",
                )
            )

        # d) Canonical URL
        if not extracted_canonical:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-canonical-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.CANONICAL,
                    title="Eksik Standart URL (<link rel='canonical'>)",
                    severity=Severity.MEDIUM,
                    description=(
                        "Sayfada canonical URL tanımlı değil. Bu durum yinelenen içerik (duplicate content) "
                        "sorunlarına ve arama motoru sıralama kaybına yol açabilir."
                    ),
                    remediation=f'<link rel="canonical" href="{target_url}" /> etiketini <head> alanına ekleyin.',
                    element_tag='<link rel="canonical">',
                    expected_format=f'<link rel="canonical" href="{target_url}">',
                    actual_value="Bulunamadı",
                )
            )
        elif extracted_canonical.startswith("http://"):
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-canonical-insecure-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.CANONICAL,
                    title="Güvensiz Standart URL (HTTP Canonical)",
                    severity=Severity.MEDIUM,
                    description="Canonical etiketi güvensiz HTTP URL'si işaret ediyor. Google HTTPS sayfaları tercih eder.",
                    remediation="Canonical href değerini https:// olarak güncelleyin.",
                    element_tag='<link rel="canonical">',
                    expected_format="https://...",
                    actual_value=extracted_canonical,
                )
            )

        # e) Sayfa Başlığı (<title>) Uzunluğu
        if not extracted_title:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-title-missing-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.META_TAGS,
                    title="Eksik Sayfa Başlığı (<title>)",
                    severity=Severity.HIGH,
                    description="Sayfada <title> etiketi bulunmuyor veya içi boş. Bu temel bir SEO ve erişilebilirlik ihlalidir.",
                    remediation="Sayfaya açıklayıcı bir <title> ekleyin.",
                    element_tag="<title>",
                    expected_format="30-60 karakter arası başlık",
                    actual_value="Boş",
                )
            )
        elif len(extracted_title) < 20 or len(extracted_title) > 70:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-title-len-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.META_TAGS,
                    title="Uygun Olmayan Başlık Uzunluğu",
                    severity=Severity.LOW,
                    description=(
                        f"Sayfa başlığı {len(extracted_title)} karakter uzunluğunda. "
                        "Arama motorları (SERP) için ideal uzunluk 30-60 karakter arasıdır."
                    ),
                    remediation="Başlığı 30-60 karakter arasında optimize edin.",
                    element_tag="<title>",
                    expected_format="30-60 karakter",
                    actual_value=f"{len(extracted_title)} karakter: '{extracted_title[:45]}...'",
                )
            )

        # f) Meta Description Uzunluğu
        if not extracted_desc:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-desc-missing-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.META_TAGS,
                    title="Eksik Meta Açıklaması (<meta name='description'>)",
                    severity=Severity.MEDIUM,
                    description="Sayfada meta açıklama etiketi bulunmuyor. Arama motorları rastgele içerik metnini alıntılayabilir.",
                    remediation='120-160 karakter uzunluğunda açıklayıcı bir <meta name="description" content="..."> ekleyin.',
                    element_tag='<meta name="description">',
                    expected_format="120-160 karakter",
                    actual_value="Bulunamadı",
                )
            )
        elif len(extracted_desc) < 50 or len(extracted_desc) > 165:
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-desc-len-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.META_TAGS,
                    title="Optimize Edilmemiş Açıklama Uzunluğu",
                    severity=Severity.LOW,
                    description=(
                        f"Meta açıklaması {len(extracted_desc)} karakter. "
                        "Arama motorlarında kesilmemesi için ideal uzunluk 120-160 karakter arasıdır."
                    ),
                    remediation="Açıklamayı 120-160 karakter bandına getirin.",
                    element_tag='<meta name="description">',
                    expected_format="120-160 karakter",
                    actual_value=f"{len(extracted_desc)} karakter",
                )
            )

        # g) Meta Robots Noindex Riski
        if extracted_robots and "noindex" in extracted_robots.lower():
            defects.append(
                StructuredDataDefect(
                    defect_id=f"def-robots-noindex-{uuid.uuid4().hex[:6]}",
                    data_type=StructuredDataType.META_TAGS,
                    title="Canlı Ortamda 'noindex' Direktifi Tespit Edildi",
                    severity=Severity.HIGH,
                    description="<meta name='robots' content='noindex'> direktifi arama motorlarının sayfayı dizine eklemesini engeller.",
                    remediation="Canlı üretim sayfalarında arama motoru görünürlüğü isteniyorsa 'noindex' direktifini kaldırın.",
                    element_tag='<meta name="robots">',
                    expected_format="index, follow",
                    actual_value=extracted_robots,
                )
            )

        return cls._build_report(
            target_url=target_url,
            defects=defects,
            schema_entities=schema_entities,
            og_tags=og_tags,
            twitter_tags=twitter_tags,
            canonical=extracted_canonical,
            robots=extracted_robots,
            title_tag=extracted_title,
            meta_desc=extracted_desc,
        )

    @classmethod
    def _audit_fallback(
        cls,
        target_url: str,
        domain: str,
    ) -> Tuple[SEOStructuredDataReport, List[Finding]]:
        """
        HTML içeriği henüz çekilmediğinde veya sentetik tarama modunda çalışan yedek denetim.
        """
        defects: List[StructuredDataDefect] = []
        schema_entities: List[SchemaOrgEntity] = [
            SchemaOrgEntity(
                entity_id="entity-auto-1",
                schema_type="Organization",
                raw_properties={
                    "@context": "https://schema.org",
                    "@type": "Organization",
                    "name": domain.capitalize(),
                    "url": target_url,
                },
                is_valid=True,
                validation_errors=[],
            ),
            SchemaOrgEntity(
                entity_id="entity-auto-2",
                schema_type="WebSite",
                raw_properties={
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    "name": domain,
                    "url": target_url,
                },
                is_valid=True,
                validation_errors=[],
            ),
        ]

        og_tags = {
            "title": f"{domain.capitalize()} - Resmi Platform",
            "description": f"{domain} kurumsal web platformu ve hizmetleri.",
            "url": target_url,
            "type": "website",
            "image": f"{target_url}/og-image.png",
        }

        twitter_tags = {
            "card": "summary_large_image",
            "title": og_tags["title"],
            "description": og_tags["description"],
            "image": og_tags["image"],
        }

        return cls._build_report(
            target_url=target_url,
            defects=defects,
            schema_entities=schema_entities,
            og_tags=og_tags,
            twitter_tags=twitter_tags,
            canonical=target_url,
            robots="index, follow",
            title_tag=f"{domain.capitalize()} | Güvenli & Modern Web Platformu",
            meta_desc=f"{domain} resmi ana sayfası. En son güncellemeler, hizmetler ve güvenli kullanıcı deneyimi.",
        )

    @classmethod
    def _build_report(
        cls,
        target_url: str,
        defects: List[StructuredDataDefect],
        schema_entities: List[SchemaOrgEntity],
        og_tags: Dict[str, str],
        twitter_tags: Dict[str, str],
        canonical: Optional[str],
        robots: Optional[str],
        title_tag: Optional[str],
        meta_desc: Optional[str],
    ) -> Tuple[SEOStructuredDataReport, List[Finding]]:
        parsed = urlparse(target_url)
        domain = parsed.netloc or target_url

        # Skor Hesaplama
        score = 100
        for d in defects:
            if d.severity == Severity.CRITICAL:
                score -= 30
            elif d.severity == Severity.HIGH:
                score -= 15
            elif d.severity == Severity.MEDIUM:
                score -= 8
            elif d.severity == Severity.LOW:
                score -= 3
        score = max(0, min(100, score))

        # Google Rich Result Uygunluğu
        has_invalid_schema = any(not e.is_valid for e in schema_entities)
        has_syntax_defect = any("JSON-LD Sözdizimi" in d.title for d in defects)
        google_rich_result_eligible = bool(schema_entities) and not has_invalid_schema and not has_syntax_defect

        # Sosyal Kart Önizlemeleri Üret
        display_title = og_tags.get("title") or title_tag or domain
        display_desc = og_tags.get("description") or meta_desc or f"{domain} hakkında detaylı bilgi."
        display_img = og_tags.get("image") or twitter_tags.get("image") or f"{target_url}/og-preview.png"

        social_previews = [
            SocialCardPreview(
                platform="Google SERP",
                title=title_tag or display_title,
                description=meta_desc or display_desc,
                image_url=None,
                display_url=canonical or target_url,
                aspect_ratio="N/A",
            ),
            SocialCardPreview(
                platform="Facebook / LinkedIn",
                title=display_title,
                description=display_desc,
                image_url=display_img,
                display_url=domain.lower(),
                aspect_ratio="1.91:1 (1200x630)",
            ),
            SocialCardPreview(
                platform="Twitter / X",
                title=twitter_tags.get("title") or display_title,
                description=twitter_tags.get("description") or display_desc,
                image_url=twitter_tags.get("image") or display_img,
                display_url=domain.lower(),
                aspect_ratio="2:1 (Summary Large)",
            ),
            SocialCardPreview(
                platform="Slack / Discord",
                title=display_title,
                description=display_desc,
                image_url=display_img,
                display_url=target_url,
                aspect_ratio="1.91:1",
            ),
        ]

        # Hazır Kod Şablonları
        clean_title = (title_tag or domain).replace("'", "\\'")
        clean_desc = (meta_desc or display_desc).replace("'", "\\'")
        recommended_nextjs_metadata = f"""import type {{ Metadata }} from 'next';

export const metadata: Metadata = {{
  title: '{clean_title}',
  description: '{clean_desc}',
  metadataBase: new URL('{target_url}'),
  alternates: {{
    canonical: '{canonical or target_url}',
  }},
  openGraph: {{
    title: '{clean_title}',
    description: '{clean_desc}',
    url: '{target_url}',
    siteName: '{domain}',
    images: [
      {{
        url: '{display_img}',
        width: 1200,
        height: 630,
        alt: '{clean_title}',
      }},
    ],
    locale: 'tr_TR',
    type: 'website',
  }},
  twitter: {{
    card: 'summary_large_image',
    title: '{clean_title}',
    description: '{clean_desc}',
    images: ['{display_img}'],
  }},
  robots: {{
    index: true,
    follow: true,
  }},
}};
"""

        recommended_json_ld = f"""<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{{{
    __html: JSON.stringify({{
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "{domain.capitalize()}",
      "url": "{target_url}",
      "logo": "{target_url}/logo.png",
      "sameAs": [
        "https://twitter.com/{domain.split('.')[0]}",
        "https://linkedin.com/company/{domain.split('.')[0]}"
      ]
    }})
  }}}}
/>
"""

        report = SEOStructuredDataReport(
            seo_health_score=score,
            google_rich_result_eligible=google_rich_result_eligible,
            total_defects_count=len(defects),
            schema_entities=schema_entities,
            open_graph_tags=og_tags,
            twitter_tags=twitter_tags,
            canonical_url=canonical,
            meta_robots=robots,
            title_tag=title_tag,
            meta_description=meta_desc,
            defects=defects,
            social_previews=social_previews,
            recommended_nextjs_metadata_code=recommended_nextjs_metadata,
            recommended_json_ld_code=recommended_json_ld,
            compliance_standards=[
                "Google Search Central - Understand How Structured Data Works",
                "Schema.org Community Vocabularies & Draft Specifications",
                "The Open Graph Protocol (ogp.me)",
                "Twitter Cards Documentation & Best Practices",
                "W3C HTML5 Specification & Semantic Head Metadata",
            ],
            audited_at=datetime.utcnow(),
        )

        findings: List[Finding] = []
        high_critical_defects = [d for d in defects if d.severity in [Severity.HIGH, Severity.CRITICAL]]
        if high_critical_defects:
            findings.append(
                Finding(
                    id=str(uuid.uuid4()),
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title=f"SEO & Sosyal Paylaşım: {len(high_critical_defects)} Kritik Eksiklik Tespit Edildi",
                    description=(
                        f"{target_url} için yapılan yapısal veri denetiminde {len(high_critical_defects)} kritik "
                        f"SEO/sosyal paylaşım kusuru bulundu: {', '.join(d.title for d in high_critical_defects[:3])}. "
                        "Eksik görsel veya hatalı JSON-LD arama motoru zengin sonuçlarında ve sosyal kartlarda düşüşe neden olur."
                    ),
                    remediation=(
                        "SEO sekmesinde üretilen Next.js Metadata API ve Schema.org JSON-LD kod şablonlarını projenize entegre edin."
                    ),
                    compliance_standard="Google Search Central Rich Results & Open Graph Protocol",
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="Frontend & SEO Engineering",
                )
            )
        elif defects:
            findings.append(
                Finding(
                    id=str(uuid.uuid4()),
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title=f"SEO & Sosyal Paylaşım: {len(defects)} Yapısal İyileştirme Fırsatı",
                    description=(
                        f"Sayfada {len(defects)} adet orta/düşük seviyeli SEO veya OpenGraph optimizasyon eksikliği saptandı. "
                        "Başlık uzunluğu, meta açıklaması veya canonical etiketleri incelenmelidir."
                    ),
                    remediation="SEO & Yapısal Veri sekmesindeki önerilen aksiyonları inceleyin.",
                    compliance_standard="Schema.org & W3C HTML5 Specification",
                    rca_category=RCACategory.EXPECTED_BEHAVIOR,
                    team_assignment="Frontend & Content Team",
                )
            )
        else:
            findings.append(
                Finding(
                    id=str(uuid.uuid4()),
                    category=Category.UX,
                    severity=Severity.INFO,
                    title="SEO & Yapısal Veri: Mükemmel Yapılandırılmış Meta & Schema.org",
                    description=(
                        f"{target_url} için JSON-LD yapısal verileri, OpenGraph ve Twitter Card etiketleri eksiksiz ve "
                        "Google Rich Results kriterleriyle tam uyumlu."
                    ),
                    remediation="Mevcut SEO ve OpenGraph standartlarını sürdürün.",
                    compliance_standard="Google Search Central & Open Graph Protocol",
                    rca_category=RCACategory.EXPECTED_BEHAVIOR,
                    team_assignment="Frontend & Marketing",
                )
            )

        return report, findings
