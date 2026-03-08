import asyncio
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

class AmisphereSpider:
    def __init__(self, db):
        self.db = db
        self.queue = asyncio.Queue()

    async def fetch(self, session, url):
        try:
            async with session.get(url, timeout=10) as response:
                if response.status == 200:
                    html = await response.text()
                    return html
        except Exception:
            pass
        return None

    def extract_data(self, html, url):
        soup = BeautifulSoup(html, 'html.parser')
        
        title_str = soup.title.string if soup.title else url
        title = str(title_str)
        description = ""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            description = meta_desc.get('content', '')
            
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.extract()
            
        text = soup.get_text(separator=' ')
        
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            full_url = urljoin(url, href)
            parsed = urlparse(full_url)
            if parsed.scheme in ['http', 'https']:
                links.append(full_url.split('#')[0])
                
        return title.strip(), str(description).strip(), text, links

    async def worker(self, session, max_pages):
        while self.pages_crawled < max_pages:
            url = await self.queue.get()
            
            if self.db.is_visited(url):
                self.queue.task_done()
                continue
                
            print(f"Amisphere Spider Crawling: {url}")
            html = await self.fetch(session, url)
            if html:
                title, desc, text, links = self.extract_data(html, url)
                self.db.add_page(url, title, desc, text)
                self.pages_crawled += 1
                
                for link in links:
                    if not self.db.is_visited(link):
                         self.queue.put_nowait(link)
                         
            self.queue.task_done()

    async def start_crawling(self, start_urls, max_pages=100):
        self.pages_crawled = 0
        for u in start_urls:
             self.queue.put_nowait(u)
             
        async with aiohttp.ClientSession(headers={'User-Agent': 'AmisphereBot/2.0'}) as session:
            tasks = []
            for _ in range(5):
                task = asyncio.create_task(self.worker(session, max_pages))
                tasks.append(task)
            
            await self.queue.join()
            for task in tasks:
                 task.cancel()
        print("Crawling run finished.")
