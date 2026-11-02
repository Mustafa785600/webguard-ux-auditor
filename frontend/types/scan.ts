export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Category = "SECURITY" | "UX";
export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type RCACategory =
  | "REAL_BUG"
  | "TEST_FRAGILITY"
  | "ENV_ISSUE"
  | "EXPECTED_BEHAVIOR";

export interface NetworkRequestTrace {
  url: string;
  method: string;
  status: number;
  resource_type: string;
  duration_ms: number;
  size_bytes?: number;
  cors_allowed?: boolean;
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  remediation: string;
  evidence?: Record<string, unknown>;
  risk_impact?: string;
  code_example?: string;
  target_location?: string;
  line_number?: number;
  problematic_code?: string;
  // Phase 2 — Autonomous interaction evidence
  screenshot_before_b64?: string;
  screenshot_after_b64?: string;
  interaction_log?: string[];
  rca_category?: RCACategory;
}

export interface ScanResult {
  scan_id: string;
  target_url: string;
  status: ScanStatus;
  security_score: number;
  ux_score: number;
  findings: Finding[];
  network_traces?: NetworkRequestTrace[];
  error_message?: string;
  started_at: string;
  completed_at?: string;
}
