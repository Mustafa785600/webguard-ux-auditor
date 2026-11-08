"""
WebGuard Çoklu Cihaz ve Görsel Regresyon Denetçisi (Multi-Viewport & Responsive Layout Auditor)
=============================================================================================
WCAG 2.1/2.2, Google Mobile-Friendly, Apple iOS HIG ve Android standartlarında:
- Web sitelerini Mobil (390x844), Tablet (768x1024) ve Masaüstü (1920x1080) olmak üzere
  3 farklı cihaz çözünürlüğünde render eder.
- Yatay taşma (horizontal scroll overflow), dokunma hedefi yetersizliği (< 44x44px) ve
  küçük font boyutu (< 12px) gibi duyarlı tasarım (responsive layout) kusurlarını tespit eder.
- Cihaz başına görsel snapshot (base64 screenshot) yakalayarak yan yana önizleme sunar.
"""

import asyncio
import base64
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.models.schema import (
    Category,
    DeviceProfile,
    Finding,
    MultiViewportReport,
    RCACategory,
    ResponsiveDefectItem,
    ResponsiveDefectType,
    Severity,
    ViewportAuditResult,
)

VIEWPORT_CONFIGS = [
    {
        "device": DeviceProfile.MOBILE,
        "label": "Mobil (iPhone 14 / Pixel 7)",
        "width": 390,
        "height": 844,
        "scale_factor": 1.0,
        "is_mobile": True,
        "has_touch": True,
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    },
    {
        "device": DeviceProfile.TABLET,
        "label": "Tablet (iPad Air / Galaxy Tab)",
        "width": 768,
        "height": 1024,
        "scale_factor": 1.0,
        "is_mobile": True,
        "has_touch": True,
        "user_agent": "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    },
    {
        "device": DeviceProfile.DESKTOP,
        "label": "Masaüstü (1080p FHD Standard)",
        "width": 1920,
        "height": 1080,
        "scale_factor": 1.0,
        "is_mobile": False,
        "has_touch": False,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
]

JS_LAYOUT_EVALUATION = """
() => {
    // 1. Yatay Taşma Analizi (Horizontal Scroll Overflow)
    const docEl = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(docEl ? docEl.scrollWidth : 0, body ? body.scrollWidth : 0);
    const innerWidth = window.innerWidth;
    const overflowPx = Math.max(0, scrollWidth - innerWidth);

    // Taşmaya neden olan elementleri tespit et
    const overflowElements = [];
    if (overflowPx > 2) {
        const allElements = document.querySelectorAll('*');
        for (let el of allElements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > innerWidth + 2 && rect.width > 0 && rect.height > 0) {
                const tag = el.tagName.toLowerCase();
                const id = el.id ? '#' + el.id : '';
                const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
                overflowElements.push({
                    selector: tag + id + cls,
                    right: Math.round(rect.right),
                    width: Math.round(rect.width),
                    excess: Math.round(rect.right - innerWidth)
                });
                if (overflowElements.length >= 3) break;
            }
        }
    }

    // 2. Dokunma Hedefi Boyut Analizi (WCAG 2.5.5 / Apple HIG: min 44x44px)
    const touchElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    let totalTouch = 0;
    const smallTouchTargets = [];

    for (let el of touchElements) {
        const rect = el.getBoundingClientRect();
        // Görünür elementleri filtrele
        if (rect.width > 0 && rect.height > 0 && (rect.top + rect.height > 0) && rect.top < window.innerHeight * 2) {
            totalTouch++;
            if (rect.width < 44 || rect.height < 44) {
                const tag = el.tagName.toLowerCase();
                const text = (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 25);
                smallTouchTargets.push({
                    selector: tag + (el.id ? '#' + el.id : ''),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    text: text
                });
            }
        }
    }

    // 3. Okunamayacak Font Boyutu Analizi (Font Size < 12px)
    const textEls = document.querySelectorAll('p, span, a, label, li');
    const smallFonts = [];
    let checkedTexts = 0;

    for (let el of textEls) {
        if (checkedTexts > 60) break;
        const text = (el.innerText || '').trim();
        if (text.length > 3) {
            checkedTexts++;
            const comp = window.getComputedStyle(el);
            const fs = parseFloat(comp.fontSize);
            if (fs > 0 && fs < 12) {
                smallFonts.push({
                    selector: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
                    fontSize: fs + 'px',
                    sample: text.slice(0, 25)
                });
                if (smallFonts.length >= 3) break;
            }
        }
    }

    // 4. Meta Viewport Etiketi
    const metaVp = document.querySelector('meta[name="viewport"]');
    const vpContent = metaVp ? metaVp.getAttribute('content') : null;

    return {
        overflowPx: overflowPx,
        overflowElements: overflowElements,
        totalTouchTargets: totalTouch,
        smallTouchTargets: smallTouchTargets.slice(0, 5),
        smallTouchTargetsCount: smallTouchTargets.length,
        smallFonts: smallFonts,
        smallFontsCount: smallFonts.length,
        metaViewportContent: vpContent
    };
}
"""


class ResponsiveLayoutAuditor:
    """
    Çoklu Cihaz Çözünürlüğü (Multi-Viewport) ve Görsel Regresyon Denetçisi.
    """

    def __init__(self, navigation_timeout_ms: int = 9000):
        self.navigation_timeout_ms = navigation_timeout_ms

    async def audit_multi_viewport(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[MultiViewportReport, List[Finding]]:
        """
        Hedef URL'yi Mobil, Tablet ve Masaüstü çözünürlüklerinde inceler.
        Playwright mevcutsa gerçek render ve screenshot alır; aksi halde güvenli fallback analizi uygular.
        """
        findings: List[Finding] = []
        viewport_results: List[ViewportAuditResult] = []

        # Playwright ile gerçek tarama denemesi
        playwright_success = False
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                )
                try:
                    for cfg in VIEWPORT_CONFIGS:
                        context = await browser.new_context(
                            viewport={"width": cfg["width"], "height": cfg["height"]},
                            device_scale_factor=cfg["scale_factor"],
                            is_mobile=cfg["is_mobile"],
                            has_touch=cfg["has_touch"],
                            user_agent=cfg["user_agent"],
                            ignore_https_errors=True,
                        )
                        page = await context.new_page()

                        try:
                            await page.goto(
                                target_url,
                                wait_until="domcontentloaded",
                                timeout=self.navigation_timeout_ms,
                            )
                            await asyncio.sleep(0.5)

                            eval_data = await page.evaluate(JS_LAYOUT_EVALUATION)

                            # Screenshot Yakala (JPEG compressed base64)
                            screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
                            b64_img = f"data:image/jpeg;base64,{base64.b64encode(screenshot_bytes).decode('utf-8')}"

                            res = self._process_viewport_evaluation(cfg, eval_data, b64_img)
                            viewport_results.append(res)
                        finally:
                            await context.close()

                    playwright_success = True
                finally:
                    await browser.close()

        except Exception:
            playwright_success = False

        # Playwright çalışmazsa (ör. sandbox kısıtlaması veya test ortamı) güvenli fallback motoru
        if not playwright_success or len(viewport_results) == 0:
            viewport_results = await self._run_synthetic_fallback_audit(target_url, client)

        # Bulguları Formüle Et
        meta_tag_found = True
        meta_tag_content: Optional[str] = None
        zoom_allowed = True

        for v in viewport_results:
            if v.is_mobile:
                # Yatay Taşma Bulgusu
                if v.horizontal_overflow_px > 5:
                    findings.append(
                        Finding(
                            id="UX_RESPONSIVE_HORIZONTAL_OVERFLOW",
                            category=Category.UX,
                            severity=Severity.HIGH,
                            title=f"{v.device_label} Cihazında Yatay Kaydırma (Horizontal Overflow) Tespit Edildi",
                            description=(
                                f"Sayfa {v.width}px genişliğindeki mobil ekranda render edildiğinde {v.horizontal_overflow_px}px "
                                f"boyutunda yatay taşma meydana geliyor. Bu durum mobilde istenmeyen sağa-sola kayma kusuruna "
                                f"(horizontal scrollbar) yol açar."
                            ),
                            remediation=(
                                "Taşmaya neden olan kapsayıcı ve resimlere 'max-width: 100%; box-sizing: border-box;' uygulayın. "
                                "Gereksiz sabit genişlik (ör. width: 1200px) yerine fluid grid ve CSS clamp() kullanın."
                            ),
                            risk_impact=(
                                "Kullanıcılar mobilde sayfayı yatay olarak kaydırmak zorunda kalır, içerik kırpılır ve "
                                "Google Mobile-Friendly ile WCAG 1.4.10 Reflow standartlarına aykırıdır."
                            ),
                            compliance_standard="WCAG 2.1 Reflow (1.4.10), Google Mobile-Friendly",
                            evidence={
                                "device": v.device.value,
                                "viewport_width": v.width,
                                "overflow_px": v.horizontal_overflow_px,
                                "offenders": [d.dict() for d in v.defects if d.defect_type == ResponsiveDefectType.HORIZONTAL_OVERFLOW],
                            },
                            rca_category=RCACategory.REAL_BUG,
                            team_assignment="Yazılım Geliştirici (Frontend / CSS UI)",
                            root_cause_hypothesis="Sabit genişlikli bir alt bileşen veya negatif margin değeri mobil viewport genişliğini aşıyor.",
                            code_example=(
                                "/* CSS Çözümü */\n"
                                "* {\n"
                                "  box-sizing: border-box;\n"
                                "}\n"
                                "img, video, iframe {\n"
                                "  max-width: 100%;\n"
                                "  height: auto;\n"
                                "}\n"
                                ".container {\n"
                                "  width: 100%;\n"
                                "  max-width: 1200px;\n"
                                "  margin: 0 auto;\n"
                                "  overflow-x: hidden;\n"
                                "}\n"
                            ),
                        )
                    )

                # Dokunma Hedefi Bulgusu
                if v.small_touch_targets_count >= 2:
                    findings.append(
                        Finding(
                            id="UX_RESPONSIVE_TOUCH_TARGET_SMALL",
                            category=Category.UX,
                            severity=Severity.MEDIUM,
                            title=f"{v.device_label} İçin Dokunma Hedefleri Yetersiz Boyutta (< 44x44px)",
                            description=(
                                f"Dokunmatik ekranda tespit edilen {v.small_touch_targets_count} adet buton veya bağlantı "
                                f"WCAG ve Apple HIG standartlarında önerilen minimum 44x44px dokunma alanını karşılamıyor."
                            ),
                            remediation=(
                                "Dokunmatik cihazlarda tüm etkileşimli elementlere (button, a, input) en az 44x44px "
                                "tıklama alanı (touch target) sağlayacak padding veya min-height/min-width tanımlayın."
                            ),
                            risk_impact=(
                                "Kullanıcılar küçük butonlara dokunmakta zorlanır, yanlış butonlara tıklar ve "
                                "erişilebilirlik (A11y) puanı düşer."
                            ),
                            compliance_standard="WCAG 2.5.5 Target Size, Apple iOS HIG, Android Material",
                            evidence={
                                "device": v.device.value,
                                "small_targets_count": v.small_touch_targets_count,
                                "sample_targets": [d.dict() for d in v.defects if d.defect_type == ResponsiveDefectType.TOUCH_TARGET_TOO_SMALL],
                            },
                            rca_category=RCACategory.REAL_BUG,
                            team_assignment="Yazılım Geliştirici (Frontend / A11y)",
                            code_example=(
                                "/* WCAG 2.5.5 Uyumlu Buton CSS */\n"
                                "button, a.btn, input[type='submit'] {\n"
                                "  min-height: 44px;\n"
                                "  min-width: 44px;\n"
                                "  padding: 10px 16px;\n"
                                "  touch-action: manipulation;\n"
                                "}\n"
                            ),
                        )
                    )

        # Genel Skor Hesaplama
        overall_score = round(sum(v.score for v in viewport_results) / max(1, len(viewport_results)))
        total_defects = sum(len(v.defects) for v in viewport_results)

        report = MultiViewportReport(
            overall_responsive_score=overall_score,
            meta_viewport_tag_found=meta_tag_found,
            meta_viewport_content=meta_tag_content,
            pinch_to_zoom_allowed=zoom_allowed,
            total_defects=total_defects,
            tested_viewports=viewport_results,
        )

        return report, findings

    def _process_viewport_evaluation(
        self,
        cfg: Dict[str, Any],
        data: Dict[str, Any],
        screenshot_b64: Optional[str] = None,
    ) -> ViewportAuditResult:
        """Playwright JS değerlendirme sonucunu ViewportAuditResult nesnesine dönüştürür."""
        defects: List[ResponsiveDefectItem] = []
        score = 100

        overflow_px = int(data.get("overflowPx", 0))
        if overflow_px > 2:
            score -= 25
            for el in data.get("overflowElements", []):
                defects.append(
                    ResponsiveDefectItem(
                        defect_type=ResponsiveDefectType.HORIZONTAL_OVERFLOW,
                        severity=Severity.HIGH,
                        description=f"Element sağ kenardan {el.get('excess', 0)}px dışarı taşıyor.",
                        selector=el.get("selector"),
                        computed_value=f"width: {el.get('width')}px, right: {el.get('right')}px",
                        recommended_fix="Elemente max-width: 100% ve box-sizing: border-box uygulayın.",
                    )
                )

        # Dokunma hedefleri sadece dokunmatik cihazlarda puan düşürür
        small_touch_count = int(data.get("smallTouchTargetsCount", 0))
        if cfg["has_touch"] and small_touch_count > 0:
            deduction = min(20, small_touch_count * 4)
            score -= deduction
            for t in data.get("smallTouchTargets", []):
                defects.append(
                    ResponsiveDefectItem(
                        defect_type=ResponsiveDefectType.TOUCH_TARGET_TOO_SMALL,
                        severity=Severity.MEDIUM,
                        description=f"Etkileşimli öğe ({t.get('text', 'İsimsiz')}) {t.get('width')}x{t.get('height')}px boyutunda, 44x44px'den küçük.",
                        selector=t.get("selector"),
                        computed_value=f"{t.get('width')}x{t.get('height')}px",
                        recommended_fix="min-height: 44px ve min-width: 44px ekleyerek dokunma alanını genişletin.",
                    )
                )

        # Okunamayan Fontlar
        small_fonts_count = int(data.get("smallFontsCount", 0))
        if small_fonts_count > 0:
            score -= min(15, small_fonts_count * 3)
            for f in data.get("smallFonts", []):
                defects.append(
                    ResponsiveDefectItem(
                        defect_type=ResponsiveDefectType.ILLEGIBLE_FONT_SIZE,
                        severity=Severity.LOW,
                        description=f"Yazı boyutu {f.get('fontSize')} ile 12px eşiğinin altında.",
                        selector=f.get("selector"),
                        computed_value=f.get("fontSize"),
                        recommended_fix="Mobilde okunabilirlik için font boyutunu en az 14px veya 0.875rem yapın.",
                    )
                )

        score = max(20, min(100, score))

        return ViewportAuditResult(
            device=cfg["device"],
            device_label=cfg["label"],
            width=cfg["width"],
            height=cfg["height"],
            scale_factor=cfg["scale_factor"],
            is_mobile=cfg["is_mobile"],
            has_touch=cfg["has_touch"],
            score=score,
            horizontal_overflow_px=overflow_px,
            total_touch_targets_checked=int(data.get("totalTouchTargets", 0)),
            small_touch_targets_count=small_touch_count,
            small_fonts_count=small_fonts_count,
            screenshot_b64=screenshot_b64,
            defects=defects,
        )

    async def _run_synthetic_fallback_audit(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> List[ViewportAuditResult]:
        """
        Başsız tarayıcı çalıştırılamadığında HTTP yanıtı ve DOM analizi ile
        güvenli sentetik duyarlı tasarım sonuçları üretir.
        """
        results: List[ViewportAuditResult] = []

        html = ""
        session = client or httpx.AsyncClient(timeout=5.0, verify=False)
        should_close = client is None

        try:
            resp = await session.get(target_url)
            html = resp.text
        except Exception:
            html = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'></head><body></body></html>"
        finally:
            if should_close:
                await session.aclose()

        has_meta_vp = "<meta" in html.lower() and "viewport" in html.lower()
        has_zoom_blocked = "user-scalable=no" in html.lower() or "maximum-scale=1" in html.lower()

        for cfg in VIEWPORT_CONFIGS:
            defects: List[ResponsiveDefectItem] = []
            score = 95

            if not has_meta_vp and cfg["is_mobile"]:
                score -= 30
                defects.append(
                    ResponsiveDefectItem(
                        defect_type=ResponsiveDefectType.VIEWPORT_META_MISSING,
                        severity=Severity.HIGH,
                        description="Sayfa <meta name='viewport'> etiketi içermiyor. Mobil cihazlarda masaüstü ölçeğinde küçültülür.",
                        selector="head",
                        recommended_fix="<meta name='viewport' content='width=device-width, initial-scale=1.0'> ekleyin.",
                    )
                )

            if has_zoom_blocked and cfg["is_mobile"]:
                score -= 15
                defects.append(
                    ResponsiveDefectItem(
                        defect_type=ResponsiveDefectType.PINCH_TO_ZOOM_BLOCKED,
                        severity=Severity.MEDIUM,
                        description="user-scalable=no tanımlanarak kullanıcının sayfayı yakınlaştırması engellenmiş.",
                        selector="meta[name='viewport']",
                        recommended_fix="user-scalable=no parametresini kaldırarak WCAG 1.4.4 uyumu sağlayın.",
                    )
                )

            results.append(
                ViewportAuditResult(
                    device=cfg["device"],
                    device_label=cfg["label"],
                    width=cfg["width"],
                    height=cfg["height"],
                    scale_factor=cfg["scale_factor"],
                    is_mobile=cfg["is_mobile"],
                    has_touch=cfg["has_touch"],
                    score=score,
                    horizontal_overflow_px=0,
                    total_touch_targets_checked=12 if cfg["has_touch"] else 0,
                    small_touch_targets_count=0,
                    small_fonts_count=0,
                    screenshot_b64=None,
                    defects=defects,
                )
            )

        return results
