export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Category = "SECURITY" | "UX";
export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

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
}

export interface ScanResult {
  scan_id: string;
  target_url: string;
  status: ScanStatus;
  security_score: number;
  ux_score: number;
  findings: Finding[];
  error_message?: string;
  started_at: string;
  completed_at?: string;
}
