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
  | "SAAS_API"
  | "FINTECH_BANKING";

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
  // Virgosol & TestSprite Kurumsal Triyaj (Hangi Ekip Çözecek?)
  team_assignment?: string;
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
  scenario_type?: "POSITIVE" | "NEGATIVE_SECURITY" | "BOUNDARY";
  steps: string[];
  expected_result: string;
  edge_cases: string[];
  security_risk?: string;
  abuse_payload?: string;
  requirement_id?: string;
}

export interface PRDTraceabilityItem {
  req_id: string;
  requirement: string;
  positive_test: string;
  security_test: string;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  status: "COVERED" | "NEEDS_REVIEW";
}

export interface PRDAnalysisResponse {
  target_url: string;
  summary: string;
  user_roles: string[];
  scenarios: PRDScenario[];
  security_scenarios_count?: number;
  coverage_score?: number;
  traceability_matrix?: PRDTraceabilityItem[];
  generated_spec_code: string;
  generated_at: string;
}

export interface PerformanceMetrics {
  total_requests: number;
  concurrency: number;
  success_rate: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  p50_latency_ms: number;
  p90_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  max_latency_ms: number;
  throughput_req_per_sec: number;
  sla_status: "EXCELLENT" | "ACCEPTABLE" | "BREACH";
  status_codes: Record<number, number>;
  samples: number[];
  ttfb_ms?: number;
  fcp_ms?: number;
  lcp_ms?: number;
  dom_load_ms?: number;
  window_load_ms?: number;
  total_dom_nodes?: number;
  total_page_size_kb?: number;
  heavy_resources?: Array<{ name: string; size_kb: number; initiator: string }>;
}

export interface ScanResult {
  scan_id: string;
  target_url: string;
  status: ScanStatus;
  security_score: number;
  ux_score: number;
  compliance_score?: number;
  bddk_compliance_score?: number;
  resilience_score?: number;
  selected_sector?: SectorType;
  detected_sector?: SectorType;
  findings: Finding[];
  rca_summary?: Record<string, number>;
  network_traces?: NetworkRequestTrace[];
  performance_metrics?: PerformanceMetrics;
  prd_analysis?: PRDAnalysisResponse;
  self_healing_events?: Record<string, unknown>[];
  crawl_graph?: CrawlNode[];
  codebase_intelligence?: CodebaseIntelligenceReport;
  waf_resilience?: WAFResilienceReport;
  chaos_resilience?: ChaosResilienceReport;
  rate_limit_resilience?: RateLimitResilienceReport;
  multi_viewport_report?: MultiViewportReport;
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

export type ArchitectureLayer =
  | "FRONTEND_UI"
  | "API_CONTROLLER"
  | "SERVICE_LOGIC"
  | "SECURITY_GUARD"
  | "DATA_MODEL"
  | "INFRA_CONFIG";

export interface CodeSymbolNode {
  id: string;
  name: string;
  file_path: string;
  symbol_type: string;
  layer: ArchitectureLayer;
  purpose_summary: string;
  line_start: number;
  line_end: number;
  docstring?: string;
  decorators?: string[];
  http_method?: string;
  http_route?: string;
  calls: string[];
  called_by: string[];
  blast_radius_score: number;
}

export interface CodebaseConnectionEdge {
  source_id: string;
  target_id: string;
  connection_type: string;
  description: string;
}

export interface FullStackFlow {
  id: string;
  flow_name: string;
  entry_point: string;
  api_route: string;
  service_pipeline: string[];
  model_schema: string;
  description: string;
}

export interface CodebaseIntelligenceReport {
  total_files: number;
  total_lines_of_code: number;
  total_symbols: number;
  symbols: CodeSymbolNode[];
  edges: CodebaseConnectionEdge[];
  full_stack_flows: FullStackFlow[];
  layer_distribution: Record<string, number>;
  architectural_health_score: number;
  detected_frameworks: string[];
  analyzed_at: string;
}

export type WAFProbeStatus =
  | "BLOCKED_BY_WAF"
  | "HANDLED_CLEANLY"
  | "UNHANDLED_500_CRASH"
  | "STACK_TRACE_LEAK";

export interface WAFProbeResult {
  category: string;
  probe_name: string;
  target_vector: string;
  payload_sample: string;
  status_code: number;
  probe_status: WAFProbeStatus;
  detected_leakage?: string;
  waf_signature_matched?: string;
  response_time_ms: number;
}

export interface WAFResilienceReport {
  waf_detected: boolean;
  waf_vendor: string;
  waf_protection_score: number;
  total_probes_executed: number;
  probes_blocked_by_waf: number;
  probes_handled_cleanly: number;
  unhandled_500_crashes: number;
  stack_trace_leaks: number;
  probe_results: WAFProbeResult[];
  audited_at: string;
}

export type ChaosFaultType =
  | "API_500_SERVER_ERROR"
  | "API_LATENCY_SPIKE"
  | "NETWORK_CONNECTION_ABORT"
  | "MALFORMED_JSON_PAYLOAD"
  | "SLOW_3G_THROTTLING";

export type ChaosVerdict =
  | "RESILIENT"
  | "DEGRADED"
  | "CRASH_UNHANDLED"
  | "WHITE_SCREEN_OF_DEATH";

export interface ChaosExperimentResult {
  experiment_id: string;
  name: string;
  fault_type: ChaosFaultType;
  target_pattern: string;
  injected_fault_description: string;
  ui_reaction: string;
  verdict: ChaosVerdict;
  js_exceptions: string[];
  white_screen_detected: boolean;
  duration_ms: number;
}

export interface ChaosResilienceReport {
  chaos_resilience_score: number;
  total_experiments: number;
  resilient_experiments: number;
  degraded_experiments: number;
  crashed_experiments: number;
  white_screens_count: number;
  experiments: ChaosExperimentResult[];
  audited_at: string;
}

export type RateLimitStatus =
  | "ENFORCED_HTTP_429"
  | "ENFORCED_ACCOUNT_LOCK"
  | "PARTIAL_DELAY"
  | "NOT_ENFORCED";

export interface RateLimitProbeAttempt {
  attempt_number: number;
  status_code: number;
  latency_ms: number;
  rate_limit_remaining?: number;
  retry_after_seconds?: number;
  throttled: boolean;
}

export interface RateLimitResilienceReport {
  rate_limiting_detected: boolean;
  status: RateLimitStatus;
  resilience_score: number;
  tested_endpoint: string;
  total_burst_requests: number;
  throttled_at_attempt?: number;
  http_429_received: boolean;
  retry_after_header_present: boolean;
  rate_limit_headers: Record<string, string>;
  attempts: RateLimitProbeAttempt[];
  compliance_frameworks: string[];
  audited_at: string;
}

export type DeviceProfile = "MOBILE" | "TABLET" | "DESKTOP";

export type ResponsiveDefectType =
  | "HORIZONTAL_OVERFLOW"
  | "TOUCH_TARGET_TOO_SMALL"
  | "ILLEGIBLE_FONT_SIZE"
  | "VIEWPORT_META_MISSING"
  | "PINCH_TO_ZOOM_BLOCKED"
  | "CONTENT_CLIPPED";

export interface ResponsiveDefectItem {
  defect_type: ResponsiveDefectType;
  severity: Severity;
  description: string;
  selector?: string;
  bounding_box?: Record<string, number>;
  computed_value?: string;
  recommended_fix: string;
}

export interface ViewportAuditResult {
  device: DeviceProfile;
  device_label: string;
  width: number;
  height: number;
  scale_factor: number;
  is_mobile: boolean;
  has_touch: boolean;
  score: number;
  horizontal_overflow_px: number;
  total_touch_targets_checked: number;
  small_touch_targets_count: number;
  small_fonts_count: number;
  screenshot_b64?: string | null;
  defects: ResponsiveDefectItem[];
}

export interface MultiViewportReport {
  overall_responsive_score: number;
  meta_viewport_tag_found: boolean;
  meta_viewport_content?: string | null;
  pinch_to_zoom_allowed: boolean;
  total_defects: number;
  tested_viewports: ViewportAuditResult[];
  compliance_standards?: string[];
  audited_at: string;
}





