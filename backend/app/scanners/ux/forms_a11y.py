from typing import List
from bs4 import BeautifulSoup
import httpx
from app.models.schema import Finding, Category, Severity
from app.scanners.base import BaseScanner

class FormsA11yScanner(BaseScanner):
    async def scan(self, target_url: str, client: httpx.AsyncClient) -> List[Finding]:
        findings: List[Finding] = []
        try:
            response = await client.get(target_url, timeout=10.0)
        except Exception:
            return findings

        soup = BeautifulSoup(response.text, "html.parser")
        forms = soup.find_all("form")

        if not forms:
            return findings

        findings.extend(self._check_form_security(forms))
        findings.extend(self._check_input_labels(soup, forms))
        findings.extend(self._check_button_accessibility(forms))
        findings.extend(self._check_autocomplete(forms))
        findings.extend(self._check_form_method(forms))

        return findings

    def _check_form_security(self, forms) -> List[Finding]:
        forms_without_action = [f for f in forms if not f.get("action")]
        if not forms_without_action:
            return []
        sample_form = forms_without_action[0] if forms_without_action else None
        return [
            Finding(
                id="UX_FORM_MISSING_ACTION",
                category=Category.UX,
                severity=Severity.MEDIUM,
                title=f"{len(forms_without_action)} Form(s) Missing 'action' Attribute",
                description="Forms without an 'action' attribute submit to the current URL by default, which may cause unexpected behavior and confuse users.",
                remediation="Define explicit 'action' attributes on all <form> elements to ensure predictable submission routing.",
                evidence={"count": len(forms_without_action)},
                risk_impact="Without an explicit action attribute, the form submits to the current URL with query parameters by default. This can cause duplicate submissions, state confusion, or accidental data loss.",
                code_example="<form action=\"/api/auth/login\" method=\"POST\">\n  <input type=\"text\" name=\"username\" />\n  <button type=\"submit\">Submit</button>\n</form>",
                target_location="Page Template (HTML / <form>)",
                line_number=getattr(sample_form, "sourceline", None) if sample_form else None,
                problematic_code=str(sample_form)[:160] if sample_form else None
            )
        ]

    def _check_input_labels(self, soup, forms) -> List[Finding]:
        findings: List[Finding] = []
        unlabeled_inputs = []

        all_label_fors = {label.get("for") for label in soup.find_all("label") if label.get("for")}

        for form in forms:
            for inp in form.find_all("input", type=lambda t: t not in ("hidden", "submit", "button", "reset", "image")):
                inp_id = inp.get("id")
                has_label = (inp_id and inp_id in all_label_fors) or inp.get("aria-label") or inp.get("aria-labelledby")
                if not has_label:
                    unlabeled_inputs.append(inp)

        if unlabeled_inputs:
            first_unlabeled = unlabeled_inputs[0]
            findings.append(
                Finding(
                    id="UX_FORM_UNLABELED_INPUTS",
                    category=Category.UX,
                    severity=Severity.HIGH,
                    title=f"{len(unlabeled_inputs)} Form Input(s) Lack Accessible Labels",
                    description="Form inputs without associated <label> elements or aria-label attributes prevent screen readers and assistive technologies from conveying field purpose.",
                    remediation="Associate every input with a <label for='inputId'>, or use aria-label/aria-labelledby attributes.",
                    evidence={"unlabeled_count": len(unlabeled_inputs)},
                    risk_impact="Screen reader and assistive technology users cannot determine the input purpose (violating WCAG 2.1 Success Criterion 1.3.1). Browser autofill and password managers also fail to detect the field.",
                    code_example="<label for=\"user-email\">Email Address</label>\n<input type=\"email\" id=\"user-email\" name=\"email\" required />",
                    target_location="Page Template (HTML / <input>)",
                    line_number=getattr(first_unlabeled, "sourceline", None),
                    problematic_code=str(first_unlabeled)[:160]
                )
            )

        return findings

    def _check_button_accessibility(self, forms) -> List[Finding]:
        findings: List[Finding] = []
        empty_buttons = []

        for form in forms:
            for btn in form.find_all("button"):
                has_text = bool(btn.get_text(strip=True))
                has_aria = bool(btn.get("aria-label") or btn.get("aria-labelledby"))
                has_title = bool(btn.get("title"))
                if not (has_text or has_aria or has_title):
                    empty_buttons.append(btn)

        if empty_buttons:
            first_btn = empty_buttons[0]
            findings.append(
                Finding(
                    id="UX_FORM_EMPTY_BUTTONS",
                    category=Category.UX,
                    severity=Severity.MEDIUM,
                    title=f"{len(empty_buttons)} Button(s) Have No Accessible Label",
                    description="Buttons without text content, aria-label, or title attributes are inaccessible to screen reader users and fail WCAG 2.1 Success Criterion 4.1.2.",
                    remediation="Add descriptive text content or an aria-label attribute to all interactive buttons.",
                    evidence={"samples": [str(b)[:80] for b in empty_buttons[:3]]},
                    risk_impact="Buttons containing only icons without text or aria-label cause screen readers to announce 'unlabeled button', leaving visually impaired users unable to identify button action (violating WCAG 2.1 SC 4.1.2).",
                    code_example="<button type=\"submit\" aria-label=\"Search\">\n  <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"></svg>\n</button>",
                    target_location="Page Template (HTML / <button>)",
                    line_number=getattr(first_btn, "sourceline", None),
                    problematic_code=str(first_btn)[:160]
                )
            )

        return findings

    def _check_autocomplete(self, forms) -> List[Finding]:
        personal_fields = {"name", "email", "tel", "phone", "address", "city", "zip", "postcode", "country", "username", "password"}
        missing_autocomplete_inputs = []

        for form in forms:
            for inp in form.find_all("input"):
                inp_type = (inp.get("type") or "text").lower()
                inp_name = (inp.get("name") or inp.get("id") or "").lower()
                if inp_type in ("hidden", "submit", "button", "reset", "image"):
                    continue
                if any(field in inp_name for field in personal_fields):
                    if not inp.get("autocomplete"):
                        missing_autocomplete_inputs.append(inp)

        if missing_autocomplete_inputs:
            first_auto = missing_autocomplete_inputs[0]
            return [
                Finding(
                    id="UX_FORM_MISSING_AUTOCOMPLETE",
                    category=Category.UX,
                    severity=Severity.LOW,
                    title=f"{len(missing_autocomplete_inputs)} Personal Data Input(s) Missing 'autocomplete' Attribute",
                    description="Inputs collecting personal data (name, email, address, etc.) without 'autocomplete' attributes prevent browser autofill, increasing user friction.",
                    remediation="Add appropriate autocomplete tokens (e.g., autocomplete='email', 'name', 'tel') per WCAG 2.1 SC 1.3.5.",
                    evidence={"fields": [(i.get("name") or i.get("id")) for i in missing_autocomplete_inputs[:5]]},
                    risk_impact="Users must repeatedly re-type contact and identity details manually, increasing friction, lowering form completion rates, and degrading mobile user experience.",
                    code_example="<input type=\"email\" name=\"email\" autocomplete=\"email\" />\n<input type=\"password\" name=\"password\" autocomplete=\"current-password\" />",
                    target_location="Page Template (HTML / <input>)",
                    line_number=getattr(first_auto, "sourceline", None),
                    problematic_code=str(first_auto)[:160]
                )
            ]

        return []

    def _check_form_method(self, forms) -> List[Finding]:
        findings: List[Finding] = []

        get_forms_with_sensitive = [
            form for form in forms
            if (form.get("method") or "get").lower() == "get"
            and form.find("input", type=lambda t: t in ("password", "email", "tel"))
        ]

        if get_forms_with_sensitive:
            first_sens_form = get_forms_with_sensitive[0]
            findings.append(
                Finding(
                    id="SEC_FORM_GET_SENSITIVE_DATA",
                    category=Category.SECURITY,
                    severity=Severity.HIGH,
                    title=f"{len(get_forms_with_sensitive)} Form(s) Submit Sensitive Data via GET",
                    description="Forms containing password, email, or phone inputs using the GET method expose credentials in the URL, browser history, and server logs.",
                    remediation="Use method='POST' for all forms containing sensitive or personal data.",
                    evidence={"count": len(get_forms_with_sensitive)},
                    risk_impact="Sensitive credentials and personal details are transmitted as URL query parameters, exposing them in browser history, proxy caches, server access logs, and referrer headers.",
                    code_example="<form action=\"/login\" method=\"POST\">\n  <input type=\"password\" name=\"password\" />\n  <button type=\"submit\">Log In</button>\n</form>",
                    target_location="Page Template (HTML / <form>)",
                    line_number=getattr(first_sens_form, "sourceline", None),
                    problematic_code=str(first_sens_form)[:160]
                )
            )

        return findings
