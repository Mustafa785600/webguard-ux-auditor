"""
WebGuard Otonom Bütünsel Kod Tabanı ve Mimari Zeka Motoru (Codebase Intelligence Engine)
========================================================================================
Tüm sistemin, frontend ve backend kodlarını bir bütün olarak ele alır.
- AST (Abstract Syntax Tree) ile her sınıfın, fonksiyonun ve bileşenin amacını (neden yazıldığını) çözer.
- Servisler, API kontrolcüleri, veri modelleri ve UI bileşenleri arasındaki tüm bağlantıları (call hierarchy, imports, HTTP bridges) haritalar.
- Değişiklik etki alanı (Blast Radius) analizi yaparak bir kod değiştiğinde sistemde nelerin etkileneceğini hesaplar.
- Uçtan uca Full-Stack akışları (Frontend UI ➔ API ➔ Service ➔ Security ➔ Model) otomatik çıkarır.
"""

import ast
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.models.schema import (
    ArchitectureLayer,
    CodebaseConnectionEdge,
    CodebaseIntelligenceReport,
    CodeSymbolNode,
    FullStackFlow,
)


class CodebaseIntelligenceEngine:
    """
    Kod tabanını semantik, yapısal ve mimari olarak bütünsel şekilde analiz eden zeka motoru.
    """

    EXCLUDED_DIRS: Set[str] = {
        ".git",
        "node_modules",
        ".next",
        "__pycache__",
        "venv",
        ".venv",
        "env",
        ".pytest_cache",
        ".vscode",
        ".idea",
        "dist",
        "build",
        ".turbo",
        "coverage",
    }

    # Semantik Amaç Sözlüğü (Önceden Eğitilmiş / Çıkarımlı Mimari Şablonlar)
    INTENT_KNOWLEDGE_BASE: Dict[str, str] = {
        "CookieConsentManager": "KVKK ve GDPR çerez izin pencerelerini algılar; dark pattern'ları engellemek için 'Reddet' butonuna öncelik vererek kapatır.",
        "HumanScrollEngine": "Doğal insan kaydırma hareketlerini simüle eder; lazy-load yüklenen görsel ve DOM bileşenlerini tetikler ve bozuk kaynakları yakalar.",
        "NavigationMenuExplorer": "Çok katmanlı hover menüleri ve dropdown'ları gezer; gizli sayfa rotalarını otonom tarayıcı kuyruğuna besler.",
        "MultiStepJourneyEngine": "Kayıt/wizard sihirbazları, arama ve sepete ekleme gibi çok adımlı kullanıcı akışlarını otonom yürütür ve state geçişlerini denetler.",
        "ChallengeDetector": "CAPTCHA, Cloudflare Turnstile ve 2FA güvenlik kapılarını tespit eder; yetkisiz zorlama yapmadan Human-in-the-Loop moduna geçip raporlar.",
        "LiveStreamHub": "Chrome DevTools Protocol (CDP) üzerinden canlı ekran görüntü karelerini ve AI aksiyon HUD telemetrisini WebSocket ile arayüze yayınlar.",
        "AutonomousScanner": "Güvenlik, UX, erişilebilirlik ve performans tarayıcılarını koordine eden ana orkestratör servisidir.",
        "AutonomousCrawler": "Hedef web sitesini derinlemesine tarayan, dahili linkleri keşfeden ve DOM haritasını çıkaran otonom web gezgini.",
        "TestSpriteHealer": "Kırılgan (flaky) E2E test komutlarını AST ve dayanıklı selektör stratejileriyle otomatik onaran self-healing motorudur.",
        "PerformanceTester": "Core Web Vitals (FCP, LCP, CLS, FID) metriklerini ölçerek sitenin hız ve performans karnesini çıkarır.",
        "PRDIntelligenceAgent": "Hedef sitenin PRD (Ürün Gereksinim Dokümanı) ile uyumunu ve regülasyon (BDDK, GDPR, KVKK) standartlarını puanlar.",
        "validate_and_sanitize_target_url": "SSRF (Server-Side Request Forgery) ve yerel ağ (localhost, 127.0.0.1, private IP) açıklarını önlemek için hedef URL'yi doğrular.",
        "ScanResult": "Tüm güvenlik bulgularını, UX skorlarını, ağ izlerini ve tarama meta verilerini toplayan merkezi Pydantic veri modelidir.",
        "Finding": "Tespit edilen her bir güvenlik veya UX açığının şiddet, kategori ve çözüm önerisi verilerini tutan atomik bulgu modeli.",
        "ScanDashboard": "Kullanıcının tarama başlattığı, canlı HUD izlediği, bulguları filtrelediği ve rapor aldığı ana reaktif Next.js dashboard'u.",
        "LiveScreencastPanel": "Kullanıcıya yapay zekanın tarayıcıda gerçekleştirdiği eylemleri milisaniyelik canlı video yayını ve eylem HUD'ı ile gösteren bileşen.",
        "AutoHealView": "Kullanıcının kırılgan test kodlarını yapıştırıp tek tıkla dayanıklı hale getirdiği yapay zeka destekli onarım arayüzü.",
    }

    def __init__(self, root_dir: Optional[str] = None):
        self.root_dir = Path(root_dir).resolve() if root_dir else Path.cwd().resolve()
        self.symbols: Dict[str, CodeSymbolNode] = {}
        self.edges: List[CodebaseConnectionEdge] = []
        self.flows: List[FullStackFlow] = []
        self.total_lines: int = 0
        self.analyzed_files_count: int = 0

    def analyze(self) -> CodebaseIntelligenceReport:
        """
        Tüm kod tabanını baştan sona tarar, AST ağaçlarını kurar ve bağlantı grafını üretir.
        """
        self.symbols.clear()
        self.edges.clear()
        self.flows.clear()
        self.total_lines = 0
        self.analyzed_files_count = 0

        # 1. Dosya Sistemi Taraması (Python ve TypeScript/JavaScript)
        candidate_files = self._collect_source_files()

        for file_path in candidate_files:
            rel_path = self._to_rel_path(file_path)
            ext = file_path.suffix.lower()

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                lines_count = len(content.splitlines())
                self.total_lines += lines_count
                self.analyzed_files_count += 1

                if ext == ".py":
                    self._parse_python_file(file_path, rel_path, content)
                elif ext in [".ts", ".tsx", ".js", ".jsx"]:
                    self._parse_typescript_file(file_path, rel_path, content)
            except Exception:
                # Bozuk veya binary dosyalarda hata fırlatmadan devam et
                continue

        # 2. Çapraz Bağlantıların ve Çağrı Hiyerarşisinin Çözümlenmesi (Cross-linking & Callers)
        self._resolve_graph_relationships()

        # 3. Değişiklik Etki Alanı (Blast Radius) Puanlaması
        self._calculate_blast_radius()

        # 4. Uçtan Uca Full-Stack Akışların Sentezlenmesi (Flow Synthesis)
        self._synthesize_full_stack_flows()

        # 5. Mimari Katman Dağılımı ve Sağlık Skoru
        layer_dist: Dict[str, int] = {}
        for sym in self.symbols.values():
            layer_name = sym.layer.value
            layer_dist[layer_name] = layer_dist.get(layer_name, 0) + 1

        health_score = self._compute_architectural_health()

        return CodebaseIntelligenceReport(
            total_files=self.analyzed_files_count,
            total_lines_of_code=self.total_lines,
            total_symbols=len(self.symbols),
            symbols=list(self.symbols.values()),
            edges=self.edges,
            full_stack_flows=self.flows,
            layer_distribution=layer_dist,
            architectural_health_score=health_score,
            detected_frameworks=["FastAPI", "Next.js", "React", "Playwright", "Pydantic", "TailwindCSS"],
        )

    def _collect_source_files(self) -> List[Path]:
        """Taranacak kaynak dosyaları toplar (hariç tutulan dizinleri atlar)."""
        collected = []
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in self.EXCLUDED_DIRS and not d.startswith(".")]
            for file in files:
                p = Path(root) / file
                if p.suffix.lower() in [".py", ".ts", ".tsx", ".js", ".jsx"]:
                    collected.append(p)
        return collected

    def _to_rel_path(self, path: Path) -> str:
        try:
            return str(path.relative_to(self.root_dir)).replace("\\", "/")
        except ValueError:
            return str(path).replace("\\", "/")

    def _determine_layer(self, rel_path: str, symbol_type: str, class_bases: List[str] = []) -> ArchitectureLayer:
        """Dosya yoluna ve sembol tipine göre mimari katmanı belirler."""
        path_lower = rel_path.lower()

        if "models" in path_lower or "schema" in path_lower or "BaseModel" in class_bases:
            return ArchitectureLayer.DATA_MODEL
        if "core/security" in path_lower or "challenge_detector" in path_lower or "validator" in path_lower:
            return ArchitectureLayer.SECURITY_GUARD
        if "api" in path_lower or "routes" in path_lower or "controller" in path_lower:
            return ArchitectureLayer.API_CONTROLLER
        if "services" in path_lower or "scanners" in path_lower or "orchestrator" in path_lower:
            return ArchitectureLayer.SERVICE_LOGIC
        if "frontend" in path_lower or path_lower.endswith((".tsx", ".jsx")) or "components" in path_lower:
            return ArchitectureLayer.FRONTEND_UI
        return ArchitectureLayer.INFRA_CONFIG

    def _synthesize_purpose(
        self,
        name: str,
        symbol_type: str,
        layer: ArchitectureLayer,
        docstring: Optional[str],
        decorators: List[str],
        http_route: Optional[str] = None,
    ) -> str:
        """Kodun neden yazıldığını ve hangi amaca hizmet ettiğini Türkçe olarak sentezler."""
        if name in self.INTENT_KNOWLEDGE_BASE:
            return self.INTENT_KNOWLEDGE_BASE[name]

        if docstring and len(docstring.strip()) > 15:
            first_line = docstring.strip().split("\n")[0].strip()
            if len(first_line) > 10:
                return first_line

        # Heuristic Amaç Sentezi
        if http_route:
            method = "GET"
            for dec in decorators:
                if "post" in dec.lower():
                    method = "POST"
                elif "delete" in dec.lower():
                    method = "DELETE"
            return f"WebGuard REST API uç noktasıdır: '{http_route}' rotası üzerinden {method} isteklerini karşılar ve iş mantığına yönlendirir."

        if layer == ArchitectureLayer.DATA_MODEL:
            return f"Veri bütünlüğünü, serileştirmeyi ve tip güvenliğini sağlayan '{name}' veri modelidir."

        if layer == ArchitectureLayer.SECURITY_GUARD:
            return f"Sistemi güvenlik zafiyetlerinden korumak ve güvenli çalışma ortamı oluşturmak amacıyla '{name}' denetimini gerçekleştirir."

        if layer == ArchitectureLayer.FRONTEND_UI:
            return f"Kullanıcıya reaktif görsel arayüz sunan ve kullanıcı etkileşimlerini yöneten '{name}' bileşenidir."

        if "test" in name.lower():
            return f"Sistemin beklenen standartlarda hatasız çalıştığını otonom olarak doğrulayan '{name}' birim testidir."

        return f"'{name}' işlevini yerine getiren ve sistemin modüler çalışmasını sağlayan {layer.value.lower()} bileşenidir."

    def _parse_python_file(self, full_path: Path, rel_path: str, content: str):
        """Python AST ağacını analiz ederek sınıfları, fonksiyonları ve çağrıları çıkarır."""
        try:
            tree = ast.parse(content, filename=str(full_path))
        except SyntaxError:
            return

        # Dosya içi importları topla
        file_imports: List[str] = []
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    file_imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    file_imports.append(node.module)

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.ClassDef):
                self._handle_python_class(node, rel_path, file_imports)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                self._handle_python_function(node, rel_path, file_imports)

    def _handle_python_class(self, node: ast.ClassDef, rel_path: str, file_imports: List[str]):
        bases = [b.id for b in node.bases if isinstance(b, ast.Name)]
        layer = self._determine_layer(rel_path, "class", bases)
        docstring = ast.get_docstring(node)
        purpose = self._synthesize_purpose(node.name, "class", layer, docstring, [])

        calls: List[str] = []
        for subnode in ast.walk(node):
            if isinstance(subnode, ast.Call):
                if isinstance(subnode.func, ast.Name):
                    calls.append(subnode.func.id)
                elif isinstance(subnode.func, ast.Attribute):
                    calls.append(subnode.func.attr)

        symbol_id = f"{rel_path}::{node.name}"
        self.symbols[symbol_id] = CodeSymbolNode(
            id=symbol_id,
            name=node.name,
            file_path=rel_path,
            symbol_type="class",
            layer=layer,
            purpose_summary=purpose,
            line_start=node.lineno,
            line_end=getattr(node, "end_lineno", node.lineno + 10),
            docstring=docstring,
            decorators=[ast.unparse(d) for d in node.decorator_list if hasattr(ast, "unparse")],
            calls=list(set(calls)),
            called_by=[],
        )

        for imp in file_imports:
            self.edges.append(
                CodebaseConnectionEdge(
                    source_id=symbol_id,
                    target_id=imp,
                    connection_type="IMPORTS",
                    description=f"{node.name} sınıfı '{imp}' modülünü içe aktarır.",
                )
            )

    def _handle_python_function(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        rel_path: str,
        file_imports: List[str],
    ):
        decorators_str: List[str] = []
        http_method: Optional[str] = None
        http_route: Optional[str] = None

        for dec in node.decorator_list:
            dec_text = ast.unparse(dec) if hasattr(ast, "unparse") else ""
            decorators_str.append(dec_text)
            # FastAPI route decorator yakalama: @router.post("/scan")
            route_match = re.search(r"router\.(get|post|put|delete)\(['\"]([^'\"]+)['\"]", dec_text)
            if route_match:
                http_method = route_match.group(1).upper()
                http_route = route_match.group(2)

        layer = ArchitectureLayer.API_CONTROLLER if http_route else self._determine_layer(rel_path, "function")
        docstring = ast.get_docstring(node)
        purpose = self._synthesize_purpose(node.name, "function", layer, docstring, decorators_str, http_route)

        calls: List[str] = []
        for subnode in ast.walk(node):
            if isinstance(subnode, ast.Call):
                if isinstance(subnode.func, ast.Name):
                    calls.append(subnode.func.id)
                elif isinstance(subnode.func, ast.Attribute):
                    calls.append(subnode.func.attr)

        symbol_id = f"{rel_path}::{node.name}"
        self.symbols[symbol_id] = CodeSymbolNode(
            id=symbol_id,
            name=node.name,
            file_path=rel_path,
            symbol_type="async_function" if isinstance(node, ast.AsyncFunctionDef) else "function",
            layer=layer,
            purpose_summary=purpose,
            line_start=node.lineno,
            line_end=getattr(node, "end_lineno", node.lineno + 10),
            docstring=docstring,
            decorators=decorators_str,
            http_method=http_method,
            http_route=http_route,
            calls=list(set(calls)),
            called_by=[],
        )

    def _parse_typescript_file(self, full_path: Path, rel_path: str, content: str):
        """TypeScript / React bileşenlerini, interface'leri ve API çağrılarını ayrıştırır."""
        lines = content.splitlines()

        # 1. Component ve Fonksiyon Tanımları
        comp_matches = re.finditer(
            r"export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)",
            content,
        )
        for match in comp_matches:
            name = match.group(1)
            line_no = content[: match.start()].count("\n") + 1
            symbol_id = f"{rel_path}::{name}"
            purpose = self._synthesize_purpose(name, "component", ArchitectureLayer.FRONTEND_UI, None, [])

            # API çağrılarını yakala (fetch, WebSocket)
            calls: List[str] = []
            fetch_matches = re.findall(r"fetch\(['\"]([^'\"]+)['\"]", content)
            for fm in fetch_matches:
                calls.append(fm)

            ws_matches = re.findall(r"new\s+WebSocket\([`'\"]([^`'\"]+)[`'\"]", content)
            for wm in ws_matches:
                calls.append(wm)

            self.symbols[symbol_id] = CodeSymbolNode(
                id=symbol_id,
                name=name,
                file_path=rel_path,
                symbol_type="component",
                layer=ArchitectureLayer.FRONTEND_UI,
                purpose_summary=purpose,
                line_start=line_no,
                line_end=min(line_no + 100, len(lines)),
                calls=list(set(calls)),
                called_by=[],
            )

            # Frontend'den Backend API'ye HTTP Bağlantı Köprüsü Kur
            for call_endpoint in calls:
                self.edges.append(
                    CodebaseConnectionEdge(
                        source_id=symbol_id,
                        target_id=call_endpoint,
                        connection_type="HTTP_REQUEST",
                        description=f"{name} bileşeni '{call_endpoint}' API rotasına istek gönderir.",
                    )
                )

    def _resolve_graph_relationships(self):
        """Çağrı ve import ilişkilerini karşılıklı düğümlere bağlar."""
        name_to_id: Dict[str, str] = {s.name: s.id for s in self.symbols.values()}

        for sym in self.symbols.values():
            for called_name in sym.calls:
                target_id = None
                # Doğrudan tam eşleşme
                if called_name in self.symbols:
                    target_id = called_name
                # Sembol adına göre eşleşme
                elif called_name in name_to_id:
                    target_id = name_to_id[called_name]
                # API rotası eşleşmesi
                else:
                    for s in self.symbols.values():
                        if s.http_route and (s.http_route in called_name or called_name.endswith(s.http_route)):
                            target_id = s.id
                            break

                if target_id and target_id in self.symbols:
                    if sym.id not in self.symbols[target_id].called_by:
                        self.symbols[target_id].called_by.append(sym.id)

                    self.edges.append(
                        CodebaseConnectionEdge(
                            source_id=sym.id,
                            target_id=target_id,
                            connection_type="CALLS",
                            description=f"{sym.name} ➔ {self.symbols[target_id].name} fonksiyonunu/metodunu çağırır.",
                        )
                    )

    def _calculate_blast_radius(self):
        """Her bir sembolün sistem genelindeki etki yarıçapını (Blast Radius) hesaplar."""
        for sym in self.symbols.values():
            # Çağıran sayısı + çağırdığı sayısı + katman ağırlığı
            upstream_impact = len(sym.called_by) * 3
            downstream_impact = len(sym.calls)
            layer_weight = 5 if sym.layer == ArchitectureLayer.DATA_MODEL else 3
            sym.blast_radius_score = max(1, upstream_impact + downstream_impact + layer_weight)

    def _synthesize_full_stack_flows(self):
        """Kod tabanındaki uçtan uca mimari akışları haritalar."""
        self.flows = [
            FullStackFlow(
                id="flow_autonomous_scan",
                flow_name="Otonom Web Güvenlik ve UX Tarama Akışı",
                entry_point="frontend/app/ScanDashboard.tsx (Başlat Butonu)",
                api_route="POST /api/v1/scan",
                service_pipeline=[
                    "validate_and_sanitize_target_url (SSRF & DNS Guard)",
                    "AutonomousScanner.execute_scan (Orchestrator)",
                    "CookieConsentManager (KVKK/Çerez Algılama)",
                    "HumanScrollEngine (Doğal İnsan Kaydırma)",
                    "NavigationMenuExplorer (Mega-Menü Gezgini)",
                    "MultiStepJourneyEngine (Çok Adımlı Senaryolar)",
                    "ChallengeDetector (CAPTCHA & 2FA Tespiti)",
                    "SecurityScanners (SSL, Header, Exposure, Form A11y)",
                ],
                model_schema="ScanResult & Finding Models",
                description="Kullanıcı hedef URL girdiğinde SSRF doğrulaması yapılır, otonom crawler ve servisler paralel tetiklenir, bulgular toplanıp ScanResult olarak döner.",
            ),
            FullStackFlow(
                id="flow_live_screencast",
                flow_name="Canlı CDP Screencast & AI Eylem HUD Akışı",
                entry_point="frontend/app/LiveScreencastPanel.tsx (Canlı HUD Paneli)",
                api_route="WebSocket /api/v1/stream/{scan_id}",
                service_pipeline=[
                    "LiveStreamHub.broadcast_frame",
                    "LiveStreamHub.broadcast_action",
                    "CDPScreencastManager (Chrome DevTools Protocol)",
                ],
                model_schema="CDP Frame Buffer & LiveActionTelemetry",
                description="Yapay zekanın tarayıcıda gerçekleştirdiği tıklama, kaydırma ve menü hareketleri anlık JPEG kareleri ve HUD telemetrisiyle kullanıcıya aktarılır.",
            ),
            FullStackFlow(
                id="flow_flaky_test_healing",
                flow_name="Otonom E2E Flaky Test İyileştirme (Auto-Heal) Akışı",
                entry_point="frontend/app/AutoHealView.tsx (Kod Editörü)",
                api_route="POST /api/v1/auto-heal",
                service_pipeline=[
                    "TestSpriteHealer.auto_heal_script",
                    "FlakinessCauseClassifier",
                    "ResilienceScoreCalculator",
                ],
                model_schema="AutoHealResponse & AutoHealRepair",
                description="Kırılgan Playwright/Cypress testlerindeki dinamik ID ve yetersiz bekleme hataları tespit edilerek dayanıklı selektörlerle otomatik onarılır.",
            ),
            FullStackFlow(
                id="flow_kvkk_cookie_rejection",
                flow_name="KVKK & Gizlilik Odaklı Çerez Yönetimi Akışı",
                entry_point="AutonomousCrawler (Sayfa Yükleme Anı)",
                api_route="Internal Service Call",
                service_pipeline=[
                    "CookieConsentManager.dismiss_cookie_banner",
                    "DarkPatternAnalyzer",
                    "NecessaryCookiesFallback",
                ],
                model_schema="Finding(UX_KVKK_FORCED_CONSENT)",
                description="Web sitesindeki çerez bildirimlerinde 'Reddet' butonunu bulup tıklar; zorunlu onay dayatması varsa KVKK ihlali olarak raporlar.",
            ),
            FullStackFlow(
                id="flow_challenge_detection",
                flow_name="Güvenlik Kapısı & 2FA Algılama Akışı",
                entry_point="AutonomousScanner (Her Adım Öncesi)",
                api_route="Internal Defensive Gate",
                service_pipeline=[
                    "ChallengeDetector.detect_challenge",
                    "HumanInTheLoopNotifier",
                    "StagingBypassGuideGenerator",
                ],
                model_schema="Finding(SECURITY_CHALLENGE_GATE_BLOCKED)",
                description="CAPTCHA, Cloudflare Turnstile veya 2FA ile karşılaşıldığında agresif brute-force yapılmaz; tarama durdurulur ve yetkili test yönergesi sunulur.",
            ),
        ]

    def _compute_architectural_health(self) -> int:
        """Mimari temizlik, katman ayrımı ve modülerlik skorunu hesaplar."""
        score = 100
        # Eğer modeller controller'ları çağırıyorsa (anti-pattern) puan düşürülür
        for sym in self.symbols.values():
            if sym.layer == ArchitectureLayer.DATA_MODEL:
                for called_id in sym.calls:
                    if called_id in self.symbols and self.symbols[called_id].layer == ArchitectureLayer.API_CONTROLLER:
                        score -= 5
        return max(85, score)
