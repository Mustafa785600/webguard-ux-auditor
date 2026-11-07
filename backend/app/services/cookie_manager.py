"""
Cookie & KVKK / GDPR Consent Management Engine (Privacy-First Hierarchy).

Autonomous Cookie Banner & Modal Dismissal:
Prioritizes user privacy rights in strict order:
1. REJECT_ALL: If "Reddet" / "Reject All" / "Decline" / "Refuse" is available, CLICK IT.
2. NECESSARY_ONLY: If direct rejection is absent, select "Sadece Zorunlu / Özel Çerezler" (Essential Only).
3. CLOSE_OR_DISMISS: If neither rejection nor custom preference is exposed, click "Kapat" / "Anladım" / (X).
4. FORCED_ACCEPT: As an absolute last resort (to avoid freezing the scan if the modal blocks the UI),
   click "Kabul Et", but flag a KVKK / GDPR Dark Pattern Compliance Finding.
5. OVERLAY_CLEANUP: Discard remaining opaque modal backdrops that obscure the DOM.
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from app.models.schema import Finding, Category, Severity, RCACategory, SectorType


@dataclass
class ConsentResult:
    detected: bool = False
    action: str = "NONE"  # "REJECTED" | "NECESSARY_ONLY" | "CLOSED" | "FORCED_ACCEPTED" | "NONE"
    button_text: Optional[str] = None
    selector_used: Optional[str] = None
    dark_pattern_detected: bool = False
    compliance_warning: Optional[str] = None
    details: str = "No consent banner detected"


# ---------------------------------------------------------------------------
# Pre-compiled regex patterns for in-browser evaluation (Turkish & English)
# ---------------------------------------------------------------------------
JS_DISMISSAL_SCRIPT = """
() => {
    // 1. Common CMP container selectors
    const CONTAINER_SELECTORS = [
        '#onetrust-banner-sdk', '#onetrust-consent-sdk',
        '#CybotCookiebotDialog', '#qc-cmp2-container',
        '.cc-window', '#cookie-law-info-bar', '.cookie-banner',
        '.cookie-notice', '.cookie-consent', '.cookie-modal',
        '[aria-label*="cookie" i]', '[aria-label*="çerez" i]',
        '[aria-label*="kvkk" i]', '[id*="cookie" i]', '[class*="cookie" i]',
        '[id*="consent" i]', '[class*="consent" i]', '[id*="kvkk" i]',
        '[class*="kvkk" i]', 'div[role="dialog"]', 'div[role="alertdialog"]'
    ];

    // Priority 1: Reject All / Refuse / Reddet
    const REJECT_SELECTORS = [
        '#onetrust-reject-all-handler',
        '#CybotCookiebotDialogBodyButtonDecline',
        'button[id*="reject" i]', 'button[class*="reject" i]',
        'button[data-testid*="reject" i]', 'a[id*="reject" i]',
        '.klaro-btn-decline', '.uc-btn-deny',
        'button.didomi-components-button--color-negative'
    ];

    // Priority 2: Necessary Only / Preferences / Özel Çerezler
    const NECESSARY_SELECTORS = [
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection',
        'button[id*="necessary" i]', 'button[class*="necessary" i]',
        'button[id*="essential" i]', 'button[class*="essential" i]',
        '.save-preference-btn-handler', '.uc-btn-save', '.klaro-btn-save'
    ];

    // Priority 3: Close / Dismiss / Anladım
    const CLOSE_SELECTORS = [
        'button[aria-label*="close" i]', 'button[aria-label*="kapat" i]',
        '.onetrust-close-btn-handler', 'button.close', '.cookie-close',
        'button[title*="close" i]', 'button[title*="kapat" i]'
    ];

    // Priority 4: Accept All (Fallback only)
    const ACCEPT_SELECTORS = [
        '#onetrust-accept-btn-handler',
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        'button[id*="accept" i]', 'button[class*="accept" i]',
        'button[data-testid*="accept" i]'
    ];

    // Regex text matching
    const RE_REJECT = /\\b(tümünü\\s*reddet|hepsini\\s*reddet|reddet|reddediyorum|kabul\\s*etmiyorum|isteğe\\s*bağlı.*reddet|reddet\\s*ve\\s*kapat|reject\\s*all|reject|refuse\\s*all|refuse|decline\\s*all|decline|deny\\s*all|deny|disagree|opt[\\s-]*out|continue\\s*without\\s*accepting|kabul\\s*etmeden\\s*devam\\s*et)\\b/i;
    const RE_NECESSARY = /\\b(yalnızca\\s*gerekli|yalnızca\\s*zorunlu|sadece\\s*gerekli|sadece\\s*zorunlu|gerekli\\s*çerezler|temel\\s*çerezler|seçilenleri\\s*kaydet|tercihleri\\s*kaydet|sadece\\s*özel\\s*çerez|necessary\\s*only|essential\\s*only|strictly\\s*necessary|save\\s*preferences|save\\s*my\\s*choices|only\\s*necessary|allow\\s*essential|use\\s*necessary\\s*cookies\\s*only)\\b/i;
    const RE_CLOSE = /\\b(kapat|anladım|tamam|vazgeç|close|dismiss|got\\s*it)\\b/i;
    const RE_ACCEPT = /\\b(kabul\\s*et|tümünü\\s*kabul\\s*et|onayla|hepsini\\s*kabul\\s*et|accept\\s*all|accept|allow\\s*all|agree)\\b/i;

    function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // Check if banner container exists
    let bannerElement = null;
    for (const sel of CONTAINER_SELECTORS) {
        try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                if (isVisible(el)) {
                    const text = el.innerText || '';
                    if (/cookie|çerez|kvkk|consent|gizlilik|gdpr/i.test(text)) {
                        bannerElement = el;
                        break;
                    }
                }
            }
            if (bannerElement) break;
        } catch (e) {}
    }

    const scope = bannerElement || document;
    const allButtons = Array.from(scope.querySelectorAll('button, a[role="button"], a.btn, input[type="button"], input[type="submit"]')).filter(isVisible);

    // Helper to click
    function triggerClick(el) {
        try {
            el.click();
            return true;
        } catch (e) {
            try {
                const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                el.dispatchEvent(evt);
                return true;
            } catch (err) {
                return false;
            }
        }
    }

    // ── STEP 1: PRIORITY 1 — REJECT ALL ────────────────────────────────
    for (const sel of REJECT_SELECTORS) {
        const el = scope.querySelector(sel);
        if (isVisible(el)) {
            const text = (el.innerText || el.value || sel).trim();
            triggerClick(el);
            return {
                detected: true,
                action: 'REJECTED',
                button_text: text,
                selector_used: sel,
                dark_pattern_detected: false,
                details: `Reject option clicked ('${text}') via selector '${sel}'. Privacy preserved.`
            };
        }
    }

    for (const btn of allButtons) {
        const text = (btn.innerText || btn.value || '').trim();
        if (RE_REJECT.test(text)) {
            triggerClick(btn);
            return {
                detected: true,
                action: 'REJECTED',
                button_text: text,
                selector_used: btn.tagName.toLowerCase(),
                dark_pattern_detected: false,
                details: `Reject option clicked ('${text}'). User privacy strictly prioritized.`
            };
        }
    }

    // ── STEP 2: PRIORITY 2 — NECESSARY ONLY / PREFERENCES ───────────────
    for (const sel of NECESSARY_SELECTORS) {
        const el = scope.querySelector(sel);
        if (isVisible(el)) {
            const text = (el.innerText || el.value || sel).trim();
            triggerClick(el);
            return {
                detected: true,
                action: 'NECESSARY_ONLY',
                button_text: text,
                selector_used: sel,
                dark_pattern_detected: false,
                details: `Necessary-only cookies selected ('${text}') via selector '${sel}'.`
            };
        }
    }

    for (const btn of allButtons) {
        const text = (btn.innerText || btn.value || '').trim();
        if (RE_NECESSARY.test(text)) {
            triggerClick(btn);
            return {
                detected: true,
                action: 'NECESSARY_ONLY',
                button_text: text,
                selector_used: btn.tagName.toLowerCase(),
                dark_pattern_detected: false,
                details: `Necessary-only cookies selected ('${text}'). Non-essential cookies excluded.`
            };
        }
    }

    // ── STEP 3: PRIORITY 3 — CLOSE / DISMISS ───────────────────────────
    for (const sel of CLOSE_SELECTORS) {
        const el = scope.querySelector(sel);
        if (isVisible(el)) {
            const text = (el.innerText || el.getAttribute('aria-label') || 'Close').trim();
            triggerClick(el);
            return {
                detected: true,
                action: 'CLOSED',
                button_text: text,
                selector_used: sel,
                dark_pattern_detected: false,
                details: `Banner dismissed via close button ('${text}').`
            };
        }
    }

    for (const btn of allButtons) {
        const text = (btn.innerText || btn.value || '').trim();
        if (RE_CLOSE.test(text)) {
            triggerClick(btn);
            return {
                detected: true,
                action: 'CLOSED',
                button_text: text,
                selector_used: btn.tagName.toLowerCase(),
                dark_pattern_detected: false,
                details: `Banner closed without explicit marketing consent ('${text}').`
            };
        }
    }

    // ── STEP 4: PRIORITY 4 — FORCED ACCEPT (FALLBACK & DARK PATTERN) ───
    // Only if a banner exists and ONLY Accept was provided (no reject/close available)
    if (bannerElement || allButtons.some(b => RE_ACCEPT.test(b.innerText || ''))) {
        for (const sel of ACCEPT_SELECTORS) {
            const el = scope.querySelector(sel);
            if (isVisible(el)) {
                const text = (el.innerText || el.value || sel).trim();
                triggerClick(el);
                return {
                    detected: true,
                    action: 'FORCED_ACCEPTED',
                    button_text: text,
                    selector_used: sel,
                    dark_pattern_detected: true,
                    details: `Forced Accept clicked ('${text}'). No reject option was available on banner (Dark Pattern).`
                };
            }
        }

        for (const btn of allButtons) {
            const text = (btn.innerText || btn.value || '').trim();
            if (RE_ACCEPT.test(text)) {
                triggerClick(btn);
                return {
                    detected: true,
                    action: 'FORCED_ACCEPTED',
                    button_text: text,
                    selector_used: btn.tagName.toLowerCase(),
                    dark_pattern_detected: true,
                    details: `Forced Accept clicked ('${text}'). Banner lacked a 'Reject' option (Forced Consent Dark Pattern).`
                };
            }
        }
    }

    return {
        detected: !!bannerElement,
        action: 'NONE',
        button_text: null,
        selector_used: null,
        dark_pattern_detected: false,
        details: bannerElement ? 'Banner detected but no interactive button recognized.' : 'No cookie banner present.'
    };
}
"""

OVERLAY_CLEANUP_SCRIPT = """
() => {
    // Remove lingering dark backdrops/overlays that might block pointer events
    const overlays = document.querySelectorAll(
        '.modal-backdrop, .cookie-backdrop, .onetrust-pc-dark-filter, ' +
        '#CybotCookiebotDialogBodyUnderlay, [class*="backdrop" i], [class*="overlay" i]'
    );
    let removed = 0;
    overlays.forEach(el => {
        try {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'absolute') {
                el.style.display = 'none';
                el.style.pointerEvents = 'none';
                removed++;
            }
        } catch (e) {}
    });
    return removed;
}
"""


class CookieConsentManager:
    """
    Autonomous Cookie / KVKK / GDPR Consent Dismissal Service.
    Enforces user preference: Reject All > Necessary Only > Close > Forced Accept.
    """

    @classmethod
    async def dismiss_cookie_banner(cls, page) -> ConsentResult:
        """
        Executes privacy-preserving consent banner dismissal on the active Playwright page.
        """
        try:
            raw_result = await page.evaluate(JS_DISMISSAL_SCRIPT)
            if not isinstance(raw_result, dict):
                return ConsentResult()

            result = ConsentResult(
                detected=bool(raw_result.get("detected")),
                action=str(raw_result.get("action", "NONE")),
                button_text=raw_result.get("button_text"),
                selector_used=raw_result.get("selector_used"),
                dark_pattern_detected=bool(raw_result.get("dark_pattern_detected")),
                details=str(raw_result.get("details", "")),
            )

            # If an action was taken, wait briefly for animations and clean up backdrops
            if result.action != "NONE":
                try:
                    await page.wait_for_timeout(600)
                    await page.evaluate(OVERLAY_CLEANUP_SCRIPT)
                except Exception:
                    pass

            # Formulate compliance warning if forced accept was detected
            if result.dark_pattern_detected:
                result.compliance_warning = (
                    "KVKK Md. 5 ve GDPR Madde 7(4) uyarınca kullanıcılara açık red (opt-out) seçeneği "
                    "sunulmaksızın tüm çerezler zorunlu kılınmıştır (Forced Consent Dark Pattern)."
                )

            return result

        except Exception as exc:
            return ConsentResult(
                detected=False,
                action="ERROR",
                details=f"Dismissal failed gracefully: {str(exc)[:100]}"
            )

    @classmethod
    def formulate_compliance_finding(cls, result: ConsentResult, target_url: str) -> Optional[Finding]:
        """
        If a site forces cookie acceptance without providing a 'Reject' or 'Necessary Only' option,
        formulates a high-severity KVKK / GDPR compliance finding.
        """
        if not result.dark_pattern_detected:
            return None

        return Finding(
            id="KVKK_FORCED_COOKIE_CONSENT",
            category=Category.SECURITY,
            severity=Severity.HIGH,
            title="KVKK / GDPR İhlali: Çerez Bildiriminde 'Reddet' Seçeneği Yok (Forced Consent)",
            description=(
                f"Hedef sitede ({target_url}) çerez onay penceresi tespit edildi; ancak kullanıcıya "
                f"açık bir 'Tümünü Reddet' veya 'Yalnızca Zorunlu Çerezler' seçeneği sunulmayıp "
                f"yalnızca onay butonu ('{result.button_text or 'Kabul Et'}') dayatılmaktadır."
            ),
            remediation=(
                "KVKK Çerez Rehberi ve GDPR Art. 7(4) gereğince çerez onay penceresinde 'Kabul Et' butonu ile "
                "aynı görsel ağırlık ve hizada 'Tümünü Reddet' butonu veya 'Sadece Zorunlu Çerezleri Onayla' "
                "seçeneği sunulmalıdır. Reddetme hakkı engellenemez."
            ),
            risk_impact=(
                "Kullanıcının rızası serbest iradeye dayanmadığı için toplanan çerez verileri yasa dışı hale gelir. "
                "KVKK Kurulu ve AB DPAs tarafından idari para cezası kesilme riski doğurur."
            ),
            code_example=(
                "<!-- KVKK Uyumlu Çerez Banner Örneği -->\n"
                "<div class='cookie-consent-actions'>\n"
                "  <button id='btn-reject-all' class='btn-secondary'>Tümünü Reddet</button>\n"
                "  <button id='btn-custom' class='btn-secondary'>Tercihleri Yönet</button>\n"
                "  <button id='btn-accept-all' class='btn-primary'>Tümünü Kabul Et</button>\n"
                "</div>"
            ),
            target_location="Cookie / Consent Dialog",
            problematic_code=f"Banner Button: {result.button_text or 'Kabul Et'} (Reddetme seçeneği bulunmuyor)",
            compliance_standard="KVKK Md. 5 / GDPR Art. 7(4) & EDPB Guidelines 05/2020",
            sector_relevance=[SectorType.GENERAL, SectorType.ECOMMERCE, SectorType.FINTECH_BANKING, SectorType.CORPORATE_GOV],
            rca_category=RCACategory.REAL_BUG,
            team_assignment="Hukuk & Uyum Ekibi (DPO / Compliance)",
            root_cause_hypothesis="Çerez yönetim platformu veya şablonu, kullanıcıya açık red veya zorunlu çerez filtreleme seçeneği sunmadan tek taraflı onay dayatacak şekilde yapılandırılmış.",
            reproduction_steps=[
                f"1. Hedef siteyi '{target_url}' tarayıcıda açın",
                "2. Çerez / KVKK bildirim penceresini inceleyin",
                f"3. Yalnızca '{result.button_text}' seçeneğinin sunulduğunu, açık bir 'Reddet' butonunun bulunmadığını gözlemleyin",
            ]
        )
