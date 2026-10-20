from fastapi import APIRouter, HTTPException, status
from app.models.schema import ScanRequest, ScanResult, ScanStatus
from app.services.orchestrator import execute_scan

router = APIRouter()

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok"}

@router.post("/scan", response_model=ScanResult)
async def run_scan(request: ScanRequest):
    result = await execute_scan(request.url)
    if result.status == ScanStatus.FAILED and "SSRF Protection" in (result.error_message or ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error_message)
    return result
