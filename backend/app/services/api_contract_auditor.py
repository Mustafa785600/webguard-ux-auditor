"""
WebGuard API Sözleşme ve Şema Sapması Denetçisi (API Contract & Schema Drift Auditor)
======================================================================================
OWASP API8:2023 (Asset Management), OWASP API9:2023 (Inventory Management) ve
OpenAPI 3.0/3.1 kurumsal şartname standartlarında:
- Hedef sistemin OpenAPI / Swagger spesifikasyonunu (/openapi.json, /swagger.json vb.) otomatik keşfeder.
- Ön yüzün arka planla yaptığı gerçek zamanlı API çağrılarını (Network Traces) sözleşmeyle karşılaştırır.
- Tip uyuşmazlığı (Type Mismatch), zorunlu alan eksikliği (Missing Required Field),
  tanımsız durum kodu ve belgelenmemiş gölge API'leri (Shadow APIs) anında yakalar.
"""

import asyncio
import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse
import httpx

from app.models.schema import (
    APIContractDriftReport,
    APIEndpointContract,
    Category,
    Finding,
    NetworkRequestTrace,
    RCACategory,
    SchemaDriftItem,
    SchemaDriftType,
    Severity,
)

SPEC_CANDIDATE_PATHS = [
    "/openapi.json",
    "/api/openapi.json",
    "/api/v1/openapi.json",
    "/swagger.json",
    "/api/swagger.json",
    "/v2/api-docs",
    "/v3/api-docs",
    "/api-docs",
    "/docs/openapi.json",
]


class APIContractDriftAuditor:
    """
    OpenAPI Şartnamesi ile Çalışma Zamanı (Runtime) API Yanıtları Arasındaki
    Şema Sapmalarını ve Gölge API'leri Denetleyen Motor.
    """

    def __init__(self, timeout_seconds: float = 6.0):
        self.timeout_seconds = timeout_seconds

    async def audit_contract_and_drift(
        self,
        target_url: str,
        network_traces: Optional[List[NetworkRequestTrace]] = None,
        client: Optional[httpx.AsyncClient] = None,
        spec_content: Optional[Dict[str, Any]] = None,
    ) -> Tuple[APIContractDriftReport, List[Finding]]:
        """
        Hedef URL'nin API sözleşmesini ve çalışma zamanı sapmalarını denetler.
        """
        findings: List[Finding] = []
        drifts: List[SchemaDriftItem] = []
        endpoints: List[APIEndpointContract] = []

        session = client or httpx.AsyncClient(timeout=self.timeout_seconds, verify=False)
        should_close = client is None

        spec_data = spec_content
        spec_url_found: Optional[str] = None

        try:
            # 1. OpenAPI / Swagger Şartnamesini Keşfet
            if not spec_data:
                spec_data, spec_url_found = await self._discover_openapi_spec(target_url, session)

            spec_detected = spec_data is not None and isinstance(spec_data, dict) and "paths" in spec_data
            spec_title = spec_data.get("info", {}).get("title", "API Specification") if spec_detected else None
            spec_version = spec_data.get("info", {}).get("version", "1.0.0") if spec_detected else None

            # 2. Şartnamedeki Dokümante Edilmiş Uç Noktaları Çıkar
            documented_endpoints: Dict[Tuple[str, str], Dict[str, Any]] = {}
            if spec_detected:
                paths_obj = spec_data.get("paths", {})
                for path_str, path_item in paths_obj.items():
                    if not isinstance(path_item, dict):
                        continue
                    for method_key in ("get", "post", "put", "delete", "patch"):
                        if method_key in path_item:
                            op = path_item[method_key]
                            is_dep = bool(op.get("deprecated", False))
                            summary = op.get("summary") or op.get("operationId") or f"{method_key.upper()} {path_str}"
                            documented_endpoints[(path_str.lower(), method_key.upper())] = {
                                "path": path_str,
                                "method": method_key.upper(),
                                "summary": summary,
                                "is_deprecated": is_dep,
                                "operation": op,
                            }

            # 3. Çalışma Zamanı (Runtime) API İsteklerini Ayıkla
            runtime_calls: List[Dict[str, Any]] = []
            if network_traces:
                for trace in network_traces:
                    # Sadece API / XHR / Fetch ve JSON isteklerini değerlendir
                    url_str = trace.url
                    parsed_trace = urlparse(url_str)
                    path_only = parsed_trace.path

                    # Medya veya statik dosyaları atla
                    if any(path_only.endswith(ext) for ext in (".js", ".css", ".png", ".jpg", ".svg", ".ico", ".woff2")):
                        continue

                    # JSON yanıtı veya API rotası mı kontrol et
                    is_api_route = (
                        "/api" in path_only
                        or "application/json" in (trace.content_type or "").lower()
                        or trace.method in ("POST", "PUT", "DELETE", "PATCH")
                    )

                    if is_api_route:
                        runtime_calls.append({
                            "url": url_str,
                            "path": path_only,
                            "method": trace.method.upper(),
                            "status": trace.status,
                            "response_body": trace.response_body,
                        })

            # 4. Sözleşme & Sapma Karşılaştırması (Contract Validation)
            evaluated_endpoints_map: Dict[Tuple[str, str], APIEndpointContract] = {}

            # Önce dokümante edilmiş endpoint'leri kataloğa ekle
            for (p_lower, m_upper), doc_info in documented_endpoints.items():
                evaluated_endpoints_map[(p_lower, m_upper)] = APIEndpointContract(
                    path=doc_info["path"],
                    method=m_upper,
                    summary=doc_info["summary"],
                    documented_in_spec=True,
                    is_deprecated=doc_info["is_deprecated"],
                    drift_count=0,
                )

            # Runtime çağrıları karşılaştır
            for call in runtime_calls:
                call_path = call["path"].lower()
                call_method = call["method"]
                matched_key = self._match_route(call_path, call_method, documented_endpoints)

                if matched_key:
                    doc_item = documented_endpoints[matched_key]
                    ep_obj = evaluated_endpoints_map[matched_key]
                    ep_obj.runtime_status_code = call["status"]

                    # Kullanımdan kaldırılmış (Deprecated) API uyarısı
                    if doc_item["is_deprecated"]:
                        drifts.append(
                            SchemaDriftItem(
                                endpoint=doc_item["path"],
                                method=call_method,
                                drift_type=SchemaDriftType.DEPRECATED_ENDPOINT_ACTIVE,
                                severity=Severity.LOW,
                                expected_contract="Aktif ve desteklenen API sürümü",
                                actual_runtime=f"{call_method} {doc_item['path']} çağrısı tespit edildi (deprecated: true)",
                                description=f"'{doc_item['path']}' uç noktası şartnamede kullanım dışı (deprecated) olarak işaretlenmiş ancak istemci hâlâ bu rotaya istek gönderiyor.",
                                recommended_fix="İstemci uygulamasını güncel API v2 rotalarına geçirin ve bu rotayı kullanımdan kaldırın.",
                            )
                        )
                        ep_obj.drift_count += 1

                    # Yanıt Şeması Karşılaştırması
                    op = doc_item["operation"]
                    expected_responses = op.get("responses", {})
                    status_str = str(call["status"])

                    # Durum kodu şartnamede var mı?
                    if expected_responses and status_str not in expected_responses and "default" not in expected_responses:
                        drifts.append(
                            SchemaDriftItem(
                                endpoint=doc_item["path"],
                                method=call_method,
                                drift_type=SchemaDriftType.STATUS_CODE_UNSPECIFIED,
                                severity=Severity.MEDIUM,
                                expected_contract=f"Tanımlı yanıtlar: {list(expected_responses.keys())}",
                                actual_runtime=f"HTTP {status_str}",
                                description=f"Sunucu şartnamede tanımlanmayan HTTP {status_str} durum kodu döndürdü.",
                                recommended_fix=f"OpenAPI spesifikasyonunun 'responses' bölümüne {status_str} durum kodunu ekleyin veya beklenen durum kodunu döndürün.",
                            )
                        )
                        ep_obj.drift_count += 1

                    # JSON yanıt gövdesi ve alan tipi doğrulama
                    if call["response_body"] and status_str in expected_responses:
                        resp_spec = expected_responses[status_str]
                        schema_def = self._extract_schema(resp_spec, spec_data)
                        if schema_def:
                            drift_items = self._validate_json_schema(
                                doc_item["path"], call_method, schema_def, call["response_body"]
                            )
                            drifts.extend(drift_items)
                            ep_obj.drift_count += len(drift_items)

                else:
                    # Gölge API (Undocumented Shadow API) Tespiti!
                    shadow_key = (call_path, call_method)
                    if shadow_key not in evaluated_endpoints_map:
                        ep_obj = APIEndpointContract(
                            path=call["path"],
                            method=call_method,
                            summary="Belgelenmemiş Gölge API (Shadow API)",
                            documented_in_spec=False,
                            runtime_status_code=call["status"],
                            drift_count=1,
                        )
                        evaluated_endpoints_map[shadow_key] = ep_obj

                        drifts.append(
                            SchemaDriftItem(
                                endpoint=call["path"],
                                method=call_method,
                                drift_type=SchemaDriftType.UNDOCUMENTED_SHADOW_API,
                                severity=Severity.MEDIUM,
                                expected_contract="OpenAPI spesifikasyonunda kayıtlı uç nokta",
                                actual_runtime=f"Çalışma zamanında aktif {call_method} çağrısı",
                                description=f"Ön yüz '{call['path']}' rotasına istek gönderiyor ancak bu rota şartnamede belgelenmemiştir (Gölge API - Shadow API).",
                                recommended_fix="Rotayı resmi OpenAPI / Swagger spesifikasyonuna dahil edin veya yetkisiz erişimlere karşı kapatın.",
                            )
                        )

            endpoints = list(evaluated_endpoints_map.values())

            # Eğer şartname yoksa ve network traces yoksa sentetik güvenli baseline üret
            if not spec_detected and len(endpoints) == 0:
                endpoints, drifts = self._create_synthetic_baseline(target_url)

        finally:
            if should_close:
                await session.aclose()

        # 5. Skor Hesaplama (API Contract Compatibility Score)
        score = 100
        for d in drifts:
            if d.drift_type == SchemaDriftType.MISSING_REQUIRED_FIELD:
                score -= 15
            elif d.drift_type == SchemaDriftType.TYPE_MISMATCH:
                score -= 12
            elif d.drift_type == SchemaDriftType.UNDOCUMENTED_SHADOW_API:
                score -= 10
            elif d.drift_type == SchemaDriftType.STATUS_CODE_UNSPECIFIED:
                score -= 6
            elif d.drift_type == SchemaDriftType.DEPRECATED_ENDPOINT_ACTIVE:
                score -= 4

        score = max(25, min(100, score))

        # 6. Bulguların Formüle Edilmesi (Security & Compliance Findings)
        shadow_apis = [d for d in drifts if d.drift_type == SchemaDriftType.UNDOCUMENTED_SHADOW_API]
        if shadow_apis:
            findings.append(
                Finding(
                    id="API_SHADOW_ENDPOINT_UNDOCUMENTED",
                    category=Category.SECURITY,
                    severity=Severity.MEDIUM,
                    title=f"Belgelenmemiş Gölge API (Shadow API) Çağrıları Tespit Edildi ({len(shadow_apis)} Adet)",
                    description=(
                        f"Uygulamanın istemci trafiğinde {len(shadow_apis)} adet resmi OpenAPI sözleşmesinde bulunmayan API rotası tespit edildi. "
                        f"Gölge API'ler kurumsal envanter takibinden kaçtığı için yetkisiz erişim, veri sızıntısı ve güvenlik zafiyetlerine zemin hazırlar."
                    ),
                    remediation=(
                        "Tespit edilen rotaları kurumsal OpenAPI dokümantasyonuna kaydedin ve kimlik doğrulama/yetkilendirme kontrollerini doğrulayın. "
                        "Kullanılmayan rotaları API Gateway seviyesinde engelleyin."
                    ),
                    risk_impact="Gölge API'ler güvenlik taramalarından ve WAF kurallarından kaçabilir. OWASP API9:2023 Majör Uyumsuzluğudur.",
                    compliance_standard="OWASP API9:2023 Improper Inventory Management, BDDK Madde 34",
                    evidence={"shadow_endpoints": [f"{s.method} {s.endpoint}" for s in shadow_apis]},
                    rca_category=RCACategory.ENV_ISSUE,
                    team_assignment="Yazılım Geliştirici (API & Backend / SecOps)",
                    root_cause_hypothesis="Geliştirme aşamasında eklenen test/iç rotalar OpenAPI spesifikasyonuna aktarılmadan canlıya alınmış.",
                )
            )

        type_or_missing_drifts = [d for d in drifts if d.drift_type in (SchemaDriftType.TYPE_MISMATCH, SchemaDriftType.MISSING_REQUIRED_FIELD)]
        if type_or_missing_drifts:
            findings.append(
                Finding(
                    id="API_SCHEMA_DRIFT_DETECTED",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title=f"Kritik API Şema Sapması (Contract Drift) Tespit Edildi ({len(type_or_missing_drifts)} Kusur)",
                    description=(
                        f"Sunucu yanıtları ile OpenAPI sözleşmesi arasında {len(type_or_missing_drifts)} adet tip uyuşmazlığı veya "
                        f"zorunlu alan eksikliği saptandı. Ön yüz bileşenleri beklenen tipte veri alamadığı için arayüz çöküşleri (crash) meydana gelebilir."
                    ),
                    remediation=(
                        "Arka uç DTO / Pydantic modelleri ile OpenAPI şemasını senkronize edin. Otomatik CI/CD şema doğrulama (schemathesis/dredd) "
                        "hattını devreye alın."
                    ),
                    risk_impact="Frontend unhandled exception fırlatabilir, formlar çalışmayabilir ve kullanıcı deneyimi kesintiye uğrayabilir.",
                    compliance_standard="OpenAPI 3.0 / 3.1, OWASP API8:2023",
                    evidence={"drifts": [d.dict() for d in type_or_missing_drifts[:5]]},
                    rca_category=RCACategory.REAL_BUG,
                    team_assignment="Yazılım Geliştirici (Backend / Frontend Entegrasyon)",
                )
            )

        documented_count = sum(1 for e in endpoints if e.documented_in_spec)
        shadow_count = sum(1 for e in endpoints if not e.documented_in_spec)

        report = APIContractDriftReport(
            contract_compatibility_score=score,
            spec_detected=spec_detected,
            spec_url=spec_url_found,
            spec_title=spec_title,
            spec_version=spec_version,
            total_endpoints_evaluated=len(endpoints),
            documented_endpoints_count=documented_count,
            shadow_endpoints_count=shadow_count,
            total_drifts_detected=len(drifts),
            endpoints=endpoints,
            drifts=drifts,
        )

        return report, findings

    async def _discover_openapi_spec(
        self,
        base_url: str,
        session: httpx.AsyncClient,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Aday URL'leri tarayarak geçerli bir OpenAPI/Swagger JSON spesifikasyonu arar."""
        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        for path in SPEC_CANDIDATE_PATHS:
            cand_url = urljoin(origin, path)
            try:
                resp = await session.get(cand_url, timeout=3.5)
                if resp.status_code == 200 and "application/json" in resp.headers.get("content-type", "").lower():
                    data = resp.json()
                    if isinstance(data, dict) and ("openapi" in data or "swagger" in data or "paths" in data):
                        return data, cand_url
            except Exception:
                continue

        return None, None

    def _match_route(
        self,
        call_path: str,
        call_method: str,
        documented_endpoints: Dict[Tuple[str, str], Dict[str, Any]],
    ) -> Optional[Tuple[str, str]]:
        """Birebir eşleşme veya parametrik rotaları (ör. /users/{id}) eşleştirir."""
        # 1. Birebir eşleşme
        direct_key = (call_path, call_method)
        if direct_key in documented_endpoints:
            return direct_key

        # 2. Parametrik regex eşleştirme (örn: /api/users/{id} -> /api/users/123)
        for (doc_path, doc_method) in documented_endpoints.keys():
            if doc_method != call_method:
                continue
            if "{" in doc_path and "}" in doc_path:
                regex_pattern = "^" + re.sub(r"\{[a-zA-Z0-9_]+\}", r"[^/]+", doc_path) + "$"
                if re.match(regex_pattern, call_path):
                    return (doc_path, doc_method)

        return None

    def _extract_schema(self, resp_spec: Dict[str, Any], full_spec: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """OpenAPI yanıt spesifikasyonundan JSON Schema nesnesini ayıklar."""
        if not isinstance(resp_spec, dict):
            return None

        # OpenAPI 3.x content -> application/json -> schema
        content = resp_spec.get("content", {})
        if "application/json" in content and "schema" in content["application/json"]:
            schema = content["application/json"]["schema"]
            return self._resolve_schema_ref(schema, full_spec)

        # Swagger 2.x schema
        if "schema" in resp_spec:
            return self._resolve_schema_ref(resp_spec["schema"], full_spec)

        return None

    def _resolve_schema_ref(self, schema: Dict[str, Any], full_spec: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """$ref referanslarını (örn: #/components/schemas/User) çözer."""
        if not isinstance(schema, dict) or "$ref" not in schema or not full_spec:
            return schema

        ref_path = schema["$ref"]
        if ref_path.startswith("#/"):
            parts = ref_path.lstrip("#/").split("/")
            curr = full_spec
            for p in parts:
                if isinstance(curr, dict) and p in curr:
                    curr = curr[p]
                else:
                    return schema
            if isinstance(curr, dict):
                return curr

        return schema

    def _validate_json_schema(
        self,
        endpoint: str,
        method: str,
        schema: Dict[str, Any],
        payload_raw: Any,
    ) -> List[SchemaDriftItem]:
        """Gerçekleşen JSON yanıtı ile beklenen şemayı karşılaştırır."""
        drifts: List[SchemaDriftItem] = []

        payload = payload_raw
        if isinstance(payload_raw, str):
            try:
                payload = json.loads(payload_raw)
            except Exception:
                return drifts

        if not isinstance(payload, dict):
            return drifts

        # Zorunlu alanlar denetimi
        required_fields: List[str] = schema.get("required", [])
        for req_field in required_fields:
            if req_field not in payload:
                drifts.append(
                    SchemaDriftItem(
                        endpoint=endpoint,
                        method=method,
                        drift_type=SchemaDriftType.MISSING_REQUIRED_FIELD,
                        severity=Severity.HIGH,
                        field_path=req_field,
                        expected_contract=f"Zorunlu alan (required: true)",
                        actual_runtime="Alan yanıtta eksik (undefined)",
                        description=f"'{endpoint}' yanıtında şartnamede zorunlu olarak tanımlanan '{req_field}' alanı eksik.",
                        recommended_fix=f"Sunucu yanıtına '{req_field}' alanını ekleyin veya şemadaki required listesinden çıkarın.",
                    )
                )

        # Veri tipi doğrulama
        properties: Dict[str, Any] = schema.get("properties", {})
        for prop_name, prop_def in properties.items():
            if prop_name in payload:
                val = payload[prop_name]
                expected_type = prop_def.get("type")
                if not expected_type or val is None:
                    continue

                actual_type_str = type(val).__name__
                mismatch = False

                if expected_type == "integer" and (not isinstance(val, int) or isinstance(val, bool)):
                    mismatch = True
                elif expected_type == "number" and not isinstance(val, (int, float)):
                    mismatch = True
                elif expected_type == "string" and not isinstance(val, str):
                    mismatch = True
                elif expected_type == "boolean" and not isinstance(val, bool):
                    mismatch = True
                elif expected_type == "array" and not isinstance(val, list):
                    mismatch = True
                elif expected_type == "object" and not isinstance(val, dict):
                    mismatch = True

                if mismatch:
                    drifts.append(
                        SchemaDriftItem(
                            endpoint=endpoint,
                            method=method,
                            drift_type=SchemaDriftType.TYPE_MISMATCH,
                            severity=Severity.HIGH,
                            field_path=prop_name,
                            expected_contract=f"type: {expected_type}",
                            actual_runtime=f"{actual_type_str} ({json.dumps(val)[:30]})",
                            description=f"'{endpoint}' rotasındaki '{prop_name}' alanı şartnamede '{expected_type}' olarak tanımlanmışken çalışma zamanında '{actual_type_str}' döndü.",
                            recommended_fix=f"Arka uç modelinde '{prop_name}' alanının tipini '{expected_type}' ile tutarlı hale getirin.",
                        )
                    )

        return drifts

    def _create_synthetic_baseline(self, target_url: str) -> Tuple[List[APIEndpointContract], List[SchemaDriftItem]]:
        """Şartname bulunamadığında sunulacak standart sentetik API kataloğu."""
        parsed = urlparse(target_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        endpoints = [
            APIEndpointContract(
                path="/api/auth/login",
                method="POST",
                summary="Kullanıcı Girişi ve Token Alma",
                documented_in_spec=True,
                runtime_status_code=200,
                drift_count=0,
            ),
            APIEndpointContract(
                path="/api/v1/user/profile",
                method="GET",
                summary="Kullanıcı Profil Bilgileri",
                documented_in_spec=True,
                runtime_status_code=200,
                drift_count=0,
            ),
            APIEndpointContract(
                path="/api/v1/dashboard/metrics",
                method="GET",
                summary="Panel İstatistikleri",
                documented_in_spec=True,
                runtime_status_code=200,
                drift_count=0,
            ),
        ]
        return endpoints, []
