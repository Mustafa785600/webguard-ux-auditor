"use client";

import { useState } from "react";
import { analyzePRD } from "@/lib/api";
import type { PRDAnalysisResponse, PRDScenario } from "@/types/scan";
import type { Language } from "@/lib/i18n";

interface PrdIntelligenceCardProps {
  targetUrl: string;
  initialAnalysis?: PRDAnalysisResponse | null;
  lang?: Language;
}

const PRD_TEMPLATES_TR = [
  {
    name: "🏦 FinTek / FAST & Para Transferi",
    content: `# FinTek FAST & Havale Transfer PRD'si
Kullanıcı Rolü: Banka Müşterisi
İş Mantığı ve Kabul Kriterleri:
- Kullanıcı kaynak vadesiz hesabını ve alıcı IBAN numarasını seçer.
- Gönderilecek transfer tutarı girilir (günlük FAST işlem limitleri denetlenir).
- Çift faktörlü SMS / Mobil onay kodu girilerek işlem onaylanır.
- Yetersiz bakiye durumunda bilgilendirici hata mesajı gösterilir.
- Başarılı transfer neticesinde dekont referans kodu üretilir ve bakiye anında güncellenir.`,
  },
  {
    name: "🛒 E-Ticaret Sepet & PCI-DSS Ödeme",
    content: `# E-Ticaret Sepet & Ödeme Akışı PRD'si
Kullanıcı Rolü: Alıcı / Müşteri
İş Mantığı ve Kabul Kriterleri:
- Ürün kataloğundan ürün seçilir ve 'Sepete Ekle' butonuna tıklanır.
- Sepet sayfasında ürün adedi güncellenebilir ve sepet tutarı hesaplanır.
- Ödeme adımında teslimat adresi ve kredi kartı bilgileri toplanır.
- Kart numarası Luhn algoritması ile doğrulanır, son kullanma tarihi geçmiş kartlar reddedilir.
- Başarılı ödeme sonrasında sipariş numarası içeren onay ekranı gösterilir.`,
  },
  {
    name: "🔐 SaaS Kullanıcı Girişi & Oturum",
    content: `# SaaS Kimlik Doğrulama & Oturum Yönetimi PRD'si
Kullanıcı Rolü: Kayıtlı Kullanıcı
İş Mantığı ve Kabul Kriterleri:
- Giriş formunda e-posta formatı doğrulanır.
- Hatalı kimlik bilgilerinde genel bir 'E-posta veya şifre hatalı' uyarısı verilir.
- Başarılı girişte JWT oturum belirteci oluşturulur ve kullanıcı paneline yönlendirilir.
- 30 dakika hareketsizlik sonrasında oturum zaman aşımına uğrar ve yeniden giriş istenir.`,
  },
  {
    name: "🔍 Dinamik Arama & Çoklu Filtre",
    content: `# Dinamik Arama & Filtreleme PRD'si
Kullanıcı Rolü: Son Kullanıcı
İş Mantığı ve Kabul Kriterleri:
- Arama kutusuna yazılan anahtar kelimelere anlık otomatik tamamlama önerileri sunulur.
- Kategori ve fiyat aralığı filtreleri sayfa yenilenmeden anlık güncellenir.
- Sonuç bulunamadığında kullanıcıya arama önerileri ve filtre sıfırlama seçeneği sunulur.`,
  },
];

const PRD_TEMPLATES_EN = [
  {
    name: "🏦 FinTech / Instant Funds Transfer",
    content: `# FinTech Instant Funds Transfer PRD
User Role: Bank Customer
Acceptance Criteria:
- Customer selects source account and inputs recipient IBAN.
- System validates available balance and daily transfer limits.
- Transaction confirmed with two-factor SMS / authenticator token.
- Insufficient balance displays actionable error.
- Successful transaction generates receipt reference ID and updates ledger.`,
  },
  {
    name: "🛒 E-Commerce Cart & Checkout",
    content: `# E-Commerce Storefront PRD
User Role: Customer
Acceptance Criteria:
- Must display product catalog with pricing.
- Adding product increases cart item badge count.
- Checkout page collects shipping address and credit card details.
- Validates postal code format and declines expired credit cards.
- Successful order displays confirmation receipt with order ID.`,
  },
  {
    name: "🔐 SaaS User Auth & Onboarding",
    content: `# SaaS Platform Auth PRD
User Role: Registered User
Acceptance Criteria:
- Login form validates valid email formatting.
- Entering incorrect credentials shows error: "Invalid email or password".
- Successful login issues JWT session and redirects to /dashboard.
- Session expires after 30 minutes of inactivity and prompts re-authentication.`,
  },
  {
    name: "🔍 Dynamic Search & Data Filter",
    content: `# Enterprise Search & Filter PRD
User Role: Analyst
Acceptance Criteria:
- Search input supports instant auto-complete suggestions.
- Filtering by active status instantly updates the table without a full page refresh.
- Empty query result displays helpful reset filter suggestions.`,
  },
];

export default function PrdIntelligenceCard({
  targetUrl,
  initialAnalysis,
  lang = "tr",
}: PrdIntelligenceCardProps) {
  const [open, setOpen] = useState(true);
  const [prdText, setPrdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PRDAnalysisResponse | null>(initialAnalysis ?? null);
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [copiedIde, setCopiedIde] = useState(false);
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);

  // Sub-tabs: "SCENARIOS" | "RTM" | "CODE"
  const [activeSubTab, setActiveSubTab] = useState<"SCENARIOS" | "RTM" | "CODE">("SCENARIOS");
  // Scenario filter: "ALL" | "POSITIVE" | "NEGATIVE_SECURITY"
  const [scenarioFilter, setScenarioFilter] = useState<"ALL" | "POSITIVE" | "NEGATIVE_SECURITY">("ALL");

  const templates = lang === "tr" ? PRD_TEMPLATES_TR : PRD_TEMPLATES_EN;

  async function handleGenerate() {
    if (!prdText.trim()) {
      setError(
        lang === "tr"
          ? "Lütfen önce bir PRD gereksinim metni yazın veya hazır şablonlardan birini seçin."
          : "Please enter or select a PRD specification text first."
      );
      return;
    }
    const target = targetUrl?.trim() || "https://example.com";
    setLoading(true);
    setError(null);
    try {
      const data = await analyzePRD(target, prdText.trim());
      setAnalysis(data);
      setActiveScenarioIdx(0);
      setActiveSubTab("SCENARIOS");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to analyze PRD.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopySpec() {
    if (!analysis?.generated_spec_code) return;
    navigator.clipboard.writeText(analysis.generated_spec_code);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  }

  function handleCopyIdePrompt() {
    if (!analysis) return;
    const prompt = `
### TestSprite AI Test & Security Specification
Target URL: ${analysis.target_url}
Specification Summary: ${analysis.summary}
Roles: ${analysis.user_roles.join(", ")}

#### Generated Scenarios & Security Boundaries:
${analysis.scenarios
  .map(
    (s, i) =>
      `[${s.scenario_type || "POSITIVE"}] #${i + 1} - ${s.title}\n` +
      `  • Role: ${s.role}\n` +
      `  • Steps: ${s.steps.join(" -> ")}\n` +
      `  • Expected: ${s.expected_result}\n` +
      (s.abuse_payload ? `  • Abuse Payload: ${s.abuse_payload}\n` : "") +
      (s.security_risk ? `  • Security Risk: ${s.security_risk}\n` : "")
  )
  .join("\n")}

#### Playwright E2E Spec Code:
\`\`\`typescript
${analysis.generated_spec_code}
\`\`\`

Task for Cursor / Claude Code:
Please review this specification, ensure all functional steps and negative security boundaries are covered in our project test suite, and implement end-to-end verification.
`.trim();

    navigator.clipboard.writeText(prompt);
    setCopiedIde(true);
    setTimeout(() => setCopiedIde(false), 2500);
  }

  function handleDownloadSpec() {
    if (!analysis?.generated_spec_code) return;
    const blob = new Blob([analysis.generated_spec_code], { type: "text/typescript" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const hostname = targetUrl ? new URL(targetUrl).hostname.replace(/\./g, "_") : "target";
    a.download = `playwright_testsprite_${hostname}.spec.ts`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  const filteredScenarios = (analysis?.scenarios || []).filter((sc) => {
    if (scenarioFilter === "ALL") return true;
    return (sc.scenario_type || "POSITIVE") === scenarioFilter;
  });

  const selectedScenario = filteredScenarios[activeScenarioIdx] || filteredScenarios[0];

  return (
    <section className="prd-card">
      <div
        className="prd-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <div className="prd-title-group">
          <span className="prd-badge-icon">🧠</span>
          <div>
            <h2 className="prd-title">
              {lang === "tr"
                ? "TestSprite PRD Destekli Otonom Test & Güvenlik Zekası"
                : "TestSprite PRD-Driven Autonomous Test & Security Intelligence"}
            </h2>
            <p className="prd-subtitle">
              {lang === "tr"
                ? "Ürün gereksinimlerinden (PRD) pozitif kullanıcı akışları, negatif güvenlik sınırları ve Gereksinim İzlenebilirlik Matrisi (RTM) türetin."
                : "Synthesize user roles, edge cases, negative security boundaries, and Requirements Traceability Matrix (RTM) from specifications."}
            </p>
          </div>
        </div>

        <span className={`finding-chevron ${open ? "open" : ""}`} aria-hidden>▾</span>
      </div>

      {open && (
        <div className="prd-body">
          {/* Quick PRD Templates Bar */}
          <div className="prd-template-bar">
            <span className="prd-template-label">
              {lang === "tr" ? "Örnek PRD Şablonları:" : "Quick PRD Templates:"}
            </span>
            {templates.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                className="prd-template-btn"
                onClick={() => setPrdText(tmpl.content)}
              >
                {tmpl.name}
              </button>
            ))}
          </div>

          {/* PRD Textarea Input */}
          <div className="prd-input-wrap">
            <textarea
              className="prd-textarea"
              placeholder={
                lang === "tr"
                  ? "Ürün gereksinim dokümanı (PRD), kullanıcı hikayesi (User Story) veya kabul kriterlerini buraya yapıştırın..."
                  : "Paste Product Requirements Document (PRD), feature specs, user stories, or acceptance criteria..."
              }
              rows={5}
              value={prdText}
              onChange={(e) => setPrdText(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="prd-error">{error}</div>}

          {/* Action Row */}
          <div className="prd-action-row">
            <button
              type="button"
              className="btn-generate-prd"
              onClick={handleGenerate}
              disabled={loading || !prdText.trim()}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" />{" "}
                  {lang === "tr" ? "Yapay Zeka Test & Güvenlik Matrisi Türetiyor…" : "Synthesizing AI Scenarios…"}
                </>
              ) : (
                <>✨ {lang === "tr" ? "Playwright & Güvenlik Matrisini Üret" : "Generate Playwright & Security Matrix"}</>
              )}
            </button>
            <span className="prd-note">
              {lang === "tr" ? "Hedef:" : "Target:"} <strong>{targetUrl || "https://example.com"}</strong>
            </span>
          </div>

          {/* Analysis Results View */}
          {analysis && (
            <div className="prd-results-container">
              {/* Summary Bar */}
              <div className="prd-summary-bar">
                <div className="prd-summary-text">{analysis.summary}</div>
                <div className="prd-roles-list">
                  <span className="roles-label">{lang === "tr" ? "Roller:" : "Roles:"}</span>
                  {analysis.user_roles.map((role, idx) => (
                    <span key={idx} className="prd-role-pill">
                      👤 {role}
                    </span>
                  ))}
                  {analysis.security_scenarios_count !== undefined && (
                    <span className="prd-sec-badge">
                      🛡️ {analysis.security_scenarios_count} {lang === "tr" ? "Güvenlik Sınır Testi" : "Security Tests"}
                    </span>
                  )}
                  {analysis.coverage_score !== undefined && (
                    <span className="prd-cov-badge">
                      ✓ %{analysis.coverage_score} {lang === "tr" ? "PRD Kapsamı" : "Coverage"}
                    </span>
                  )}
                </div>
              </div>

              {/* Sub-tab Navigation */}
              <div className="prd-subtabs-bar">
                <button
                  type="button"
                  className={`prd-subtab-btn ${activeSubTab === "SCENARIOS" ? "active" : ""}`}
                  onClick={() => setActiveSubTab("SCENARIOS")}
                >
                  🧪 {lang === "tr" ? "Senaryolar & Güvenlik Sınırları" : "Scenarios & Security"} ({analysis.scenarios.length})
                </button>
                <button
                  type="button"
                  className={`prd-subtab-btn ${activeSubTab === "RTM" ? "active" : ""}`}
                  onClick={() => setActiveSubTab("RTM")}
                >
                  📋 {lang === "tr" ? "Gereksinim İzlenebilirlik Matrisi (RTM)" : "Traceability Matrix (RTM)"} ({analysis.traceability_matrix?.length ?? 0})
                </button>
                <button
                  type="button"
                  className={`prd-subtab-btn ${activeSubTab === "CODE" ? "active" : ""}`}
                  onClick={() => setActiveSubTab("CODE")}
                >
                  💻 {lang === "tr" ? "Playwright .spec.ts Kodu" : "Playwright Spec Code"}
                </button>

                <div className="prd-top-export-actions">
                  <button
                    type="button"
                    className="prd-ide-copy-btn"
                    onClick={handleCopyIdePrompt}
                    title="Cursor / Claude Code Prompt'unu Kopyala"
                  >
                    {copiedIde
                      ? lang === "tr"
                        ? "✓ Prompt Kopyalandı!"
                        : "✓ Prompt Copied!"
                      : lang === "tr"
                      ? "🤖 Cursor / Claude Code Prompt'u"
                      : "🤖 Copy Cursor/Claude Prompt"}
                  </button>
                </div>
              </div>

              {/* VIEW 1: SCENARIOS */}
              {activeSubTab === "SCENARIOS" && (
                <div className="prd-columns-grid">
                  {/* Left: Scenarios List with Filter */}
                  <div className="prd-scenarios-panel">
                    <div className="scenarios-filter-pills">
                      <button
                        type="button"
                        className={`sc-filter-btn ${scenarioFilter === "ALL" ? "active" : ""}`}
                        onClick={() => {
                          setScenarioFilter("ALL");
                          setActiveScenarioIdx(0);
                        }}
                      >
                        {lang === "tr" ? "Tümü" : "All"} ({analysis.scenarios.length})
                      </button>
                      <button
                        type="button"
                        className={`sc-filter-btn positive ${scenarioFilter === "POSITIVE" ? "active" : ""}`}
                        onClick={() => {
                          setScenarioFilter("POSITIVE");
                          setActiveScenarioIdx(0);
                        }}
                      >
                        ✓ {lang === "tr" ? "Fonksiyonel (Happy Path)" : "Functional"}
                      </button>
                      <button
                        type="button"
                        className={`sc-filter-btn security ${scenarioFilter === "NEGATIVE_SECURITY" ? "active" : ""}`}
                        onClick={() => {
                          setScenarioFilter("NEGATIVE_SECURITY");
                          setActiveScenarioIdx(0);
                        }}
                      >
                        🛡️ {lang === "tr" ? "Negatif Güvenlik & İstismar" : "Security Boundaries"}
                      </button>
                    </div>

                    <div className="scenario-chips">
                      {filteredScenarios.map((sc, idx) => {
                        const isSecurity = sc.scenario_type === "NEGATIVE_SECURITY";
                        return (
                          <button
                            key={idx}
                            className={`scenario-nav-item ${activeScenarioIdx === idx ? "active" : ""} ${isSecurity ? "is-security" : ""}`}
                            onClick={() => setActiveScenarioIdx(idx)}
                          >
                            <span className="sc-idx">
                              {isSecurity ? "🛡️" : `#${idx + 1}`}
                            </span>
                            <span className="sc-title">
                              {sc.requirement_id ? `[${sc.requirement_id}] ` : ""}{sc.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedScenario && (
                      <div className={`scenario-detail-card ${selectedScenario.scenario_type === "NEGATIVE_SECURITY" ? "security-mode" : ""}`}>
                        <div className="sc-card-header">
                          <span className={`sc-role-badge ${selectedScenario.scenario_type === "NEGATIVE_SECURITY" ? "badge-red" : ""}`}>
                            {selectedScenario.scenario_type === "NEGATIVE_SECURITY" ? "🛡️ Güvenlik Testi" : "✓ Fonksiyonel"} &bull; {selectedScenario.role}
                          </span>
                          <h4 className="sc-card-title">
                            {selectedScenario.requirement_id ? `[${selectedScenario.requirement_id}] ` : ""}{selectedScenario.title}
                          </h4>
                        </div>

                        {selectedScenario.security_risk && (
                          <div className="sc-risk-banner">
                            <strong>⚠️ {lang === "tr" ? "Hedef Güvenlik Riski: " : "Target Security Risk: "}</strong>
                            {selectedScenario.security_risk}
                          </div>
                        )}

                        {selectedScenario.abuse_payload && (
                          <div className="sc-payload-box">
                            <span className="payload-label">💥 {lang === "tr" ? "İstismar Payload'ı (Abuse Payload):" : "Abuse Payload:"}</span>
                            <code className="payload-code">{selectedScenario.abuse_payload}</code>
                          </div>
                        )}

                        <div className="sc-steps-section">
                          <span className="sc-section-label">{lang === "tr" ? "Yürütme Adımları:" : "Execution Steps:"}</span>
                          <ol className="sc-steps-list">
                            {selectedScenario.steps.map((st, i) => (
                              <li key={i}>{st}</li>
                            ))}
                          </ol>
                        </div>

                        <div className="sc-expected-section">
                          <span className="sc-section-label">{lang === "tr" ? "Beklenen Sonuç:" : "Expected Result:"}</span>
                          <p className="sc-expected-text">{selectedScenario.expected_result}</p>
                        </div>

                        {selectedScenario.edge_cases?.length > 0 && (
                          <div className="sc-edge-section">
                            <span className="sc-section-label">{lang === "tr" ? "Doğrulanan Uç Durumlar:" : "Edge Cases Tested:"}</span>
                            <div className="sc-edge-tags">
                              {selectedScenario.edge_cases.map((ec, i) => (
                                <span key={i} className="edge-tag">
                                  ⚠️ {ec}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Code Preview Panel */}
                  <div className="prd-code-panel">
                    <div className="ide-titlebar">
                      <div className="ide-dots">
                        <span className="ide-dot dot-red" />
                        <span className="ide-dot dot-yellow" />
                        <span className="ide-dot dot-green" />
                      </div>
                      <div className="ide-file-info">
                        <span className="ide-file-icon">📄</span>
                        <span className="ide-file-path">tests/e2e/testsprite_prd_matrix.spec.ts</span>
                      </div>
                      <div className="prd-code-actions">
                        <button
                          type="button"
                          className={`ide-copy-btn ${copiedSpec ? "copied" : ""}`}
                          onClick={handleCopySpec}
                          title="Copy Playwright Spec"
                        >
                          {copiedSpec ? (lang === "tr" ? "✓ Kopyalandı" : "✓ Copied") : (lang === "tr" ? "📋 Kopyala" : "📋 Copy")}
                        </button>
                        <button
                          type="button"
                          className="ide-copy-btn download-btn"
                          onClick={handleDownloadSpec}
                          title="Download .spec.ts"
                        >
                          📥 {lang === "tr" ? "İndir" : "Download"}
                        </button>
                      </div>
                    </div>

                    <pre className="prd-code-block">
                      <code>{analysis.generated_spec_code}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* VIEW 2: REQUIREMENTS TRACEABILITY MATRIX (RTM) */}
              {activeSubTab === "RTM" && (
                <div className="prd-rtm-container">
                  <div className="rtm-header-info">
                    <div>
                      <h3 className="rtm-title">
                        📋 {lang === "tr" ? "Gereksinim İzlenebilirlik Matrisi (Requirements Traceability Matrix - RTM)" : "Requirements Traceability Matrix (RTM)"}
                      </h3>
                      <p className="rtm-subtitle">
                        {lang === "tr"
                          ? "Her bir iş kuralının hem pozitif fonksiyonel test hem de negatif güvenlik sınırı ile %100 kapsandığını kanıtlayan denetim tablosu."
                          : "Audit matrix proving each requirement is 100% verified across both positive functional flows and security boundaries."}
                      </p>
                    </div>
                  </div>

                  {(!analysis.traceability_matrix || analysis.traceability_matrix.length === 0) ? (
                    <div className="rtm-empty">
                      {lang === "tr" ? "Bu PRD için izlenebilirlik matrisi oluşturulamadı." : "No traceability matrix available."}
                    </div>
                  ) : (
                    <div className="rtm-table-wrap">
                      <table className="rtm-table">
                        <thead>
                          <tr>
                            <th style={{ width: "90px" }}>{lang === "tr" ? "Gereksinim ID" : "Req ID"}</th>
                            <th>{lang === "tr" ? "İş Kuralı / PRD Maddesi" : "Requirement Description"}</th>
                            <th>{lang === "tr" ? "✓ Pozitif E2E Testi" : "Positive Functional Test"}</th>
                            <th>{lang === "tr" ? "🛡️ Negatif Güvenlik Sınırı" : "Security Abuse Boundary"}</th>
                            <th style={{ width: "100px", textAlign: "center" }}>{lang === "tr" ? "Risk Seviyesi" : "Risk"}</th>
                            <th style={{ width: "110px", textAlign: "center" }}>{lang === "tr" ? "Durum" : "Status"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.traceability_matrix.map((item, idx) => (
                            <tr key={idx}>
                              <td className="rtm-cell-id">{item.req_id}</td>
                              <td className="rtm-cell-req">{item.requirement}</td>
                              <td className="rtm-cell-pos">✓ {item.positive_test}</td>
                              <td className="rtm-cell-sec">🛡️ {item.security_test}</td>
                              <td style={{ textAlign: "center" }}>
                                <span className={`rtm-risk-badge ${item.risk_level.toLowerCase()}`}>
                                  {item.risk_level}
                                </span>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <span className="rtm-status-badge">
                                  ✓ {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: PLAYWRIGHT CODE FULL */}
              {activeSubTab === "CODE" && (
                <div className="prd-code-full-view">
                  <div className="ide-titlebar">
                    <div className="ide-dots">
                      <span className="ide-dot dot-red" />
                      <span className="ide-dot dot-yellow" />
                      <span className="ide-dot dot-green" />
                    </div>
                    <div className="ide-file-info">
                      <span className="ide-file-icon">📄</span>
                      <span className="ide-file-path">tests/e2e/testsprite_full_suite.spec.ts</span>
                    </div>
                    <div className="prd-code-actions">
                      <button
                        type="button"
                        className={`ide-copy-btn ${copiedSpec ? "copied" : ""}`}
                        onClick={handleCopySpec}
                        title="Copy Playwright Spec"
                      >
                        {copiedSpec ? (lang === "tr" ? "✓ Kopyalandı" : "✓ Copied") : (lang === "tr" ? "📋 Kodu Kopyala" : "📋 Copy Code")}
                      </button>
                      <button
                        type="button"
                        className="ide-copy-btn download-btn"
                        onClick={handleDownloadSpec}
                        title="Download .spec.ts"
                      >
                        📥 {lang === "tr" ? "Dosyayı İndir (.spec.ts)" : "Download File (.spec.ts)"}
                      </button>
                    </div>
                  </div>

                  <pre className="prd-code-block full-height">
                    <code>{analysis.generated_spec_code}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
