from fastapi import APIRouter, HTTPException, status
from app.models.schema import (
    ScanRequest, ScanResult, ScanStatus,
    PRDAnalyzeRequest, PRDAnalysisResponse
)
from app.services.orchestrator import execute_scan
from app.services.prd_agent import analyze_prd_and_generate_tests
from app.core.security import validate_and_sanitize_target_url, SecurityValidationError

router = APIRouter()

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok"}

@router.post("/scan", response_model=ScanResult)
async def run_scan(request: ScanRequest):
    result = await execute_scan(
        request.url,
        request.prd_content,
        request.webhook_url,
        enable_crawler=bool(request.enable_crawler),
        max_pages=request.max_pages or 5,
        crawl_depth=request.crawl_depth or 2
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
