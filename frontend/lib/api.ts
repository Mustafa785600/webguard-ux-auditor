import { ScanResult, PRDAnalysisResponse, SectorType, AutoHealResponse, CodebaseIntelligenceReport } from "@/types/scan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function startScan(
  url: string,
  prdContent?: string,
  crawlerOptions?: {
    enableCrawler?: boolean;
    maxPages?: number;
    crawlDepth?: number;
    sector?: SectorType;
  }
): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      prd_content: prdContent,
      enable_crawler: crawlerOptions?.enableCrawler ?? true,
      max_pages: crawlerOptions?.maxPages ?? 5,
      crawl_depth: crawlerOptions?.crawlDepth ?? 2,
      sector: crawlerOptions?.sector ?? "AUTO",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Scan request failed.");
  }
  return res.json();
}

export async function analyzePRD(targetUrl: string, prdText: string): Promise<PRDAnalysisResponse> {
  const res = await fetch(`${API_BASE}/prd/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_url: targetUrl, prd_text: prdText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "PRD analysis request failed.");
  }
  return res.json();
}

export async function healTestScript(scriptCode: string, targetUrl?: string): Promise<AutoHealResponse> {
  const res = await fetch(`${API_BASE}/auto-heal/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script_code: scriptCode, target_url: targetUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Auto-heal request failed.");
  }
  return res.json();
}

export async function getCodebaseIntelligence(): Promise<CodebaseIntelligenceReport> {
  const res = await fetch(`${API_BASE}/codebase/intelligence`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Codebase intelligence request failed.");
  }
  return res.json();
}

