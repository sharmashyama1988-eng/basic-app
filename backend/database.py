import sqlite3
import re

class SearchDatabase:
    def __init__(self, db_path="amisphere.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.create_tables()

    def create_tables(self):
        c = self.conn.cursor()
        c.execute('''
            CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                url UNINDEXED, 
                title, 
                description, 
                content,
                tokenize='porter' 
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS dictionary (
                word TEXT PRIMARY KEY,
                frequency INTEGER DEFAULT 1
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS visited_urls (
                url TEXT PRIMARY KEY
            )
        ''')
        self.conn.commit()

    def is_visited(self, url):
        c = self.conn.cursor()
        c.execute("SELECT url FROM visited_urls WHERE url=?", (url,))
        return bool(c.fetchone())

    def add_page(self, url, title, description, content):
        c = self.conn.cursor()
        try:
            if self.is_visited(url):
                return
            
            c.execute("INSERT INTO search_index (url, title, description, content) VALUES (?, ?, ?, ?)", 
                      (url, title, description, content))
            c.execute("INSERT INTO visited_urls (url) VALUES (?)", (url,))
            
            words = re.findall(r'\b[a-z]{3,}\b', (title + " " + description).lower())
            for w in set(words):
                c.execute("INSERT INTO dictionary (word) VALUES (?) ON CONFLICT(word) DO UPDATE SET frequency=frequency+1", (w,))
            self.conn.commit()
        except sqlite3.Error as e:
            print("DB Error:", e)

    def search(self, query):
        c = self.conn.cursor()
        words = query.split()
        if not words: return []
        
        formatted_query = ' OR '.join([f'"{w}"*' for w in words])
        
        try:
            c.execute('''
                SELECT url, title, description, snippet(search_index, 3, '<b>', '</b>', '...', 60) as snip, bm25(search_index) as score
                FROM search_index
                WHERE search_index MATCH ?
                ORDER BY score ASC
                LIMIT 100
            ''', (formatted_query,))
            
            results = []
            for row in c.fetchall():
                results.append({
                    "url": row[0],
                    "title": row[1],
                    "snippet": row[2] if row[2] else row[3]
                })
            return results
        except Exception as e:
            print("Search error:", e)
            return []

    def autocomplete(self, prefix):
        c = self.conn.cursor()
        c.execute("SELECT word FROM dictionary WHERE word LIKE ? ORDER BY frequency DESC LIMIT 6", (prefix + '%',))
        return [row[0] for row in c.fetchall()]

    def did_you_mean(self, query):
        words = query.split()
        suggestion = []
        c = self.conn.cursor()
        changed = False
        for w in words:
            c.execute("SELECT word FROM dictionary WHERE word=?", (w,))
            if c.fetchone():
                suggestion.append(w)
            else:
                c.execute("SELECT word FROM dictionary WHERE word LIKE ? OR word LIKE ? ORDER BY frequency DESC LIMIT 1", (w[:3]+'%', '%'+w[-3:]))
                res = c.fetchone()
                if res:
                    suggestion.append(res[0])
                    changed = True
                else:
                    suggestion.append(w)
        if changed:
            return " ".join(suggestion)
        return None
