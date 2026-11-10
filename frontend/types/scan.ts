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
  content_type?: string;
  headers?: Record<string, string>;
  response_body?: string;
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
  api_contract_drift?: APIContractDriftReport;
  dast_verification?: DASTVerificationReport;
  session_replay?: SessionReplayReport;
  database_leak_report?: DatabaseLeakReport;
  localization_audit?: LocalizationAuditReport;
  memory_leak_report?: MemoryLeakReport;
  third_party_security_report?: ThirdPartySecurityReport;
  tls_crypto_report?: TLSCryptoReport;
  incident_hub_report?: IncidentHubReport;
  seo_structured_data_report?: SEOStructuredDataReport;
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

export type SchemaDriftType =
  | "TYPE_MISMATCH"
  | "MISSING_REQUIRED_FIELD"
  | "UNEXPECTED_FIELD"
  | "STATUS_CODE_UNSPECIFIED"
  | "UNDOCUMENTED_SHADOW_API"
  | "DEPRECATED_ENDPOINT_ACTIVE";

export interface SchemaDriftItem {
  endpoint: string;
  method: string;
  drift_type: SchemaDriftType;
  severity: Severity;
  field_path?: string;
  expected_contract: string;
  actual_runtime: string;
  description: string;
  recommended_fix: string;
}

export interface APIEndpointContract {
  path: string;
  method: string;
  summary?: string;
  documented_in_spec: boolean;
  runtime_status_code?: number;
  is_deprecated: boolean;
  drift_count: number;
}

export interface APIContractDriftReport {
  contract_compatibility_score: number;
  spec_detected: boolean;
  spec_url?: string;
  spec_title?: string;
  spec_version?: string;
  total_endpoints_evaluated: number;
  documented_endpoints_count: number;
  shadow_endpoints_count: number;
  total_drifts_detected: number;
  endpoints: APIEndpointContract[];
  drifts: SchemaDriftItem[];
  compliance_frameworks?: string[];
  audited_at: string;
}

export type DASTVerificationStatus =
  | "CONFIRMED"
  | "POTENTIAL_RISK"
  | "SAFE_OR_FALSE_POSITIVE";

export type DASTTestCategory =
  | "REFLECTED_INPUT_SANITIZATION"
  | "SENSITIVE_EXPOSURE"
  | "CORS_MISCONFIGURATION"
  | "OPEN_REDIRECT"
  | "SSRF_FILTER_RESILIENCE";

export interface DASTVerificationItem {
  test_id: string;
  category: DASTTestCategory;
  test_name: string;
  target_endpoint: string;
  parameter_tested?: string;
  verification_status: DASTVerificationStatus;
  severity: Severity;
  canary_payload: string;
  evidence_response_snippet?: string;
  confidence_percentage: number;
  description: string;
  remediation: string;
}

export interface DASTVerificationReport {
  dast_confidence_score: number;
  total_tests_executed: number;
  confirmed_vulnerabilities_count: number;
  potential_risks_count: number;
  false_positives_filtered_count: number;
  verifications: DASTVerificationItem[];
  compliance_standards?: string[];
  audited_at: string;
}

export type SessionEventType =
  | "CLICK"
  | "RAGE_CLICK"
  | "DEAD_CLICK"
  | "SCROLL"
  | "MOUSE_MOVE"
  | "NAVIGATION"
  | "INPUT_MASKED";

export interface SessionEvent {
  timestamp_ms: number;
  event_type: SessionEventType;
  x_pct: number;
  y_pct: number;
  selector?: string;
  element_text?: string;
  scroll_depth_pct?: number;
}

export interface ClickHotspot {
  x_pct: number;
  y_pct: number;
  intensity: number;
  click_count: number;
  selector?: string;
  element_text?: string;
  is_rage_click: boolean;
}

export interface ScrollDepthMilestone {
  depth_percentage: number;
  visitors_reached_pct: number;
  avg_time_spent_seconds: number;
}

export interface SessionReplayReport {
  session_id: string;
  duration_seconds: number;
  total_clicks: number;
  rage_clicks_count: number;
  dead_clicks_count: number;
  max_scroll_depth_pct: number;
  ux_friction_score: number;
  events: SessionEvent[];
  click_hotspots: ClickHotspot[];
  scroll_milestones: ScrollDepthMilestone[];
  page_screenshot_b64?: string | null;
  compliance_notes?: string[];
  recorded_at: string;
}

export type DatabaseLeakType =
  | "SQL_SYNTAX_ERROR"
  | "STACK_TRACE_EXPOSURE"
  | "CONNECTION_STRING"
  | "DATABASE_NAME_LEAK"
  | "DEBUG_METRIC_LEAK";

export type SlowQuerySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface DatabaseLeakItem {
  leak_type: DatabaseLeakType;
  severity: Severity;
  endpoint: string;
  parameter_or_header?: string;
  detected_engine: string;
  leak_sample: string;
  description: string;
  remediation: string;
}

export interface SlowQueryCandidate {
  endpoint: string;
  method: string;
  observed_latency_ms: number;
  status_code: number;
  severity: SlowQuerySeverity;
  suspected_cause: string;
  query_pattern_hint?: string;
  orm_fix_recommendation: string;
}

export interface TimeProbeResult {
  endpoint: string;
  probe_name: string;
  baseline_latency_ms: number;
  probed_latency_ms: number;
  latency_delta_ms: number;
  is_time_delay_suspect: boolean;
  status: "SAFE" | "SUSPICIOUS_DELAY" | "TIMED_OUT";
  detail: string;
}

export interface DatabaseLeakReport {
  db_health_score: number;
  detected_engines: string[];
  total_leaks_count: number;
  slow_queries_count: number;
  n_plus_one_suspects_count: number;
  leaks: DatabaseLeakItem[];
  slow_queries: SlowQueryCandidate[];
  time_probes: TimeProbeResult[];
  orm_recommendations: string[];
  compliance_standards?: string[];
  audited_at: string;
}

export type LocalizationDefectType =
  | "UNTRANSLATED_KEY_LEAK"
  | "MISSING_LANG_ATTRIBUTE"
  | "RTL_BIDI_DEFECT"
  | "HARDCODED_LOCALE_FORMAT"
  | "HREFLANG_MISCONFIGURATION"
  | "TEXT_EXPANSION_OVERFLOW";

export interface LocalizationDefectItem {
  defect_type: LocalizationDefectType;
  severity: Severity;
  element_or_selector?: string;
  detected_snippet: string;
  expected_standard: string;
  description: string;
  remediation: string;
}

export interface HreflangEntry {
  locale: string;
  url: string;
  is_valid: boolean;
}

export interface LocalizationAuditReport {
  l10n_score: number;
  declared_lang?: string;
  detected_languages: string[];
  has_rtl_support: boolean;
  untranslated_keys_count: number;
  formatting_defects_count: number;
  total_defects_count: number;
  hreflang_tags: HreflangEntry[];
  defects: LocalizationDefectItem[];
  supported_locales_detected: string[];
  compliance_standards?: string[];
  audited_at: string;
}

export type MemoryLeakType =
  | "DETACHED_DOM_NODES"
  | "DANGLING_EVENT_LISTENER"
  | "UNBOUNDED_HEAP_GROWTH"
  | "UNRELEASED_TIMER_INTERVAL"
  | "UNCLEANED_OBSERVER"
  | "GLOBAL_WINDOW_POLLUTION";

export interface DetachedDOMCluster {
  tag_name: string;
  class_or_id?: string;
  count: number;
  retained_size_bytes_est: number;
  suspected_component?: string;
  description: string;
}

export interface DanglingListenerItem {
  target_object: string;
  event_type: string;
  detected_count: number;
  suspected_pattern: string;
  remediation_code: string;
}

export interface JSHeapMetric {
  total_js_heap_size_mb: number;
  used_js_heap_size_mb: number;
  js_heap_size_limit_mb: number;
  heap_utilization_pct: number;
  heap_growth_delta_mb: number;
  growth_rate_status: "HEALTHY" | "MODERATE_RISK" | "CRITICAL_GROWTH";
}

export interface MemoryLeakItem {
  leak_type: MemoryLeakType;
  severity: Severity;
  title: string;
  component_or_symbol?: string;
  metric_snippet: string;
  impact_explanation: string;
  remediation: string;
  code_fix_template?: string;
}

export interface MemoryLeakReport {
  memory_health_score: number;
  heap_metrics: JSHeapMetric;
  total_leaks_count: number;
  detached_dom_nodes_count: number;
  dangling_listeners_count: number;
  uncleaned_timers_count: number;
  detached_clusters: DetachedDOMCluster[];
  dangling_listeners: DanglingListenerItem[];
  leaks: MemoryLeakItem[];
  remediation_recipes: string[];
  compliance_standards?: string[];
  audited_at: string;
}

export type ThirdPartyCategory =
  | "ANALYTICS"
  | "ADVERTISING_TRACKER"
  | "SESSION_RECORDING"
  | "CUSTOMER_SUPPORT_CHAT"
  | "CDN_LIBRARY"
  | "UNKNOWN_THIRD_PARTY";

export interface ThirdPartyScriptItem {
  tracker_name: string;
  category: ThirdPartyCategory;
  script_url: string;
  domain: string;
  has_sri: boolean;
  sri_hash?: string;
  severity: Severity;
  pii_leak_risk: boolean;
  description: string;
  remediation: string;
}

export interface CSPDirectiveAudit {
  directive: string;
  raw_value: string;
  is_secure: boolean;
  warnings: string[];
  recommendation: string;
}

export interface ConsentComplianceStatus {
  has_consent_banner: boolean;
  detected_cmp_vendor?: string;
  unconsented_trackers_count: number;
  gdpr_kvkk_compliant: boolean;
  detail: string;
}

export interface ThirdPartySecurityReport {
  security_score: number;
  total_scripts_count: number;
  third_party_scripts_count: number;
  trackers_count: number;
  missing_sri_count: number;
  session_recording_count: number;
  csp_configured: boolean;
  csp_grade: "A+" | "A" | "B" | "C" | "F";
  consent_status: ConsentComplianceStatus;
  scripts: ThirdPartyScriptItem[];
  csp_directives: CSPDirectiveAudit[];
  recommended_csp_header: string;
  remediation_recipes: string[];
  compliance_standards?: string[];
  audited_at: string;
}

export type TLSProtocolVersion =
  | "TLSv1.3"
  | "TLSv1.2"
  | "TLSv1.1"
  | "TLSv1.0"
  | "SSLv3"
  | "SSLv2"
  | "PLAINTEXT_HTTP";

export type CipherSecurityLevel =
  | "AEAD_MODERN"
  | "SECURE"
  | "WEAK_CBC"
  | "BROKEN_LEGACY";

export interface CipherSuiteItem {
  cipher_name: string;
  protocol: string;
  security_level: CipherSecurityLevel;
  has_pfs: boolean;
  key_exchange: string;
  encryption: string;
  mac: string;
  is_recommended: boolean;
}

export interface CertChainNode {
  common_name: string;
  organization?: string;
  issuer_name: string;
  valid_from: string;
  valid_to: string;
  days_remaining: number;
  key_type: string;
  key_size_bits: number;
  signature_algorithm: string;
  is_expired: boolean;
  is_trusted_ca: boolean;
}

export interface HSTSStatus {
  is_enabled: boolean;
  max_age_seconds: number;
  include_subdomains: boolean;
  preload_ready: boolean;
  raw_header?: string;
  warnings: string[];
}

export interface TLSCryptoReport {
  crypto_score: number;
  ssl_labs_grade: "A+" | "A" | "B" | "C" | "F";
  negotiated_protocol: TLSProtocolVersion;
  negotiated_cipher: string;
  has_pfs: boolean;
  supports_tls13: boolean;
  supports_legacy_tls: boolean;
  cert_chain: CertChainNode[];
  ciphers: CipherSuiteItem[];
  hsts_status: HSTSStatus;
  days_until_cert_expiry: number;
  recommended_nginx_conf: string;
  recommended_apache_conf: string;
  remediation_steps: string[];
  compliance_standards?: string[];
  audited_at: string;
}

export type IncidentChannel =
  | "SLACK"
  | "TEAMS"
  | "DISCORD"
  | "JIRA"
  | "GENERIC_WEBHOOK";

export interface IncidentPayloadCard {
  card_id: string;
  channel: IncidentChannel;
  target_url: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: "SECURITY" | "UX";
  formatted_payload: Record<string, unknown>;
  curl_preview: string;
  status: "READY_TO_DISPATCH" | "DISPATCHED" | "SIMULATED_SUCCESS";
  recommended_action?: string;
  created_at: string;
}

export interface IncidentHubReport {
  total_incidents_generated: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  channels_supported: string[];
  cards: IncidentPayloadCard[];
  webhook_endpoints_configured: string[];
  compliance_standards?: string[];
  audited_at: string;
}

export type StructuredDataType =
  | "JSON_LD"
  | "MICRODATA"
  | "OPEN_GRAPH"
  | "TWITTER_CARD"
  | "CANONICAL"
  | "META_TAGS";

export interface StructuredDataDefect {
  defect_id: string;
  data_type: StructuredDataType;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  description: string;
  remediation: string;
  element_tag: string;
  expected_format: string;
  actual_value?: string;
}

export interface SchemaOrgEntity {
  entity_id: string;
  schema_type: string;
  raw_properties: Record<string, unknown>;
  is_valid: boolean;
  validation_errors: string[];
}

export interface SocialCardPreview {
  platform: string;
  title: string;
  description: string;
  image_url?: string;
  display_url: string;
  aspect_ratio: string;
}

export interface SEOStructuredDataReport {
  seo_health_score: number;
  google_rich_result_eligible: boolean;
  total_defects_count: number;
  schema_entities: SchemaOrgEntity[];
  open_graph_tags: Record<string, string>;
  twitter_tags: Record<string, string>;
  canonical_url?: string;
  meta_robots?: string;
  title_tag?: string;
  meta_description?: string;
  defects: StructuredDataDefect[];
  social_previews: SocialCardPreview[];
  recommended_nextjs_metadata_code: string;
  recommended_json_ld_code: string;
  compliance_standards?: string[];
  audited_at: string;
}












