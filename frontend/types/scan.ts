export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Category = "SECURITY" | "UX";
export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type RCACategory =
  | "REAL_BUG"
  | "TEST_FRAGILITY"
  | "ENV_ISSUE"
  | "EXPECTED_BEHAVIOR";

export type SectorType =
  | "AUTO"
  | "GENERAL"
  | "ECOMMERCE"
  | "HEALTHCARE"
  | "CORPORATE_GOV"
  | "SAAS_API";

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
  page_url?: string;
  // Sektörel Uyumluluk ve Yasal Standartlar (PCI-DSS, KVKK, HIPAA, OWASP)
  compliance_standard?: string;
  sector_relevance?: SectorType[];
  // TestSprite Failure Diagnostic Bundle
  reproduction_steps?: string[];
  dom_snapshot?: string;
  root_cause_hypothesis?: string;
}

export interface CrawlNode {
  url: string;
  route: string;
  title?: string;
  depth: number;
  status_code: number;
  forms_count: number;
  buttons_count: number;
  links_found: string[];
  page_issues_count: number;
  screenshot_b64?: string;
  load_time_ms?: number;
}

export interface PRDScenario {
  title: string;
  role: string;
  steps: string[];
  expected_result: string;
  edge_cases: string[];
}

export interface PRDAnalysisResponse {
  target_url: string;
  summary: string;
  user_roles: string[];
  scenarios: PRDScenario[];
  generated_spec_code: string;
  generated_at: string;
}

export interface ScanResult {
  scan_id: string;
  target_url: string;
  status: ScanStatus;
  security_score: number;
  ux_score: number;
  compliance_score?: number;
  resilience_score?: number;
  selected_sector?: SectorType;
  detected_sector?: SectorType;
  findings: Finding[];
  network_traces?: NetworkRequestTrace[];
  prd_analysis?: PRDAnalysisResponse;
  self_healing_events?: Record<string, unknown>[];
  crawl_graph?: CrawlNode[];
  crawled_pages_count?: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface AutoHealRepair {
  original: string;
  healed: string;
  strategy: string;
  confidence: number;
  line_number?: number;
  flakiness_cause?: string;
}

export interface AutoHealResponse {
  original_code: string;
  healed_code: string;
  repairs: AutoHealRepair[];
  resilience_score_before: number;
  resilience_score_after: number;
  flakiness_reduction_pct: number;
  healed_at: string;
}
