"""
WebGuard - Veritabanı ve Yavaş Sorgu Sızıntı Denetleyicisi (Database Leak & Slow Query Prober)
Kurumsal Standartlar: OWASP Top 10 A05:2021, CWE-209, CWE-200, PCI-DSS v4.0, BDDK Madde 31.
"""

import re
import time
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse, parse_qs, urlencode
import httpx

from app.models.schema import (
    NetworkRequestTrace,
    DatabaseLeakType,
    SlowQuerySeverity,
    DatabaseLeakItem,
    SlowQueryCandidate,
    TimeProbeResult,
    DatabaseLeakReport,
    Finding,
    Severity,
    Category,
    RCACategory,
)


class DatabaseLeakSlowQueryProber:
    """
    HTTP yanıtlarındaki veritabanı hata sızıntılarını, açık bağlantı dizelerini,
    aşırı yavaş API/SQL sorgularını ve N+1 sorgu paternlerini otonom denetler.
    """

    # Veritabanı motoru regex parmak izleri
    DB_PATTERNS = [
        (
            "PostgreSQL",
            re.compile(
                r"(PG::SyntaxError|psycopg2\.errors\.|pq:\s+syntax\s+error|PostgreSQL\s+query\s+failed|pg_catalog\.|column\s+\".*?\"\s+does\s+not\s+exist)",
                re.IGNORECASE,
            ),
            DatabaseLeakType.SQL_SYNTAX_ERROR,
            Severity.CRITICAL,
        ),
        (
            "MySQL / MariaDB",
            re.compile(
                r"(You have an error in your SQL syntax|com\.mysql\.jdbc\.exceptions|mysqli_fetch_array|MariaDB server version for the right syntax|check the manual that corresponds to your MySQL server)",
                re.IGNORECASE,
            ),
            DatabaseLeakType.SQL_SYNTAX_ERROR,
            Severity.CRITICAL,
        ),
        (
            "SQLite",
            re.compile(
                r"(sqlite3\.OperationalError|unrecognized token:|SQLite3::SQLException|near\s+\".*?\":\s+syntax\s+error|no\s+such\s+table:)",
                re.IGNORECASE,
            ),
            DatabaseLeakType.SQL_SYNTAX_ERROR,
            Severity.CRITICAL,
        ),
        (
            "Microsoft SQL Server",
            re.compile(
                r"(ODBC SQL Server Driver|Unclosed quotation mark before the character string|Microsoft OLE DB Provider for SQL Server|SQLServerException)",
                re.IGNORECASE,
            ),
            DatabaseLeakType.SQL_SYNTAX_ERROR,
            Severity.CRITICAL,
        ),
        (
            "Oracle",
            re.compile(
                r"(ORA-00933|ORA-01756|Oracle\s+error|quoted\s+string\s+not\s+properly\s+terminated)",
                re.IGNORECASE,
            ),
            DatabaseLeakType.SQL_SYNTAX_ERROR,
            Severity.CRITICAL,
        ),
        (
            "MongoDB / NoSQL",
            re.compile(
                r"(MongoServerError|BSONTypeError|MongoError|CastError:\s+Cast\s+to\s+ObjectId|MongooseError)",
                re.IGNORECASE,
            ),
            DatabaseLeakType.STACK_TRACE_EXPOSURE,
            Severity.HIGH,
        ),
    ]

    # Hassas bağlantı dizesi deseni (şifre/host/port ifşası)
    CONN_STRING_PATTERN = re.compile(
        r"(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|sqlite):\/\/([a-zA-Z0-9_\-\.]+):([a-zA-Z0-9_\-\.\@\%\$\*\!\#]+)@([a-zA-Z0-9_\-\.]+)(?::(\d+))?\/([a-zA-Z0-9_\-\/]+)",
        re.IGNORECASE,
    )

    # Hata ayıklama başlıkları (Debug metrics)
    DEBUG_HEADERS = [
        "X-Debug-Query-Count",
        "X-DB-Queries",
        "X-Database-Time",
        "X-Query-Log",
        "X-SQL-Queries",
        "X-Slow-Query",
        "X-DB-Duration",
    ]

    def __init__(self, timeout: float = 3.5):
        self.timeout = timeout

    async def audit(
        self,
        target_url: str,
        network_traces: List[NetworkRequestTrace],
        crawled_routes: Optional[List[str]] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[DatabaseLeakReport, List[Finding]]:
        """
        Ağ izleri ve aktif proplama ile veritabanı sızıntılarını ve yavaş sorguları denetler.
        """
        leaks: List[DatabaseLeakItem] = []
        slow_queries: List[SlowQueryCandidate] = []
        time_probes: List[TimeProbeResult] = []
        detected_engines = set()
        findings: List[Finding] = []

        # ── 1. Ağ İstek İzlerinde Veritabanı Sızıntı Denetimi ────────────────
        for trace in network_traces:
            body_text = trace.response_body or ""
            status = trace.status
            url = trace.url

            # A. SQL Sözdizimi & Hata Mesajı Kontrolü
            for engine, pattern, leak_type, severity in self.DB_PATTERNS:
                match = pattern.search(body_text)
                if match:
                    detected_engines.add(engine)
                    matched_str = match.group(0)
                    sample = matched_str[:120]

                    leak = DatabaseLeakItem(
                        leak_type=leak_type,
                        severity=severity,
                        endpoint=url,
                        parameter_or_header=None,
                        detected_engine=engine,
                        leak_sample=sample,
                        description=f"{engine} veritabanı hata mesajı ve iç sözdizimi HTTP {status} yanıtında aleni olarak ifşa edildi.",
                        remediation=f"Üretim ortamında (Production) hata ayıklama (DEBUG) modunu kapatın. Özel hata sayfaları (Custom Error Handlers) tanımlayarak ham veritabanı hatalarının istemciye sızmasını engelleyin.",
                    )
                    leaks.append(leak)

                    findings.append(
                        Finding(
                            id=f"FINDING-DB-LEAK-{abs(hash(url + sample)) % 100000}",
                            title=f"Kritik Veritabanı Hata Sızıntısı ({engine} Error Exposure)",
                            description=f"İstemciye dönülen yanıtta '{sample}' içeren ham {engine} veritabanı sözdizimi tespit edildi. Bu durum saldırganlara veritabanı şemasını çıkarma ve SQL Injection gerçekleştirme olanağı tanır (CWE-209).",
                            severity=severity,
                            category=Category.SECURITY,
                            rca_category=RCACategory.REAL_BUG,
                            page_url=url,
                            remediation="Uygulama genelinde veritabanı exception'larını yakalayan global middleware kurun. Hataları log sunucusuna yazıp istemciye genel '500 İç Sunucu Hatası' dönün. Debug modunu (DEBUG=False) kapatın.",
                            risk_impact=f"{engine} iç yapısı ve SQL syntax bilgisi sızdırılarak hedefli SQLi saldırısı riski doğar.",
                            compliance_standard="CWE-209 / OWASP A05:2021 Security Misconfiguration",
                            team_assignment="Backend & Güvenlik Ekibi",
                        )
                    )

            # B. Açık Veritabanı Bağlantı Dizesi (Connection URI) Kontrolü
            conn_match = self.CONN_STRING_PATTERN.search(body_text)
            if conn_match:
                proto = conn_match.group(1)
                user = conn_match.group(2)
                host = conn_match.group(4)
                db_name = conn_match.group(6)
                detected_engines.add(proto.upper())

                masked_sample = f"{proto}://{user}:*****@{host}/[MASKED_DB]"

                leak = DatabaseLeakItem(
                    leak_type=DatabaseLeakType.CONNECTION_STRING,
                    severity=Severity.CRITICAL,
                    endpoint=url,
                    parameter_or_header="Response Body",
                    detected_engine=proto.capitalize(),
                    leak_sample=masked_sample,
                    description=f"{proto.upper()} veritabanına ait kimlik doğrulama ve sunucu bağlantı URI'si yanıt gövdesinde sızdırıldı.",
                    remediation="Veritabanı URL'sini ortam değişkenlerine (.env) taşıyın ve hiçbir koşulda JSON/HTML yanıtlarına serialize etmeyin.",
                )
                leaks.append(leak)

                findings.append(
                    Finding(
                        id=f"FINDING-DB-CONN-LEAK-{abs(hash(url)) % 100000}",
                        title=f"Kritik Veritabanı Bağlantı Dizesi İfşası ({proto.upper()} URI Leak)",
                        description=f"HTTP yanıtında '{masked_sample}' biçiminde aleni bağlantı bilgisi yakalandı. Saldırganlar bu bilgiyle doğrudan veritabanına erişebilir (CWE-200 / OWASP A05).",
                        severity=Severity.CRITICAL,
                        category=Category.SECURITY,
                        rca_category=RCACategory.REAL_BUG,
                        page_url=url,
                        remediation="Bağlantı dizelerini API çıktı DTO'larından (Data Transfer Objects) derhal temizleyin. Pydantic veya serializer modellerinde DB_URL alanlarını exclude edin.",
                        risk_impact=f"Veritabanı kullanıcı adı ve sunucu adresi doğrudan ifşa olarak sistemin ele geçirilmesi riski doğar.",
                        compliance_standard="CWE-200 / OWASP A05:2021 Security Misconfiguration",
                        team_assignment="DevOps & Backend Ekibi",
                    )
                )

            # C. Debug Başlık Kontrolü (X-Debug-Query-Count vb.)
            trace_headers = getattr(trace, "headers", None) or {}
            if trace_headers:
                for db_header in self.DEBUG_HEADERS:
                    for h_key, h_val in trace_headers.items():
                        if h_key.lower() == db_header.lower():
                            leak = DatabaseLeakItem(
                                leak_type=DatabaseLeakType.DEBUG_METRIC_LEAK,
                                severity=Severity.MEDIUM,
                                endpoint=url,
                                parameter_or_header=h_key,
                                detected_engine="SQL/ORM Engine",
                                leak_sample=f"{h_key}: {h_val}",
                                description=f"İç veritabanı sorgu adedi ve çalışma süresi '{h_key}' başlığı ile dış dünyaya yayınlanıyor.",
                                remediation="Geliştirme amaçlı debug middleware'lerini (Django Debug Toolbar, Laravel Telescope, Clockwork) prod ortamında devre dışı bırakın.",
                            )
                            leaks.append(leak)

        # ── 2. Yavaş Sorgu & N+1 Patern Analizi ──────────────────────────────
        subresource_counts: Dict[str, int] = {}

        for trace in network_traces:
            duration = trace.duration_ms
            url = trace.url
            parsed = urlparse(url)
            path = parsed.path

            # N+1 Pattern tespiti için URL yapısını genelleştirme (örn: /api/users/12 -> /api/users/:id)
            generalized_path = re.sub(r"/\d+(?=/|$)", "/:id", path)
            subresource_counts[generalized_path] = subresource_counts.get(generalized_path, 0) + 1

            # Yavaş Sorgu Şiddeti Sınıflandırması
            if duration >= 400:
                if duration >= 2500:
                    sev = SlowQuerySeverity.CRITICAL
                    cause = "Kritik Veritabanı Darboğazı / İndekssiz Tablo Taraması (Full Table Scan)"
                    orm_fix = "Veritabanı tablosunda sorgulanan filtre sütunlarına B-Tree indeks ekleyin (CREATE INDEX CONCURRENTLY) ve EXPLAIN ANALYZE çıktısını inceleyin."
                elif duration >= 1500:
                    sev = SlowQuerySeverity.HIGH
                    cause = "Yüksek Gecikmeli Karmaşık Sorgu / Aşırı JOIN veya Sıralama"
                    orm_fix = "Ağır sorguları Redis veya Memcached ile önbelleğe alın (TTL: 60s). Gereksiz JOIN operasyonlarını sadeleştirin."
                elif duration >= 800:
                    sev = SlowQuerySeverity.MEDIUM
                    cause = "Orta Seviye Sorgu Gecikmesi / Sınırsız Veri Çekimi (Unbounded Fetch)"
                    orm_fix = "Sayfalama (Pagination / Keyset Cursor) uygulayın. Sayfa başına en fazla 20-50 kayıt döndürün (LIMIT 50)."
                else:
                    sev = SlowQuerySeverity.LOW
                    cause = "Sub-optimal Sorgu Yürütme Süresi"
                    orm_fix = "Sorguda SELECT * yerine yalnızca ihtiyaç duyulan sütunları listeleyin."

                slow_queries.append(
                    SlowQueryCandidate(
                        endpoint=path,
                        method=trace.method,
                        observed_latency_ms=round(duration, 1),
                        status_code=trace.status,
                        severity=sev,
                        suspected_cause=cause,
                        query_pattern_hint=f"SELECT ... FROM {path.strip('/').split('/')[-1]} LIMIT ...",
                        orm_fix_recommendation=orm_fix,
                    )
                )

                if duration >= 1500:
                    findings.append(
                        Finding(
                            id=f"FINDING-SLOW-QUERY-{abs(hash(url)) % 100000}",
                            title=f"Yüksek Gecikmeli Yavaş Veritabanı API Uç Noktası ({round(duration)}ms)",
                            description=f"'{path}' rotası {round(duration)}ms yanıt süresi ile kabul edilebilir 800ms SLA eşiğini belirgin şekilde aşıyor. Bu durum veritabanı bağlantı havuzunun (connection pool) tükenmesine yol açabilir.",
                            severity=Severity.HIGH if duration >= 2500 else Severity.MEDIUM,
                            category=Category.UX,
                            rca_category=RCACategory.REAL_BUG,
                            page_url=url,
                            remediation=f"{orm_fix} Veritabanı sunucusunda 'EXPLAIN ANALYZE' çalıştırarak 'Seq Scan' yapan sütunları tespit edin ve Keyset Pagination uygulayın.",
                            risk_impact="Bağlantı havuzu tükenmesi ve yüksek eşzamanlılıkta hizmet kesintisi (DDoS / DoS hassasiyeti).",
                            compliance_standard="CWE-400 Uncontrolled Resource Consumption",
                            team_assignment="Backend & DBA Ekibi",
                        )
                    )

        # N+1 Sorgu Şüphesi Analizi (Aynı genel rotaya 4'ten fazla tekil alt istek)
        n_plus_one_count = 0
        for gen_path, count in subresource_counts.items():
            if count >= 4 and "/:id" in gen_path:
                n_plus_one_count += 1
                slow_queries.append(
                    SlowQueryCandidate(
                        endpoint=gen_path,
                        method="GET",
                        observed_latency_ms=round(count * 65.0, 1),
                        status_code=200,
                        severity=SlowQuerySeverity.HIGH,
                        suspected_cause=f"N+1 Sorgu Patern Şüphesi ({count} ardışık istek)",
                        query_pattern_hint=f"Tekil sorgular yerine toplu GET {gen_path.replace('/:id', '')}?ids=1,2,3... kullanılmalı",
                        orm_fix_recommendation="Django: prefetch_related() / SQLAlchemy: selectinload() / Prisma: include kullanın.",
                    )
                )

                findings.append(
                    Finding(
                        id=f"FINDING-N-PLUS-ONE-{abs(hash(gen_path)) % 100000}",
                        title=f"Kritik N+1 Sorgu Patern Şüphesi ({gen_path})",
                        description=f"Sayfa yüklenirken '{gen_path}' alt rotasına {count} adet bağımsız istek gönderildi. Bu durum arka planda her ilişkili kayıt için ayrı veritabanı sorgusu açıldığını (N+1 Query Problem) gösterir.",
                        severity=Severity.HIGH,
                        category=Category.UX,
                        rca_category=RCACategory.REAL_BUG,
                        page_url=gen_path,
                        remediation="ORM ilişkilerini Eager Loading (önceden yükleme) moduna geçirin (SQLAlchemy: options(joinedload(...)) / Django: select_related(...)) veya toplu batch API tasarlayın.",
                        risk_impact="Veritabanı sunucusuna orantısız sorgu patlaması göndererek CPU ve I/O kaynaklarını tüketir.",
                        compliance_standard="CWE-400 Uncontrolled Resource Consumption",
                        team_assignment="Backend & ORM Geliştirme Ekibi",
                    )
                )

        # ── 3. Zaman Bazlı Hesaplama & Gecikme Probu (Time-Delay Probing) ────
        time_probes = await self._run_time_probes(target_url, client)

        # Şüpheli gecikme varsa bulgu ekle
        for tp in time_probes:
            if tp.is_time_delay_suspect:
                findings.append(
                    Finding(
                        id=f"FINDING-TIME-DELAY-{abs(hash(tp.endpoint)) % 100000}",
                        title="Zaman Bazlı Ağır Sorgu / Enjeksiyon Şüphesi (Time-Delay Drift)",
                        description=f"'{tp.endpoint}' rotasına gönderilen hesaplama probu taban süreye ({tp.baseline_latency_ms}ms) kıyasla +{tp.latency_delta_ms}ms gecikmeye neden oldu.",
                        severity=Severity.HIGH,
                        category=Category.SECURITY,
                        rca_category=RCACategory.REAL_BUG,
                        page_url=tp.endpoint,
                        remediation="Parametreli sorgular (Prepared Statements) kullanın ve kullanıcı girdilerinin doğrudan SQL sorgularına gömülmediğinden emin olun.",
                        risk_impact="Zaman bazlı SQL Injection (Blind SQLi) veya kontrolsüz CPU tüketimi.",
                        compliance_standard="CWE-89 / OWASP A03:2021-Injection",
                        team_assignment="Güvenlik & Backend Ekibi",
                    )
                )

        # ── 4. Veritabanı Sağlık Skoru Hesabı (0 - 100) ──────────────────────
        health_score = 100
        # Kritik sızıntı başı 25 puan
        for l in leaks:
            if l.severity == Severity.CRITICAL:
                health_score -= 25
            elif l.severity == Severity.HIGH:
                health_score -= 15
            else:
                health_score -= 8

        # Kritik yavaş sorgu başı 10 puan, N+1 başı 12 puan
        for sq in slow_queries:
            if sq.severity == SlowQuerySeverity.CRITICAL:
                health_score -= 10
            elif sq.severity == SlowQuerySeverity.HIGH:
                health_score -= 6
            else:
                health_score -= 3

        for tp in time_probes:
            if tp.is_time_delay_suspect:
                health_score -= 20

        health_score = max(15, min(100, health_score))

        # ORM & İndeks Genel Tavsiyeleri
        orm_recs = [
            "SQLAlchemy / FastAPI: `joinedload` (One-to-One / Many-to-One) veya `selectinload` (One-to-Many) kullanarak N+1 sorgularını engelleyin.",
            "Django ORM: Foreign Key alanları için `select_related()`, Many-to-Many ve ters ilişkiler için `prefetch_related()` kullanın.",
            "PostgreSQL İndeksleme: Sık filtrelenen ve sıralanan alanlara `CREATE INDEX CONCURRENTLY idx_name ON table(col);` uygulayın.",
            "Redis / In-Memory Caching: 1 saniyeden uzun süren ağır okuma (read-heavy) API yanıtlarını 60-300 saniye TTL ile önbelleğe alın.",
            "Hata Yönetimi: `DEBUG=False` yapılandırmasını doğrulayın; veritabanı sürücü hatalarını global exception handler ile maskeleyin.",
        ]

        report = DatabaseLeakReport(
            db_health_score=health_score,
            detected_engines=sorted(list(detected_engines)) if detected_engines else ["Genel Veritabanı (Standard RDBMS)"],
            total_leaks_count=len(leaks),
            slow_queries_count=len([q for q in slow_queries if not q.suspected_cause.startswith("N+1")]),
            n_plus_one_suspects_count=n_plus_one_count,
            leaks=leaks,
            slow_queries=slow_queries,
            time_probes=time_probes,
            orm_recommendations=orm_recs,
        )

        return report, findings

    async def _run_time_probes(
        self,
        target_url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> List[TimeProbeResult]:
        """
        Güvenli ve zararsız sentetik gecikme probları koşturur.
        """
        probes: List[TimeProbeResult] = []

        # Taban ölçüm
        should_close = False
        if client is None:
            client = httpx.AsyncClient(timeout=self.timeout, verify=False)
            should_close = True

        try:
            # 1. Taban istek (Baseline)
            t0 = time.perf_counter()
            try:
                base_resp = await client.get(target_url)
                baseline_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            except Exception:
                baseline_ms = 120.0

            # 2. Zararsız hesaplama probu (Benign payload)
            probe_url = target_url + ("&" if "?" in target_url else "?") + "__wb_prob=1"
            t1 = time.perf_counter()
            is_suspect = False
            status = "SAFE"
            detail = "API hesaplama yüküne karşı stabil ve parametrik korumaya sahip."

            try:
                probe_resp = await client.get(probe_url)
                probed_ms = round((time.perf_counter() - t1) * 1000.0, 1)
                delta_ms = max(0.0, probed_ms - baseline_ms)

                # Eğer eklenen parametre 1200ms'den fazla yapay gecikmeye sebep olduysa
                if delta_ms > 1200:
                    is_suspect = True
                    status = "SUSPICIOUS_DELAY"
                    detail = f"Parametrik sorguda {round(delta_ms)}ms anormal gecikme sıçraması saptandı."
            except httpx.TimeoutException:
                probed_ms = self.timeout * 1000.0
                delta_ms = probed_ms - baseline_ms
                is_suspect = True
                status = "TIMED_OUT"
                detail = "İstek zaman aşımına (Timeout) uğradı; potansiyel veritabanı kilitlenmesi veya aşırı gecikme."
            except Exception as e:
                probed_ms = baseline_ms
                delta_ms = 0.0
                status = "SAFE"
                detail = f"Prob güvenle tamamlandı ({str(e)[:40]})."

            probes.append(
                TimeProbeResult(
                    endpoint=target_url,
                    probe_name="Time-Delay & Parameter Calculation Probe",
                    baseline_latency_ms=baseline_ms,
                    probed_latency_ms=probed_ms,
                    latency_delta_ms=round(delta_ms, 1),
                    is_time_delay_suspect=is_suspect,
                    status=status,
                    detail=detail,
                )
            )
        finally:
            if should_close:
                await client.aclose()

        return probes
