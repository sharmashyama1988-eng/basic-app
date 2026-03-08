from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from database import SearchDatabase
from crawler import AmisphereSpider

app = FastAPI(title="Amisphere Core Search Engine Architecture")
db = SearchDatabase()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CrawlRequest(BaseModel):
    urls: list[str]
    max_pages: int = 50

def run_spider(urls, max_pages):
    spider = AmisphereSpider(db)
    asyncio.run(spider.start_crawling(urls, max_pages))

@app.get("/search")
def api_search(q: str):
    results = db.search(q)
    suggestion = db.did_you_mean(q)
    return {
        "results": results,
        "suggestion": suggestion
    }

@app.get("/autocomplete")
def api_autocomplete(q: str):
    return {"suggestions": db.autocomplete(q)}

@app.post("/crawl")
def api_crawl(req: CrawlRequest, bg_tasks: BackgroundTasks):
    bg_tasks.add_task(run_spider, req.urls, req.max_pages)
    return {"message": "Amisphere Spider started crawling in background", "seed_urls": req.urls}

@app.get("/status")
def api_status():
    c = db.conn.cursor()
    try:
        c.execute("SELECT count(*) FROM visited_urls")
        indexed = c.fetchone()[0]
    except:
        indexed = 0
    return {"status": "Online", "engine": "Amisphere V2 (BM25 Inverted Index)", "pages_indexed": indexed}

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("🚀 AMISPHERE CORE ENGINE STARTED 🚀")
    print("1. Distributed Spider: Configured")
    print("2. Inverted Index (BM25): Configured")
    print("3. Query Engine: Configured")
    print("="*50 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=5000)
