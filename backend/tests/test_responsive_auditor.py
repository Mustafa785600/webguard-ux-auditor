import pytest
import httpx
from app.services.responsive_auditor import ResponsiveLayoutAuditor, VIEWPORT_CONFIGS
from app.models.schema import DeviceProfile, ResponsiveDefectType, Severity

def test_process_viewport_evaluation_clean():
    auditor = ResponsiveLayoutAuditor()
    cfg = VIEWPORT_CONFIGS[0]  # Mobile

    clean_eval = {
        "overflowPx": 0,
        "overflowElements": [],
        "totalTouchTargets": 10,
        "smallTouchTargets": [],
        "smallTouchTargetsCount": 0,
        "smallFonts": [],
        "smallFontsCount": 0,
        "metaViewportContent": "width=device-width, initial-scale=1.0",
    }

    result = auditor._process_viewport_evaluation(cfg, clean_eval, screenshot_b64="data:image/jpeg;base64,mock")
    assert result.device == DeviceProfile.MOBILE
    assert result.score == 100
    assert result.horizontal_overflow_px == 0
    assert len(result.defects) == 0
    assert result.screenshot_b64 == "data:image/jpeg;base64,mock"

def test_process_viewport_evaluation_with_horizontal_overflow():
    auditor = ResponsiveLayoutAuditor()
    cfg = VIEWPORT_CONFIGS[0]  # Mobile (390px)

    overflow_eval = {
        "overflowPx": 55,
        "overflowElements": [
            {"selector": "div#promo-banner", "width": 445, "right": 445, "excess": 55}
        ],
        "totalTouchTargets": 8,
        "smallTouchTargets": [],
        "smallTouchTargetsCount": 0,
        "smallFonts": [],
        "smallFontsCount": 0,
    }

    result = auditor._process_viewport_evaluation(cfg, overflow_eval)
    assert result.score <= 75
    assert result.horizontal_overflow_px == 55
    assert any(d.defect_type == ResponsiveDefectType.HORIZONTAL_OVERFLOW for d in result.defects)

def test_process_viewport_evaluation_with_small_touch_targets():
    auditor = ResponsiveLayoutAuditor()
    cfg = VIEWPORT_CONFIGS[0]  # Mobile (has_touch = True)

    touch_eval = {
        "overflowPx": 0,
        "overflowElements": [],
        "totalTouchTargets": 15,
        "smallTouchTargets": [
            {"selector": "button.icon-btn", "width": 24, "height": 24, "text": "Close"},
            {"selector": "a.nav-link", "width": 30, "height": 20, "text": "Home"},
        ],
        "smallTouchTargetsCount": 2,
        "smallFonts": [],
        "smallFontsCount": 0,
    }

    result = auditor._process_viewport_evaluation(cfg, touch_eval)
    assert result.score <= 92
    assert result.small_touch_targets_count == 2
    assert any(d.defect_type == ResponsiveDefectType.TOUCH_TARGET_TOO_SMALL for d in result.defects)

@pytest.mark.asyncio
async def test_synthetic_fallback_audit_missing_meta_viewport():
    auditor = ResponsiveLayoutAuditor()

    def mock_handler(request: httpx.Request):
        # HTML without meta viewport
        return httpx.Response(200, text="<html><head><title>No Viewport</title></head><body>Hello</body></html>")

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://no-meta.local") as client:
        results = await auditor._run_synthetic_fallback_audit("http://no-meta.local", client=client)

    assert len(results) == 3
    mobile_res = next(r for r in results if r.device == DeviceProfile.MOBILE)
    assert mobile_res.score < 90
    assert any(d.defect_type == ResponsiveDefectType.VIEWPORT_META_MISSING for d in mobile_res.defects)

@pytest.mark.asyncio
async def test_synthetic_fallback_audit_zoom_blocked():
    auditor = ResponsiveLayoutAuditor()

    def mock_handler(request: httpx.Request):
        # HTML with user-scalable=no
        html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"></head><body>Page</body></html>'
        return httpx.Response(200, text=html)

    transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://zoom-blocked.local") as client:
        results = await auditor._run_synthetic_fallback_audit("http://zoom-blocked.local", client=client)

    mobile_res = next(r for r in results if r.device == DeviceProfile.MOBILE)
    assert any(d.defect_type == ResponsiveDefectType.PINCH_TO_ZOOM_BLOCKED for d in mobile_res.defects)

