const OPENROUTER_API_KEYS = [
    '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'
    // Aap yahan comma laga kar aur keys add kar sakte hain:
    // , 'aapki_dusri_key_yahan'
];
let currentKeyIndex = 0;

function getNextAPIKey() {
    const key = OPENROUTER_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % OPENROUTER_API_KEYS.length;
    return key;
}

let globalWikiResults = [];

document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            if (newTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('amisphere_theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('amisphere_theme', 'light');
            }
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const pageStr = urlParams.get('page');
    let page = pageStr ? parseInt(pageStr, 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    if (query) {
        document.title = `${query} - Amisphere Search`;
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = query;
        }

        trackSearch(query);
        performSearch(query, page);
    }
});

function trackSearch(query) {
    let history = JSON.parse(localStorage.getItem('amisphere_history') || '[]');
    if (query && !history.includes(query)) {
        history.push(query);
        if (history.length > 20) {
            history = history.slice(history.length - 20);
        }
        localStorage.setItem('amisphere_history', JSON.stringify(history));
    }
}

function getContext() {
    let history = JSON.parse(localStorage.getItem('amisphere_history') || '[]');
    let userStr = localStorage.getItem('amisphere_user');
    let userName = "User";

    if (userStr) {
        try {
            userName = JSON.parse(userStr).name;
        } catch (e) { }
    }

    if (history.length === 0) {
        return `New user named ${userName}. Ensure responses are helpful and try to learn what they like. Address them by name occasionally.`;
    }
    return `The user's name is ${userName}. They have previously searched for: ${history.join(', ')}. Use this information to tailor the search results summary and recommend related concepts, websites, or topics that align with these interests. Format your answer nicely in plain HTML fragments if possible or just plain text that looks good. Try to address them by their name nicely.`;
}

async function performSearch(query, page) {
    // 1. Fetch from Wikipedia
    const data = await searchWikipedia(query);
    globalWikiResults = data.results;

    if (data.suggestion) {
        const dYMContainer = document.getElementById('did-you-mean');
        if (dYMContainer) {
            dYMContainer.style.display = 'block';
            dYMContainer.innerHTML = `Did you mean: <a href="results.html?q=${encodeURIComponent(data.suggestion)}">${data.suggestion}</a>`;
        }
    }

    renderWikiResults(globalWikiResults, query, page);
    renderPagination(globalWikiResults.length, page, query);

    // 2. Fetch from Gemini (Only generate AI overview if on page 1)
    if (page === 1) {
        document.getElementById('ai-overview').style.display = 'block';
        const aiSummary = await getAISummary(query, globalWikiResults);
        document.getElementById('ai-content').innerHTML = aiSummary;
    }
}

async function searchWikipedia(query) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srinfo=suggestion&utf8=&format=json&origin=*&srlimit=100`;
    let resultData = { results: [], suggestion: null };

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.query && data.query.searchinfo && data.query.searchinfo.suggestion) {
            resultData.suggestion = data.query.searchinfo.suggestion;
        }

        if (data.query && data.query.search) {
            resultData.results = data.query.search.map(item => ({
                title: item.title,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                snippet: item.snippet
            }));
        }
    } catch (error) {
        console.error("Wikipedia API error:", error);
    }
    return resultData;
}

function renderWikiResults(results, query, page) {
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = `<p>Your search - <strong>${query}</strong> - did not match any documents.</p>`;
        return;
    }

    const itemsPerPage = 10;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedResults = results.slice(startIndex, endIndex);

    paginatedResults.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <a href="${item.url}" class="result-url">${item.url}</a>
            <a href="${item.url}" class="result-title">${item.title}</a>
            <div class="result-snippet">${item.snippet}</div>
        `;
        container.appendChild(div);
    });
}

async function getAISummary(query, wikiResults) {
    const context = getContext();
    const wikiContext = wikiResults.slice(0, 5).map(r => `- ${r.title}: ${r.snippet.replace(/<[^>]*>?/g, '')}`).join('\n');

    const prompt = `You are Amisphere AI, a personalized smart search assistant. \nUser's current query: '${query}'\nUser History Profile: ${context}\n\nTop 5 Wikipedia results for context:\n${wikiContext}\n\nBased on the user's current query, their historical interests, and the provided Wikipedia knowledge, write a highly concise, helpful, and insightful summary.\nFocus on answering the user's query directly while also suggesting 1-2 external sites (with imaginary or real urls) or related topics they might like based on their history. No markdown code blocks, just plain bare HTML tags allowed (e.g. <b>, <i>, <br>, <ul>, <li>, <a href="...">) so it renders securely on the page.`;

    const apiUrl = `https://openrouter.ai/api/v1/chat/completions`;
    const maxRetries = Math.max(1, OPENROUTER_API_KEYS.length);
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const apiKey = getNextAPIKey();
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href, // Recommended by OpenRouter
                    'X-Title': 'Amisphere',               // Recommended by OpenRouter
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "model": "google/gemini-2.0-flash-lite-preview-02-05:free", // using free lightning fast gemini from openrouter
                    "messages": [
                        { "role": "user", "content": prompt }
                    ]
                })
            });

            if (!response.ok) {
                // Agar limit reach ho gayi to error store karein aur next key try karein loop me
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                return data.choices[0].message.content.replace(/```html/g, '').replace(/```/g, '');
            }
            return "Amisphere AI could not generate a summary.";

        } catch (error) {
            console.warn(`OpenRouter API error on key attempt ${attempt + 1}:`, error);
            lastError = error;
            // Loop continue karega to agle key rotation par jayega
        }
    }

    return `Amisphere AI is currently unavailable or over quota. (${lastError?.message || "Please check your api key limits"})`;
}

function renderPagination(totalResults, currentPage, query) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    if (totalResults <= 10) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    const totalPages = Math.ceil(totalResults / 10);
    // Limit to max 10 pages displayed for Amisphere style
    const maxPagesToShow = Math.min(totalPages, 10);

    let html = `<div class="pagination-logo">
        <span class="p-a">A</span>
        <span class="p-m">m</span>`;

    for (let i = 1; i <= maxPagesToShow; i++) {
        const isActive = (i === currentPage) ? 'active' : '';
        const hrefLink = (i === currentPage) ? '#' : `results.html?q=${encodeURIComponent(query)}&page=${i}`;

        html += `
        <a href="${hrefLink}" class="page-num ${isActive}">
            <span class="p-i">i</span>
            <span class="page-text">${i}</span>
        </a>
        `;
    }

    html += `<span class="p-s">s</span>
        <span class="p-p">p</span>
        <span class="p-h">h</span>
        <span class="p-e1">e</span>
        <span class="p-r">r</span>
        <span class="p-e2">e</span>
    </div>`;

    // Add next button if not on last page
    if (currentPage < totalPages && currentPage < maxPagesToShow) {
        html += `<a href="results.html?q=${encodeURIComponent(query)}&page=${currentPage + 1}" class="page-nav">Next &gt;</a>`;
    }

    paginationContainer.innerHTML = html;
}
