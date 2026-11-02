import pytest
from app.services.crawler import (
    normalize_url,
    is_same_domain,
    is_crawlable_link,
    AutonomousCrawler
)
from app.models.schema import CrawlNode, Severity, Category

def test_normalize_url():
    assert normalize_url("https://example.com/about#team") == "https://example.com/about"
    assert normalize_url("https://example.com/products/") == "https://example.com/products"
    assert normalize_url("https://example.com/") == "https://example.com/"

def test_is_same_domain():
    assert is_same_domain("https://example.com/docs", "example.com") is True
    assert is_same_domain("https://www.example.com/docs", "example.com") is True
    assert is_same_domain("https://sub.otherdomain.com/docs", "example.com") is False

def test_is_crawlable_link():
    assert is_crawlable_link("https://example.com/pricing", "example.com") is True
    assert is_crawlable_link("https://example.com/logo.png", "example.com") is False
    assert is_crawlable_link("https://example.com/script.js", "example.com") is False
    assert is_crawlable_link("javascript:void(0)", "example.com") is False
    assert is_crawlable_link("mailto:support@example.com", "example.com") is False
    assert is_crawlable_link("https://google.com/ad", "example.com") is False

@pytest.mark.asyncio
async def test_crawler_fallback_on_unreachable():
    crawler = AutonomousCrawler()
    # Unreachable / fake domain should gracefully return fallback crawl node without crashing
    nodes, findings = await crawler.crawl_and_explore("http://unreachable-test-domain-xyz.local", max_pages=1)
    assert len(nodes) >= 1
    assert isinstance(nodes[0], CrawlNode)
