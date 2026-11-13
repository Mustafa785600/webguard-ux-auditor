from fastapi import APIRouter, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import httpx
from typing import Optional
from pydantic import BaseModel
from app.models.schema import (
    ScanRequest, ScanResult, ScanStatus,
    PRDAnalyzeRequest, PRDAnalysisResponse,
    AutoHealRequest, AutoHealResponse,
    CodebaseIntelligenceReport
)
from app.services.orchestrator import execute_scan
from app.services.prd_agent import analyze_prd_and_generate_tests
from app.services.self_healing import heal_playwright_script
from app.services.live_screencast import live_hub
from app.services.codebase_intelligence import CodebaseIntelligenceEngine
from app.core.security import validate_and_sanitize_target_url, SecurityValidationError

class CodebaseAnalyzeRequest(BaseModel):
    root_path: Optional[str] = None

router = APIRouter()

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok"}

@router.get("/screencast/state")
async def get_screencast_state():
    """
    Returns current live browser screencast frame and action HUD history (HTTP polling fallback).
    """
    return live_hub.get_state()

@router.websocket("/ws/screencast")
async def websocket_screencast_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket feed for live browser viewport screencasting and AI Action HUD ticker events.
    """
    await live_hub.register_client(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        live_hub.unregister_client(websocket)
    except Exception:
        live_hub.unregister_client(websocket)

@router.post("/scan", response_model=ScanResult)
async def run_scan(request: ScanRequest):
    result = await execute_scan(
        request.url,
        request.prd_content,
        request.webhook_url,
        enable_crawler=bool(request.enable_crawler),
        max_pages=request.max_pages or 5,
        crawl_depth=request.crawl_depth or 2,
        sector=request.sector,
    )
    if result.status == ScanStatus.FAILED and "SSRF Protection" in (result.error_message or ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error_message)
    return result

@router.post("/prd/analyze", response_model=PRDAnalysisResponse)
async def analyze_prd(request: PRDAnalyzeRequest):
    try:
        sanitized_url = validate_and_sanitize_target_url(request.target_url)
    except SecurityValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return await analyze_prd_and_generate_tests(request.prd_text, sanitized_url)

@router.post("/auto-heal/analyze", response_model=AutoHealResponse)
async def analyze_and_heal_spec(request: AutoHealRequest):
    """
    TestSprite Auto-Heal & Flaky Test Repair Service.
    Analyzes fragile locators (CSS hashes, XPaths, nth-child, dynamic IDs, static sleep)
    and patches them into resilient Playwright locators.
    """
    return heal_playwright_script(request.script_code, target_url=request.target_url)

@router.get("/codebase/intelligence", response_model=CodebaseIntelligenceReport)
async def get_codebase_intelligence():
    """
    Bütünsel Kod Tabanı ve Mimari Zeka Raporunu döner.
    AST sembolleri, neden yazıldıkları, katmanlar ve full-stack bağlantıları içerir.
    """
    engine = CodebaseIntelligenceEngine()
    return engine.analyze()

@router.post("/codebase/analyze", response_model=CodebaseIntelligenceReport)
async def analyze_custom_codebase(request: CodebaseAnalyzeRequest):
    """
    Belirtilen veya varsayılan dizindeki kod tabanını otonom olarak analiz eder.
    """
    engine = CodebaseIntelligenceEngine(root_dir=request.root_path)
    return engine.analyze()


@router.get("/proxy/viewport", response_class=HTMLResponse)
async def proxy_target_viewport(url: str):
    """
    Hedef web sitesinin (örn. https://www.dpu.edu.tr/ veya https://tcaree.com/)
    orijinal HTML ve kaynaklarını canlı proxy ile tarayıcı viewport iframe'ine yansıtır.
    X-Frame-Options ve CSP kısıtlamalarını aşmak için backend üzerinden çekip
    <base href="{url}"> enjekte eder.
    """
    cleaned_url = url.strip()
    if not (cleaned_url.startswith("http://") or cleaned_url.startswith("https://")):
        cleaned_url = f"https://{cleaned_url}"

    try:
        sanitized_url = validate_and_sanitize_target_url(cleaned_url)
    except Exception as exc:
        if "SSRF Protection" in str(exc):
            return HTMLResponse(
                content=f"""
                <!DOCTYPE html><html><body style="background:#0b0f19;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="background:#111827;border:1px solid #ef4444;border-radius:8px;padding:20px;text-align:center;">
                    <h3>SSRF Koruması Devrede</h3>
                    <p style="color:#94a3b8;font-size:13px;">Yerel ağ veya özel IP adreslerine proxy erişimi engellendi: <code>{cleaned_url}</code></p>
                </div></body></html>
                """,
                status_code=200
            )
        sanitized_url = cleaned_url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 WebGuard/2.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(sanitized_url, headers=headers)
            raw_html = resp.text

            # Base tag injection: Ensure all relative CSS, JS, images load from target
            base_tag = f'<base href="{sanitized_url}">'
            # Script to disable target link hijacking so clicks don't navigate out
            safety_script = """
            <script>
            document.addEventListener('DOMContentLoaded', function() {
                document.querySelectorAll('a').forEach(function(el) {
                    el.setAttribute('target', '_self');
                });
            });
            </script>
            """
            
            import re
            if re.search(r"<head[^>]*>", raw_html, flags=re.IGNORECASE):
                injected_html = re.sub(
                    r"(<head[^>]*>)",
                    r"\1\n  " + base_tag + "\n  " + safety_script,
                    raw_html,
                    count=1,
                    flags=re.IGNORECASE
                )
            else:
                injected_html = f"{base_tag}\n{safety_script}\n{raw_html}"

            return HTMLResponse(
                content=injected_html,
                status_code=resp.status_code,
                headers={
                    "Content-Type": "text/html; charset=utf-8",
                    "X-Robots-Tag": "noindex, nofollow",
                }
            )
    except Exception as err:
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ background: #0b0f19; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }}
                .err-box {{ background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
                h3 {{ color: #f87171; margin-top: 0; font-size: 16px; }}
                code {{ background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="err-box">
                <h3>Hedef Sayfa Canlı Yansıtılamadı</h3>
                <p>Hedef Adres: <code>{sanitized_url}</code></p>
                <p style="font-size: 12px; color: #64748b; margin-top: 12px;">Sebep: {str(err)}</p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=error_html, status_code=200)



