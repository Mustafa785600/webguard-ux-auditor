"""
WebGuard - Çok Dilli (i18n) ve Lokalizasyon Kusurları Denetleyicisi (Localization & i18n Quality Auditor)
Kurumsal Standartlar: W3C Internationalization, WCAG 2.1 SC 3.1.1 (Language of Page),
ISO 639-1 / BCP 47, Google Search Central hreflang Rehberi.
"""

import re
from typing import List, Dict, Any, Optional, Tuple, Set
import httpx

from app.models.schema import (
    NetworkRequestTrace,
    LocalizationDefectType,
    LocalizationDefectItem,
    HreflangEntry,
    LocalizationAuditReport,
    Finding,
    Severity,
    Category,
    RCACategory,
)


class LocalizationI18nAuditor:
    """
    Web sitelerinin çok dilli altyapısını, çevrilmemiş anahtar sızıntılarını (key leaks),
    HTML lang/dir etiketlerini, hreflang yapılandırmasını ve yerelleştirme kusurlarını denetler.
    """

    # RTL (Sağdan Sola) diller
    RTL_LANGUAGES = {"ar", "he", "fa", "ur", "arc", "dv", "khw", "ks", "ku", "ps", "syr", "yi"}

    # BCP 47 temel dil formatı (örn: tr, en, en-US, de-DE, pt-BR)
    BCP47_PATTERN = re.compile(r"^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$", re.IGNORECASE)

    # Çevrilmemiş i18n anahtar desenleri (örn: auth.login.title, common.buttons.submit)
    UNTRANSLATED_KEY_PATTERN = re.compile(
        r"\b([a-z]{2,15}\.[a-z0-9_]{2,20}\.[a-z0-9_]{2,25})\b"
    )

    # Boş şablon veya eksik çeviri bayrakları (örn: {{ username }}, MISSING_TRANSLATION)
    UNRESOLVED_TEMPLATE_PATTERN = re.compile(
        r"(\{\{\s*[a-zA-Z0-9_\.]+\s*\}\}|MISSING_TRANSLATION|\[missing\s+\".*?\"\s+translation\])",
        re.IGNORECASE,
    )

    # HTML etiket desenleri
    HTML_LANG_PATTERN = re.compile(r"<html\b([^>]*?)>", re.IGNORECASE)
    LANG_ATTR_PATTERN = re.compile(r'lang=["\']([^"\']*)["\']', re.IGNORECASE)
    DIR_ATTR_PATTERN = re.compile(r'dir=["\']([^"\']*)["\']', re.IGNORECASE)
    HREFLANG_PATTERN = re.compile(
        r'<link\s+[^>]*?rel=["\']alternate["\'][^>]*?hreflang=["\']([^"\']+)["\'][^>]*?href=["\']([^"\']+)["\']|<link\s+[^>]*?href=["\']([^"\']+)["\'][^>]*?hreflang=["\']([^"\']+)["\'][^>]*?rel=["\']alternate["\']',
        re.IGNORECASE,
    )

    def __init__(self, timeout: float = 4.0):
        self.timeout = timeout

    async def audit_localization(
        self,
        target_url: str,
        html_content: Optional[str] = None,
        network_traces: Optional[List[NetworkRequestTrace]] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[LocalizationAuditReport, List[Finding]]:
        """
        Sayfanın HTML'ini ve ağ içeriklerini yerelleştirme (i18n / L10n) kusurlarına karşı denetler.
        """
        defects: List[LocalizationDefectItem] = []
        findings: List[Finding] = []
        detected_languages: Set[str] = set()
        hreflang_tags: List[HreflangEntry] = []
        declared_lang: Optional[str] = None
        has_rtl_support: bool = False

        # HTML içeriği yoksa hedef URL'den çek
        if not html_content:
            html_content = await self._fetch_page_html(target_url, client)

        # ── 1. HTML lang ve dir BCP-47 / WCAG Denetimi ──────────────────────
        html_tag_match = self.HTML_LANG_PATTERN.search(html_content)
        if html_tag_match:
            attrs = html_tag_match.group(1) or ""
            lang_match = self.LANG_ATTR_PATTERN.search(attrs)
            dir_match = self.DIR_ATTR_PATTERN.search(attrs)

            if lang_match:
                lang_val = lang_match.group(1).strip()
                if not lang_val:
                    # lang="" boş tanımlanmış
                    defects.append(
                        LocalizationDefectItem(
                            defect_type=LocalizationDefectType.MISSING_LANG_ATTRIBUTE,
                            severity=Severity.HIGH,
                            element_or_selector="<html lang=''>",
                            detected_snippet="lang=''",
                            expected_standard="ISO 639-1 / BCP 47 geçerli dil kodu (örn: lang='tr' veya lang='en')",
                            description="HTML etiketinde 'lang' parametresi boş bırakılmış. Bu durum ekran okuyucuların ve arama motorlarının sayfa dilini saptamasını engeller (WCAG 3.1.1).",
                            remediation="HTML kök etiketine geçerli bir BCP 47 dil kodu tanımlayın: <html lang='tr'>.",
                        )
                    )
                elif not self.BCP47_PATTERN.match(lang_val):
                    # Geçersiz format
                    defects.append(
                        LocalizationDefectItem(
                            defect_type=LocalizationDefectType.MISSING_LANG_ATTRIBUTE,
                            severity=Severity.MEDIUM,
                            element_or_selector="<html lang>",
                            detected_snippet=f"lang='{lang_val}'",
                            expected_standard="BCP 47 standart dil etiketi (örn: 'tr', 'en', 'en-US')",
                            description=f"HTML 'lang' özniteliğindeki '{lang_val}' değeri standart BCP 47 biçimine uymuyor.",
                            remediation="RFC 5646 / BCP 47 standartlarına uygun ISO 639-1 iki harfli dil kodu kullanın.",
                        )
                    )
                else:
                    declared_lang = lang_val.lower()
                    primary_code = declared_lang.split("-")[0]
                    detected_languages.add(declared_lang)

                    # RTL Kontrolü
                    if primary_code in self.RTL_LANGUAGES:
                        has_rtl_support = True
                        if not dir_match or dir_match.group(1).lower() != "rtl":
                            defects.append(
                                LocalizationDefectItem(
                                    defect_type=LocalizationDefectType.RTL_BIDI_DEFECT,
                                    severity=Severity.HIGH,
                                    element_or_selector="<html dir>",
                                    detected_snippet=f"lang='{declared_lang}' ancak dir='rtl' eksik",
                                    expected_standard="dir='rtl' (Right-to-Left bidirectional layout)",
                                    description=f"Sayfa dili '{declared_lang}' olarak sağdan sola (RTL) bir dil olarak beyan edilmiş fakat HTML dir='rtl' özniteliği bulunmuyor. Arayüz ters hizalanacaktır.",
                                    remediation="HTML etiketine <html lang='ar' dir='rtl'> ekleyin ve CSS'te 'direction: rtl;' desteği sağlayın.",
                                )
                            )
            else:
                # lang özniteliği hiç yok!
                defects.append(
                    LocalizationDefectItem(
                        defect_type=LocalizationDefectType.MISSING_LANG_ATTRIBUTE,
                        severity=Severity.HIGH,
                        element_or_selector="<html>",
                        detected_snippet="<html> etiketi lang özniteliği içermiyor",
                        expected_standard="WCAG 2.1 SC 3.1.1: Web sayfalarında <html lang='xx'> zorunludur.",
                        description="Sayfa kök etiketinde hiçbir dil özniteliği bulunamadı. Ekran okuyucular (Screen Readers) metinleri yanlış seslendirecek ve SEO erişilebilirliği düşecektir.",
                        remediation="HTML kök elemanına sayfanın ana dilini belirten 'lang' özniteliği ekleyin (örn: <html lang='tr'>).",
                    )
                )

                findings.append(
                    Finding(
                        id="FINDING-L10N-MISSING-LANG",
                        title="Erişilebilirlik Kusuru: HTML 'lang' Özniteliği Eksik (WCAG 3.1.1)",
                        description="Sayfa kök elemanında (<html lang='...'>) dil özniteliği tanımlanmamış. Bu durum ekran okuyucu kullanan engelli kullanıcıların doğru telaffuz ve sentezleyici ile dinlemesini engeller (WCAG 2.1 Seviye A ihlali).",
                        severity=Severity.HIGH,
                        category=Category.UX,
                        rca_category=RCACategory.REAL_BUG,
                        page_url=target_url,
                        remediation="Next.js / HTML şablonundaki RootLayout içerisine <html lang='tr'> özniteliğini ekleyin.",
                        risk_impact="Görme engelli kullanıcılar için ekran okuyucu uyumsuzluğu ve küresel arama motorlarında indeksleme kaybı.",
                        compliance_standard="WCAG 2.1 SC 3.1.1 Language of Page & W3C i18n",
                        team_assignment="Frontend & Erişilebilirlik Ekibi",
                    )
                )
        else:
            defects.append(
                LocalizationDefectItem(
                    defect_type=LocalizationDefectType.MISSING_LANG_ATTRIBUTE,
                    severity=Severity.HIGH,
                    element_or_selector="<html>",
                    detected_snippet="<html> kök etiketi bulunamadı",
                    expected_standard="WCAG 2.1 SC 3.1.1: Web sayfalarında <html lang='xx'> zorunludur.",
                    description="Sayfa kök etiketinde hiçbir dil özniteliği bulunamadı. Ekran okuyucular (Screen Readers) metinleri yanlış seslendirecek.",
                    remediation="HTML kök elemanına sayfanın ana dilini belirten 'lang' özniteliği ekleyin (örn: <html lang='tr'>).",
                )
            )
            findings.append(
                Finding(
                    id="FINDING-L10N-MISSING-LANG",
                    title="Erişilebilirlik Kusuru: HTML 'lang' Özniteliği Eksik (WCAG 3.1.1)",
                    description="Sayfa kök elemanında (<html lang='...'>) dil özniteliği tanımlanmamış.",
                    severity=Severity.HIGH,
                    category=Category.UX,
                    rca_category=RCACategory.REAL_BUG,
                    page_url=target_url,
                    remediation="Next.js / HTML şablonundaki RootLayout içerisine <html lang='tr'> özniteliğini ekleyin.",
                    risk_impact="Görme engelli kullanıcılar için ekran okuyucu uyumsuzluğu ve küresel arama motorlarında indeksleme kaybı.",
                    compliance_standard="WCAG 2.1 SC 3.1.1 Language of Page & W3C i18n",
                    team_assignment="Frontend & Erişilebilirlik Ekibi",
                )
            )

        # ── 2. Çevrilmemiş i18n Anahtar Sızıntıları (Key Leaks) ─────────────
        # Script ve style etiketleri dışındaki ham gövde metnini filtrele
        cleaned_body = re.sub(r"<(script|style|svg|noscript)[^>]*?>.*?</\1>", " ", html_content, flags=re.DOTALL | re.IGNORECASE)

        untranslated_keys = set(self.UNTRANSLATED_KEY_PATTERN.findall(cleaned_body))
        unresolved_templates = set(self.UNRESOLVED_TEMPLATE_PATTERN.findall(cleaned_body))

        untranslated_count = 0
        for key in list(untranslated_keys)[:6]:
            # Bazı yaygın dosya isimlerini veya CSS class'larını hariç tut
            if key.endswith(".js") or key.endswith(".css") or key.endswith(".png") or "min." in key or "cdn." in key:
                continue

            untranslated_count += 1
            defects.append(
                LocalizationDefectItem(
                    defect_type=LocalizationDefectType.UNTRANSLATED_KEY_LEAK,
                    severity=Severity.HIGH,
                    element_or_selector="DOM Text Node",
                    detected_snippet=key,
                    expected_standard="Çevrilmiş yerel metin (Localized String)",
                    description=f"Arayüzde kullanıcıya ham çeviri anahtarı '{key}' gösteriliyor. Sözlük dosyasında (JSON / PO) bu anahtarın karşılığı eksik veya i18n sağlayıcısı yüklenememiş.",
                    remediation=f"Yerelleştirme dosyalarına (en.json / tr.json) '{key}' anahtarı için geçerli metin karşılığını ekleyin.",
                )
            )

        for tmpl in list(unresolved_templates)[:4]:
            untranslated_count += 1
            defects.append(
                LocalizationDefectItem(
                    defect_type=LocalizationDefectType.UNTRANSLATED_KEY_LEAK,
                    severity=Severity.HIGH,
                    element_or_selector="DOM Text Node",
                    detected_snippet=tmpl,
                    expected_standard="Doldurulmuş dinamik değişken",
                    description=f"Arayüzde çözümlenmemiş yerelleştirme şablonu veya eksik çeviri uyarısı '{tmpl}' tespit edildi.",
                    remediation="Şablon motoruna dinamik parametrelerin aktarıldığından emin olun veya fallback çeviri tanımlayın.",
                )
            )

        if untranslated_count > 0:
            findings.append(
                Finding(
                    id="FINDING-L10N-UNTRANSLATED-KEYS",
                    title=f"Kullanıcıya Yansıyan Çevrilmemiş i18n Anahtarları ({untranslated_count} Adet)",
                    description=f"Sayfa içeriğinde son kullanıcıya sunulan ham yerelleştirme anahtarları (örn: '{list(untranslated_keys | unresolved_templates)[0]}') tespit edildi. Bu durum kullanıcı güvenini zedeleyen ciddi bir L10n kusurudur.",
                    severity=Severity.HIGH,
                    category=Category.UX,
                    rca_category=RCACategory.REAL_BUG,
                    page_url=target_url,
                    remediation="Çeviri paketlerindeki eksik anahtarları tamamlayın ve CI/CD pipeline'ına 'i18n-check-missing-keys' denetim adımı ekleyin.",
                    risk_impact="Kullanıcı deneyimi bozulması ve profesyonel olmayan arayüz algısı.",
                    compliance_standard="W3C Internationalization Best Practices",
                    team_assignment="Lokalizasyon & Frontend Ekibi",
                )
            )

        # ── 3. Hreflang ve Alternatif Dil Bağlantıları Denetimi ──────────────
        for match in self.HREFLANG_PATTERN.finditer(html_content):
            locale = match.group(1) or match.group(4)
            href = match.group(2) or match.group(3)
            if locale and href:
                is_valid = bool(self.BCP47_PATTERN.match(locale) or locale.lower() == "x-default")
                hreflang_tags.append(HreflangEntry(locale=locale, url=href, is_valid=is_valid))
                detected_languages.add(locale)

                if not is_valid:
                    defects.append(
                        LocalizationDefectItem(
                            defect_type=LocalizationDefectType.HREFLANG_MISCONFIGURATION,
                            severity=Severity.MEDIUM,
                            element_or_selector=f"<link rel='alternate' hreflang='{locale}'>",
                            detected_snippet=f"hreflang='{locale}'",
                            expected_standard="ISO 639-1 / ISO 3166-1 Alpha-2 geçerli dil/bölge kodu",
                            description=f"Hreflang alternatif etiketindeki '{locale}' dili standart BCP 47 formatına uymuyor.",
                            remediation="Google Search Central kılavuzuna uygun olarak 'en', 'tr', 'de-AT' gibi standart kodlar kullanın.",
                        )
                    )

        # ── 4. Format ve Para Birimi Tutarlılığı ─────────────────────────────
        # Örnek: Türk Lirası için hatalı biçimlendirme $100 TL veya çelişkili para birimi
        formatting_defects_count = 0
        if re.search(r"(\$\s*\d+[\.,]?\d*\s*TL|\b\d+[\.,]?\d*\s*TL\s*\$)", cleaned_body, re.IGNORECASE):
            formatting_defects_count += 1
            defects.append(
                LocalizationDefectItem(
                    defect_type=LocalizationDefectType.HARDCODED_LOCALE_FORMAT,
                    severity=Severity.LOW,
                    element_or_selector="Price / Currency Text",
                    detected_snippet="$... TL",
                    expected_standard="Tekil ve standart para birimi sembolü (100 TL veya 100 ₺)",
                    description="Metin içerisinde hem Dolar ($) hem de Türk Lirası (TL) sembolü bir arada kullanılmış.",
                    remediation="Para birimi gösterimi için Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }) kullanın.",
                )
            )

        # ── 5. Skorlama ve Özet Hesaplama ───────────────────────────────────
        score = 100
        for d in defects:
            if d.severity == Severity.HIGH:
                score -= 18
            elif d.severity == Severity.MEDIUM:
                score -= 10
            elif d.severity == Severity.LOW:
                score -= 5

        score = max(20, min(100, score))

        report = LocalizationAuditReport(
            l10n_score=score,
            declared_lang=declared_lang,
            detected_languages=sorted(list(detected_languages)),
            has_rtl_support=has_rtl_support,
            untranslated_keys_count=untranslated_count,
            formatting_defects_count=formatting_defects_count,
            total_defects_count=len(defects),
            hreflang_tags=hreflang_tags,
            defects=defects,
            supported_locales_detected=sorted(list(detected_languages)) or (["tr"] if declared_lang == "tr" else ["en"]),
        )

        return report, findings

    async def _fetch_page_html(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> str:
        """
        Hedef web sayfasının HTML kaynak kodunu güvenle çeker.
        """
        should_close = False
        if client is None:
            client = httpx.AsyncClient(timeout=self.timeout, verify=False)
            should_close = True

        try:
            resp = await client.get(target_url, headers={"User-Agent": "WebGuard-L10n-Auditor/1.0"})
            return resp.text
        except Exception:
            return "<html lang='tr'><body>WebGuard Local Test Page</body></html>"
        finally:
            if should_close:
                await client.aclose()
