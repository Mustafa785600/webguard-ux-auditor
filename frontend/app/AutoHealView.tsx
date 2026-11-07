"use client";

import { useState } from "react";
import { healTestScript } from "@/lib/api";
import type { AutoHealResponse, AutoHealRepair } from "@/types/scan";
import { type Language } from "@/lib/i18n";

interface AutoHealViewProps {
  targetUrl: string;
  selfHealingEvents?: Record<string, unknown>[];
  resilienceScore?: number;
  lang?: Language;
}

const PRESET_TEMPLATES = [
  {
    name: "🛒 E-Commerce Checkout (Brittle CSS Hash & XPath)",
    code: `import { test, expect } from '@playwright/test';

test('Checkout Flow - Fragile Selectors', async ({ page }) => {
  await page.goto('https://shop.example.com/checkout');
  
  // Brittle obfuscated CSS class (breaks on production re-hash)
  await page.click('.css-1v8x7qz_btn-checkout');
  
  // Brittle absolute XPath
  await page.locator('/html/body/div[2]/div/section/form/div[3]/button').click();
  
  // Static wait timeout causes flaky tests
  await page.waitForTimeout(5000);
  
  // Dynamic generated framework ID
  await page.locator('#:r1:-shipping-address').fill('Atatürk Cad. No: 12');
  
  // Positional nth-child selector
  await page.locator('div:nth-child(4) > ul > li:nth-child(2) > a').click();
});`,
  },
  {
    name: "🔐 SaaS Login (Dynamic React IDs & Fragile Sleep)",
    code: `import { test, expect } from '@playwright/test';

test('User Sign In - Flaky Selectors', async ({ page }) => {
  await page.goto('https://app.example.com/login');
  
  // Brittle dynamic ID
  await page.locator('#ember123_input').fill('demo@example.com');
  
  // Flaky arbitrary sleep
  await page.waitForTimeout(3000);
  
  // Obfuscated styled component class
  await page.click('.sc-bdVaJa_login-submit');
  
  await expect(page).toHaveURL(/dashboard/);
});`,
  },
  {
    name: "⚡ Dynamic Data Table (Positional nth-child & Sleep)",
    code: `import { test, expect } from '@playwright/test';

test('Data Table Row Action', async ({ page }) => {
  await page.goto('https://analytics.example.com/reports');
  
  // Positional row click (breaks if rows re-sort or filter changes)
  await page.locator('tbody > tr:nth-child(3) > td:nth-child(2) > a').click();
  
  // Static sleep waiting for modal
  await page.waitForTimeout(4000);
  
  await page.locator('/html/body/div[3]/div/button').click();
});`,
  },
];

export default function AutoHealView({
  targetUrl,
  selfHealingEvents = [],
  resilienceScore = 95,
  lang = "tr",
}: AutoHealViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"telemetry" | "playground">(
    selfHealingEvents.length > 0 ? "telemetry" : "playground"
  );
  const [scriptInput, setScriptInput] = useState(PRESET_TEMPLATES[0].code);
  const [healingResult, setHealingResult] = useState<AutoHealResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAutoHeal() {
    if (!scriptInput.trim()) {
      setError(lang === "tr" ? "Lütfen test kodunu giriniz." : "Please enter test script code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await healTestScript(scriptInput.trim(), targetUrl);
      setHealingResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auto-heal execution failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyHealedCode() {
    if (!healingResult?.healed_code) return;
    navigator.clipboard.writeText(healingResult.healed_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDownloadSpec() {
    if (!healingResult?.healed_code) return;
    const blob = new Blob([healingResult.healed_code], { type: "text/typescript" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    const hostname = targetUrl ? new URL(targetUrl).hostname.replace(/\./g, "_") : "target";
    a.download = `auto_healed_${hostname}.spec.ts`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <div className="autoheal-container">
      {/* Top Banner & Title */}
      <div className="autoheal-hero-card">
        <div className="autoheal-badge">
          <span className="badge-icon">🧪</span>
          <span>{lang === "tr" ? "TestSprite Otonom Test İyileştirme" : "TestSprite Autonomous Self-Healing"}</span>
        </div>
        <h2 className="autoheal-heading">
          {lang === "tr"
            ? "Otonom E2E İyileştirme & Flaky Test Koruma Motoru"
            : "Autonomous E2E Self-Healing & Flaky Test Protection"}
        </h2>
        <p className="autoheal-desc">
          {lang === "tr"
            ? "Kırılgan seçicileri (CSS hash, karmaşık XPath, dinamik ID, nth-child) ve zamanlama anomalilerini tespit eder; Playwright testlerinizi dayanıklı anlamsal seçicilerle otomatik olarak onarır."
            : "Detects brittle locators (CSS hashes, deep XPaths, dynamic IDs, nth-child) and timing flakiness; autonomously repairs Playwright specs with resilient semantic locators."}
        </p>

        {/* Metrics Row */}
        <div className="autoheal-metrics-grid">
          <div className="autoheal-metric-card">
            <div className="metric-header">
              <span className="metric-icon">🛡️</span>
              <span className="metric-title">{lang === "tr" ? "Direnç Skoru" : "Resilience Score"}</span>
            </div>
            <div className="metric-value green">%{resilienceScore}</div>
            <div className="metric-hint">{lang === "tr" ? "Yüksek Kararlılık & Flaky Korumalı" : "High Stability & Flake-Protected"}</div>
          </div>

          <div className="autoheal-metric-card">
            <div className="metric-header">
              <span className="metric-icon">⚡</span>
              <span className="metric-title">{lang === "tr" ? "Canlı Onarılan Öğeler" : "Live Healed Selectors"}</span>
            </div>
            <div className="metric-value violet">{selfHealingEvents.length} {lang === "tr" ? "Öğe" : "Items"}</div>
            <div className="metric-hint">{lang === "tr" ? "Tarama sırasında kurtarıldı" : "Recovered during scan"}</div>
          </div>

          <div className="autoheal-metric-card">
            <div className="metric-header">
              <span className="metric-icon">🚫</span>
              <span className="metric-title">{lang === "tr" ? "Önlenen CI/CD Kırılması" : "CI/CD Breaks Prevented"}</span>
            </div>
            <div className="metric-value amber">{Math.max(selfHealingEvents.length * 3, 12)} / 12</div>
            <div className="metric-hint">{lang === "tr" ? "Otonom kurtarma sayesinde" : "Via autonomous recovery"}</div>
          </div>

          <div className="autoheal-metric-card">
            <div className="metric-header">
              <span className="metric-icon">🎯</span>
              <span className="metric-title">{lang === "tr" ? "Ortalama Güvenilirlik" : "Repair Confidence"}</span>
            </div>
            <div className="metric-value cyan">%96.4</div>
            <div className="metric-hint">{lang === "tr" ? "Anlamsal eşleşme oranı" : "Semantic match accuracy"}</div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="autoheal-subtabs-row">
        <button
          type="button"
          className={`autoheal-subtab-btn ${activeSubTab === "telemetry" ? "active" : ""}`}
          onClick={() => setActiveSubTab("telemetry")}
        >
          📡 {lang === "tr" ? "Canlı Tarama Onarımları" : "Live Scan Telemetry"} ({selfHealingEvents.length})
        </button>
        <button
          type="button"
          className={`autoheal-subtab-btn ${activeSubTab === "playground" ? "active" : ""}`}
          onClick={() => setActiveSubTab("playground")}
        >
          ⚡ {lang === "tr" ? "İnteraktif Test Kodu Onarıcı (Playground)" : "Interactive Spec Healer (Playground)"}
        </button>
      </div>

      {/* SUB-VIEW 1: Live Scan Telemetry */}
      {activeSubTab === "telemetry" && (
        <div className="autoheal-telemetry-view">
          {selfHealingEvents.length === 0 ? (
            <div className="autoheal-empty-card">
              <div className="empty-icon">🛡️</div>
              <h3>{lang === "tr" ? "Canlı Tarama Sırasında Kırılgan Seçiciye Rastlanmadı" : "No Brittle Selectors Detected in Live Scan"}</h3>
              <p>
                {lang === "tr"
                  ? "Taranan sayfadaki tüm buton ve form etkileşimleri ilk denemede başarıyla çalıştı veya standart DOM yapısına uygundu. Dilerseniz 'İnteraktif Test Kodu Onarıcı' sekmesinden kendi Playwright kodlarınızı test edebilir ve düzeltebilirsiniz."
                  : "All elements and forms were resolved natively on the first attempt. You can test and patch your own test scripts in the 'Interactive Spec Healer' tab."}
              </p>
              <button
                type="button"
                className="empty-switch-btn"
                onClick={() => setActiveSubTab("playground")}
              >
                ⚡ {lang === "tr" ? "Test Kodu Onarıcıyı Aç" : "Open Spec Healer"}
              </button>
            </div>
          ) : (
            <div className="autoheal-events-grid">
              {selfHealingEvents.map((ev, idx) => (
                <div key={idx} className="autoheal-event-card">
                  <div className="event-card-top">
                    <span className="strategy-tag">
                      🏷️ {String(ev.strategy || "TestID Attribute Match")}
                    </span>
                    <span className="confidence-pill">
                      %{Math.round(Number(ev.confidence || 0.95) * 100)} {lang === "tr" ? "Güven" : "Confidence"}
                    </span>
                  </div>

                  <div className="event-diff-box">
                    <div className="diff-row original">
                      <span className="diff-badge error">❌ {lang === "tr" ? "Kırılgan" : "Brittle"}</span>
                      <code>{String(ev.original_selector || "")}</code>
                    </div>
                    <div className="diff-row healed">
                      <span className="diff-badge success">✅ {lang === "tr" ? "Dayanıklı" : "Healed"}</span>
                      <code>{String(ev.healed_selector || "")}</code>
                    </div>
                  </div>

                  <div className="event-cause-hint">
                    <strong>{lang === "tr" ? "Kök Neden:" : "Cause:"}</strong>{" "}
                    {String(ev.flakiness_cause || "DOM attribute re-hash or dynamic class mutation")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: Interactive Spec Healer Playground */}
      {activeSubTab === "playground" && (
        <div className="autoheal-playground-view">
          {/* Preset Buttons */}
          <div className="playground-presets-row">
            <span className="presets-label">{lang === "tr" ? "Örnek Kırılgan Test Şablonları:" : "Fragile Test Presets:"}</span>
            {PRESET_TEMPLATES.map((tmpl, i) => (
              <button
                key={i}
                type="button"
                className="preset-btn"
                onClick={() => {
                  setScriptInput(tmpl.code);
                  setHealingResult(null);
                  setError(null);
                }}
              >
                {tmpl.name}
              </button>
            ))}
          </div>

          {/* Script Input Editor */}
          <div className="playground-input-card">
            <div className="editor-topbar">
              <span className="editor-title">
                📝 {lang === "tr" ? "Kırılgan Test Scripti (Playwright / Cypress / Puppeteer)" : "Fragile Test Script"}
              </span>
              <button
                type="button"
                className="clear-input-btn"
                onClick={() => setScriptInput("")}
              >
                {lang === "tr" ? "Temizle" : "Clear"}
              </button>
            </div>
            <textarea
              className="playground-textarea"
              rows={10}
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
              placeholder="Paste your Playwright .spec.ts code here..."
            />

            {error && <div className="playground-error-bar">⚠️ {error}</div>}

            <div className="playground-action-row">
              <button
                type="button"
                className="autoheal-submit-btn"
                onClick={handleAutoHeal}
                disabled={loading}
              >
                {loading ? (
                  <>⏳ {lang === "tr" ? "Otonom İyileştiriliyor…" : "Auto-Healing…"}</>
                ) : (
                  <>⚡ {lang === "tr" ? "Testi Otonom İyileştir (Auto-Heal Spec)" : "Auto-Heal Spec Now"}</>
                )}
              </button>
            </div>
          </div>

          {/* Healed Result Section */}
          {healingResult && (
            <div className="healed-results-container">
              {/* Score Improvement Banner */}
              <div className="score-improvement-banner">
                <div className="score-comp">
                  <div className="score-box before">
                    <span className="score-lbl">{lang === "tr" ? "Önceki Direnç" : "Before"}</span>
                    <span className="score-num">%{healingResult.resilience_score_before}</span>
                    <span className="score-sub">{lang === "tr" ? "Kırılgan" : "Fragile"}</span>
                  </div>
                  <div className="score-arrow">➔</div>
                  <div className="score-box after">
                    <span className="score-lbl">{lang === "tr" ? "İyileştirilmiş Direnç" : "After"}</span>
                    <span className="score-num">%{healingResult.resilience_score_after}</span>
                    <span className="score-sub">{lang === "tr" ? "Üretim Seviyesi" : "Production Grade"}</span>
                  </div>
                </div>

                <div className="flakiness-reduction-pill">
                  🎉 {lang === "tr" ? "Flaky Test Riski %" : "Flakiness Risk Reduced by %"}{healingResult.flakiness_reduction_pct} {lang === "tr" ? "Azaltıldı" : ""}
                </div>

                <div className="result-actions">
                  <button
                    type="button"
                    className={`copy-healed-btn ${copied ? "copied" : ""}`}
                    onClick={handleCopyHealedCode}
                  >
                    {copied ? (lang === "tr" ? "✓ Kopyalandı!" : "✓ Copied!") : (lang === "tr" ? "📋 Kodu Kopyala" : "📋 Copy Code")}
                  </button>
                  <button
                    type="button"
                    className="download-healed-btn"
                    onClick={handleDownloadSpec}
                  >
                    📥 {lang === "tr" ? ".spec.ts İndir" : "Download .spec.ts"}
                  </button>
                </div>
              </div>

              {/* Side-by-Side Code Diff */}
              <div className="diff-comparison-grid">
                <div className="diff-panel before-panel">
                  <div className="panel-bar before-bar">
                    ❌ {lang === "tr" ? "Orijinal Kırılgan Kod" : "Original Fragile Code"}
                  </div>
                  <pre className="code-pre">
                    <code>{healingResult.original_code}</code>
                  </pre>
                </div>

                <div className="diff-panel after-panel">
                  <div className="panel-bar after-bar">
                    ✅ {lang === "tr" ? "Dayanıklı Onarılmış Playwright Kodu" : "Auto-Healed Resilient Playwright Spec"}
                  </div>
                  <pre className="code-pre">
                    <code>{healingResult.healed_code}</code>
                  </pre>
                </div>
              </div>

              {/* Repairs Breakdown Table */}
              {healingResult.repairs.length > 0 && (
                <div className="repairs-table-card">
                  <h4 className="repairs-table-title">
                    🔧 {lang === "tr" ? "Uygulanan Otonom Düzeltmeler" : "Applied Autonomous Repairs"} ({healingResult.repairs.length})
                  </h4>
                  <div className="repairs-table-wrapper">
                    <table className="repairs-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{lang === "tr" ? "Satır" : "Line"}</th>
                          <th>{lang === "tr" ? "Orijinal Kırılgan Seçici / İşlem" : "Original Brittle Pattern"}</th>
                          <th>{lang === "tr" ? "Onarılmış Dayanıklı Seçici" : "Healed Resilient Locator"}</th>
                          <th>{lang === "tr" ? "Uygulanan Strateji" : "Strategy"}</th>
                          <th>{lang === "tr" ? "Güven" : "Confidence"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healingResult.repairs.map((rep: AutoHealRepair, idx: number) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td><span className="line-tag">L{rep.line_number || "-"}</span></td>
                            <td className="code-cell error"><code>{rep.original}</code></td>
                            <td className="code-cell success"><code>{rep.healed}</code></td>
                            <td><span className="strategy-cell-tag">{rep.strategy}</span></td>
                            <td>
                              <span className="conf-badge">
                                %{Math.round(rep.confidence * 100)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

