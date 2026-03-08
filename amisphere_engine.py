import os
import json
import re
from collections import defaultdict
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Allow your Netlify frontend to communicate with this python backend engine
CORS(app)

INDEX_FILE = 'amisphere_index.json'

class AmisphereSearchEngine:
    def __init__(self):
        self.inverted_index = defaultdict(list)
        self.documents = {} # URL to {title, snippet, text}
        self.load_index()

    def load_index(self):
        if os.path.exists(INDEX_FILE):
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.inverted_index = defaultdict(list, data.get('index', {}))
                self.documents = data.get('docs', {})
            print(f"Amisphere Engine Loaded: {len(self.documents)} pages currently indexed.")
        else:
            print("No index found. Starting fresh Amisphere Engine.")

    def save_index(self):
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump({'index': self.inverted_index, 'docs': self.documents}, f)

    def extract_words(self, text):
        # Extremely basic text processing: lowercasing and extracting alphanumeric words
        return re.findall(r'\b[a-z0-9]+\b', text.lower())

    def crawl_url(self, url):
        if url in self.documents:
            return f"Already indexed: {url}"
            
        try:
            print(f"Amisphere Bot Crawling: {url}")
            headers = {'User-Agent': 'AmisphereBot/1.0'}
            res = requests.get(url, headers=headers, timeout=10)
            
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, 'html.parser')
                
                # Fetching Title
                title = str(soup.title.string) if soup.title and soup.title.string else str(url)
                
                # Removing CSS and Scripts from HTML
                for script in soup(["script", "style", "nav", "footer"]):
                    script.extract()
                
                # Extract clean text
                text = soup.get_text(separator=' ')
                text = re.sub(r'\s+', ' ', text).strip()
                
                # Create Snippet
                snippet = text[:250] + "..."
                
                # Save Document Info
                self.documents[url] = {
                    'title': str(title).strip(),
                    'snippet': snippet
                }
                
                # Build Inverted Index (The core of a Search Engine)
                words = set(self.extract_words(title + " " + text))
                for word in words:
                    self.inverted_index[word].append(url)
                    
                self.save_index()
                return f"Successfully crawled and indexed: {url}"
            else:
                return f"Failed {res.status_code}: Could not fetch {url}"
        except Exception as e:
            return f"Error crawling {url}: {str(e)}"

    def search(self, query):
        query_words = self.extract_words(query)
        if not query_words:
            return []
            
        url_scores = defaultdict(int)
        
        # Simple Term-Frequency Scoring
        for word in query_words:
            if word in self.inverted_index:
                for url in self.inverted_index[word]:
                    url_scores[url] += 1
                    
        # Sort URLs based on how many query words matched (Score)
        ranked_urls = sorted(url_scores.keys(), key=lambda url: url_scores[url], reverse=True)
        
        results = []
        for url in ranked_urls[:100]: # Return top 100 results per page
            doc = self.documents[url]
            results.append({
                'title': doc['title'],
                'url': url,
                'snippet': doc['snippet']
            })
            
        return results

# Initialize the custom search engine
engine = AmisphereSearchEngine()

@app.route('/search', methods=['GET'])
def api_search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({"results": [], "suggestion": None})
        
    print(f"Amisphere Backend searching for: {query}")
    results = engine.search(query)
    
    return jsonify({
        "results": results,
        "suggestion": None,
        "total_hits": len(results)
    })

@app.route('/crawl', methods=['POST'])
def api_crawl():
    data = request.json
    urls = data.get('urls', [])
    if not urls:
        return jsonify({"error": "No URLs provided"}), 400
        
    logs = []
    for url in urls:
        logs.append(engine.crawl_url(url))
        
    return jsonify({"messages": logs, "total_indexed_pages": len(engine.documents)})

@app.route('/status', methods=['GET'])
def api_status():
    return jsonify({
        "engine": "Amisphere Custom Search 1.0",
        "total_indexed_pages": len(engine.documents),
        "total_unique_words": len(engine.inverted_index)
    })

if __name__ == '__main__':
    print('=============================================')
    print('🚀 AMISPHERE CUSTOM SEARCH ENGINE STARTED 🚀')
    print('=============================================')
    print('1. Engine URL: http://127.0.0.1:5000')
    print('2. Keep this console open to process search queries!')
    print('3. Make sure to first POST URLs to /crawl to build your database!')
    app.run(host='0.0.0.0', port=5000, debug=True)
