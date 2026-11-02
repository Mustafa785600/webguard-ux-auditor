import { ScanResult, PRDAnalysisResponse } from "@/types/scan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function startScan(url: string, prdContent?: string): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, prd_content: prdContent }),
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
