import asyncio
import traceback
from app.services.crawler import AutonomousCrawler

async def main():
    print("=== Testing crawler end-to-end ===")
    crawler = AutonomousCrawler()
    try:
        nodes, findings = await crawler.crawl_and_explore(
            "https://github.com",
            max_pages=4,
            max_depth=2
        )
        print(f"Nodes found: {len(nodes)}")
        for n in nodes:
            print(f"  [{n.status_code}] {n.url} (links: {len(n.links_found)})")
        print(f"Findings from crawler: {len(findings)}")
    except Exception:
        traceback.print_exc()

asyncio.run(main())
