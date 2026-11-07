"""
CAPTCHA & 2FA Challenge Detection & Human-in-the-Loop (HITL) Guard.

Defensive Security & Compliance Controller:
1. Detects presence of anti-bot challenges (reCAPTCHA, hCaptcha, Cloudflare Turnstile, Arkose/FunCaptcha).
2. Detects presence of 2FA / MFA authentication gates (OTP codes, SMS verification, Authenticator prompts).
3. Enforces strict safety boundary: Immediately HALTS automated interaction on challenged forms.
4. Generates comprehensive audit finding documenting the presence of the challenge gate and stopping automation.
5. Captures screenshot evidence to notify authorized operators that human verification is required.
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from app.models.schema import Finding, Category, Severity, RCACategory, SectorType


@dataclass
class ChallengeDetectionResult:
    detected: bool = False
    challenge_type: Optional[str] = None  # "RECAPTCHA" | "HCAPTCHA" | "TURNSTILE" | "TWO_FACTOR_AUTH" | "GENERIC_CAPTCHA"
    element_selector: Optional[str] = None
    provider_name: Optional[str] = None
    halted_automation: bool = True
    details: str = "No challenge detected"


# ---------------------------------------------------------------------------
# In-browser challenge detection script
# ---------------------------------------------------------------------------
CHECK_CHALLENGE_SCRIPT = """
() => {
    // 1. Cloudflare Turnstile (Check first as it often uses data-sitekey)
    if (document.querySelector('iframe[src*="challenges.cloudflare.com"], .cf-turnstile, [data-cf-action]')) {
        return {
            detected: true,
            challenge_type: 'TURNSTILE',
            provider_name: 'Cloudflare Turnstile',
            element_selector: 'iframe[src*="challenges.cloudflare.com"], .cf-turnstile',
            details: 'Cloudflare Turnstile challenge gate detected. Automated interaction halted.'
        };
    }

    // 2. hCaptcha
    if (document.querySelector('iframe[src*="hcaptcha.com"], .h-captcha')) {
        return {
            detected: true,
            challenge_type: 'HCAPTCHA',
            provider_name: 'hCaptcha',
            element_selector: 'iframe[src*="hcaptcha.com"], .h-captcha',
            details: 'hCaptcha verification frame detected. Automated interaction halted.'
        };
    }

    // 3. Google reCAPTCHA v2 / v3 / Enterprise
    if (document.querySelector('iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha.net"], .g-recaptcha, [class*="recaptcha" i]')) {
        return {
            detected: true,
            challenge_type: 'RECAPTCHA',
            provider_name: 'Google reCAPTCHA',
            element_selector: 'iframe[src*="recaptcha"], .g-recaptcha',
            details: 'Google reCAPTCHA iframe/widget detected. Automated interaction halted.'
        };
    }

    // 4. Two-Factor Authentication (2FA / MFA / OTP)
    const otpInput = document.querySelector(
        'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="2fa" i], ' +
        'input[placeholder*="doğrulama kodu" i], input[placeholder*="verification code" i], ' +
        'input[id*="otp" i], input[id*="sms-code" i]'
    );
    if (otpInput) {
        return {
            detected: true,
            challenge_type: 'TWO_FACTOR_AUTH',
            provider_name: '2FA / OTP Verification Gate',
            element_selector: otpInput.tagName.toLowerCase() + (otpInput.id ? '#' + otpInput.id : ''),
            details: 'Two-Factor Authentication (OTP/SMS) input field detected. Automated interaction halted.'
        };
    }

    // 5. Generic CAPTCHA image or audio
    const genericCaptcha = document.querySelector(
        'img[src*="captcha" i], img[id*="captcha" i], img[class*="captcha" i], ' +
        'input[name*="captcha" i], input[id*="captcha" i]'
    );
    if (genericCaptcha) {
        return {
            detected: true,
            challenge_type: 'GENERIC_CAPTCHA',
            provider_name: 'Custom / Image CAPTCHA',
            element_selector: genericCaptcha.tagName.toLowerCase(),
            details: 'Custom CAPTCHA challenge element detected. Automated interaction halted.'
        };
    }

    return {
        detected: false,
        challenge_type: null,
        provider_name: null,
        element_selector: null,
        details: 'No CAPTCHA or 2FA gate present.'
    };
}
"""


class ChallengeDetector:
    """
    Defensive security module that detects CAPTCHA / 2FA verification gates
    and strictly halts automated interaction to enforce safe Human-in-the-Loop practices.
    """

    @classmethod
    async def inspect_and_halt_if_gated(cls, page) -> ChallengeDetectionResult:
        """
        Inspects the active Playwright page for anti-bot or 2FA challenge barriers.
        """
        try:
            raw = await page.evaluate(CHECK_CHALLENGE_SCRIPT)
            if not isinstance(raw, dict):
                return ChallengeDetectionResult()

            return ChallengeDetectionResult(
                detected=bool(raw.get("detected")),
                challenge_type=raw.get("challenge_type"),
                element_selector=raw.get("element_selector"),
                provider_name=raw.get("provider_name"),
                halted_automation=bool(raw.get("detected")),
                details=str(raw.get("details", ""))
            )
        except Exception as exc:
            return ChallengeDetectionResult(
                detected=False,
                details=f"Challenge inspection skipped: {str(exc)[:100]}"
            )

    @classmethod
    def formulate_hitl_finding(
        cls,
        result: ChallengeDetectionResult,
        target_url: str,
        screenshot_b64: Optional[str] = None
    ) -> Optional[Finding]:
        """
        Generates an audit Finding documenting that a CAPTCHA or 2FA gate was detected,
        confirming that automated bot scanning was safely stopped for human operator review.
        """
        if not result.detected:
            return None

        return Finding(
            id="QA_CAPTCHA_OR_2FA_GATE_DETECTED",
            category=Category.UX,
            severity=Severity.INFO,
            title=f"Verification Gate Detected ({result.provider_name}): Automation Safely Halted",
            description=(
                f"On '{target_url}', an anti-bot challenge or two-factor authentication barrier "
                f"({result.provider_name}) was identified at '{result.element_selector}'. "
                f"In accordance with security principles and ethical boundaries, automated interaction "
                f"was safely stopped. A human operator must complete or authorize this step in a test environment."
            ),
            remediation=(
                "For automated CI/CD and regression testing in pre-production / staging environments, "
                "configure a dedicated test bypass token (e.g. 'X-QA-Bypass-Token') or mock OTP code "
                "restricted to whitelisted internal test runner IP addresses."
            ),
            risk_impact=(
                "Verification challenges correctly protect production endpoints from automated brute-force "
                "and bot abuse. However, in automated test pipelines they require sanctioned environment headers "
                "or human-in-the-loop verification."
            ),
            code_example=(
                "// Example: Staging bypass header for authorized automated test runners\n"
                "if (process.env.NODE_ENV !== 'production' && req.headers['x-qa-bypass'] === process.env.QA_SECRET) {\n"
                "  return next(); // Bypass CAPTCHA challenge for authorized internal CI runner\n"
                "}"
            ),
            target_location=f"Verification Element: {result.element_selector}",
            problematic_code=f"Gate Provider: {result.provider_name}",
            screenshot_before_b64=screenshot_b64,
            rca_category=RCACategory.EXPECTED_BEHAVIOR,
            team_assignment="QA & Test Mühendisliği (Auto-Heal QA)",
            root_cause_hypothesis="Application correctly enforces anti-bot or MFA challenge gates on sensitive operations.",
            reproduction_steps=[
                f"1. Navigate to '{target_url}'",
                f"2. Locate verification element '{result.element_selector}' ({result.provider_name})",
                "3. Automated scanner detects security barrier and pauses execution for human verification",
            ],
            evidence={
                "challenge_type": result.challenge_type,
                "provider_name": result.provider_name,
                "element_selector": result.element_selector,
                "automation_halted": result.halted_automation
            }
        )
