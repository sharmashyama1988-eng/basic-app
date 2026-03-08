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

const FREE_AI_MODELS = [
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-chat:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "qwen/qwen-vl-plus:free",
    "mistralai/mistral-nemo:free",
    "mistralai/mistral-7b-instruct:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
    "huggingfaceh4/zephyr-7b-beta:free",
    "openchat/openchat-7b:free",
    "cognitivecomputations/dolphin-mixtral-8x7b:free",
    "anthropic/claude-3-haiku:free",
    "cohere/command-r:free"
];
let globalWikiResults = [];

// ==================== CACHE SYSTEM ====================
const CACHE_PREFIX = 'amisphere_cache_';
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function getCachedResults(query) {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + query.toLowerCase());
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_TTL) {
                console.log('CACHE HIT for:', query);
                return parsed.data;
            } else {
                localStorage.removeItem(CACHE_PREFIX + query.toLowerCase());
            }
        }
    } catch (e) { }
    return null;
}

function setCachedResults(query, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + query.toLowerCase(), JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) {
        // localStorage full — clean old caches
        cleanOldCaches();
    }
}

function cleanOldCaches() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.sort().slice(0, Math.floor(keys.length / 2)).forEach(k => localStorage.removeItem(k));
}

// ==================== VOICE SEARCH ====================
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Voice Search is not supported in this browser. Use Chrome for best experience.');
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Show listening UI
    const overlay = document.createElement('div');
    overlay.id = 'voice-overlay';
    overlay.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="width:80px;height:80px;border-radius:50%;background:#ea4335;display:flex;align-items:center;justify-content:center;animation:pulse 1.5s infinite;">
                <i class="fa-solid fa-microphone" style="font-size:36px;color:white;"></i>
            </div>
            <p style="color:white;font-size:24px;margin-top:20px;">Listening...</p>
            <p style="color:#9aa0a6;font-size:14px;margin-top:8px;">Speak now</p>
        </div>
    `;
    document.body.appendChild(overlay);

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('search-input').value = transcript;
        overlay.remove();
        window.location.href = `results.html?q=${encodeURIComponent(transcript)}`;
    };

    recognition.onerror = (event) => {
        overlay.remove();
        console.warn('Voice error:', event.error);
    };

    recognition.onend = () => {
        if (document.getElementById('voice-overlay')) {
            document.getElementById('voice-overlay').remove();
        }
    };

    overlay.addEventListener('click', () => {
        recognition.stop();
        overlay.remove();
    });
}

// Attach voice search to all mic buttons
window.startVoiceSearch = startVoiceSearch;

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

        // Set Nav Tab Links
        const navTabs = document.querySelectorAll('.nav-tab');
        if (navTabs.length >= 4) {
            const encodedQ = encodeURIComponent(query);
            navTabs[0].href = `results.html?q=${encodedQ}`; // All

            navTabs[1].href = `https://www.google.com/search?tbm=isch&q=${encodedQ}`; // Images
            navTabs[1].target = "_blank";

            navTabs[2].href = `https://news.google.com/search?q=${encodedQ}`; // News
            navTabs[2].target = "_blank";

            navTabs[3].href = `https://www.youtube.com/results?search_query=${encodedQ}`; // Videos
            navTabs[3].target = "_blank";
        }

        trackSearch(query);
        performSearch(query, page);
    }

    // Autocomplete Logic (Local History + Backend Hybrid)
    const autocompleteBox = document.getElementById('autocomplete-box');
    const searchInputEl = document.getElementById('search-input');

    if (searchInputEl && autocompleteBox) {
        searchInputEl.addEventListener('input', async (e) => {
            const val = e.target.value.trim();
            if (val.length >= 2) {
                // LOCAL AUTOCOMPLETE from search history (always works offline)
                let history = JSON.parse(localStorage.getItem('amisphere_history') || '[]');
                let localSuggestions = history.filter(h => h.toLowerCase().startsWith(val.toLowerCase())).slice(0, 6);

                // Also try backend if available
                try {
                    const res = await fetch(`http://127.0.0.1:5000/autocomplete?q=${encodeURIComponent(val)}`, { signal: AbortSignal.timeout(1500) });
                    if (res.ok) {
                        const data = await res.json();
                        // Merge backend suggestions with local, removing duplicates
                        const merged = [...new Set([...localSuggestions, ...data.suggestions])].slice(0, 8);
                        renderAutocomplete(merged);
                        return;
                    }
                } catch (err) {
                    // backend offline — use local only
                }
                renderAutocomplete(localSuggestions);
            } else {
                autocompleteBox.style.display = 'none';
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box-container')) {
                autocompleteBox.style.display = 'none';
                const sb = searchInputEl.closest('.search-box');
                if (sb) { sb.style.borderBottomLeftRadius = '24px'; sb.style.borderBottomRightRadius = '24px'; }
            }
        });
    }

    function renderAutocomplete(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            autocompleteBox.style.display = 'none';
            const sb = searchInputEl.closest('.search-box');
            if (sb) { sb.style.borderBottomLeftRadius = '24px'; sb.style.borderBottomRightRadius = '24px'; }
            return;
        }

        const sb = searchInputEl.closest('.search-box');
        if (sb) { sb.style.borderBottomLeftRadius = '0px'; sb.style.borderBottomRightRadius = '0px'; }

        autocompleteBox.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" onclick="document.getElementById('search-input').value='${s}'; window.location.href='results.html?q=${encodeURIComponent(s)}';">
                <i class="fa-solid fa-clock-rotate-left suggestion-icon"></i> <span style="font-weight: bold;">${s}</span>
            </div>
        `).join('');
        autocompleteBox.style.display = 'block';
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
    const startTime = performance.now();

    // 1. CHECK CACHE FIRST
    let data = getCachedResults(query);
    let fromCache = false;
    if (data) {
        fromCache = true;
    } else {
        // 2. Fetch from Internet
        data = await searchInternet(query);
        // Save to cache for next time
        if (data.results.length > 0) {
            setCachedResults(query, data);
        }
    }
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

    // Show Search Stats (Google style: "About X results (Y seconds)")
    const endTime = performance.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
    const statsDiv = document.getElementById('search-stats');
    if (statsDiv) {
        statsDiv.innerHTML = `About ${globalWikiResults.length} results (${timeTaken} seconds)${fromCache ? ' <i class="fa-solid fa-bolt" style="color:#fbbc05;" title="From Cache"></i>' : ''}`;
        statsDiv.style.display = 'block';
    }

    // 3. Fetch AI overview (Only on page 1)
    if (page === 1) {
        document.getElementById('ai-overview').style.display = 'block';
        getAISummary(query, globalWikiResults);
    }
}

async function searchInternet(query) {
    let resultData = { results: [], suggestion: null };
    const maxResults = 100;

    try {
        // Step 1: Search Whole Internet using DuckDuckGo HTML via AllOrigins (CORS Bypass)
        const dDGoUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(dDGoUrl)}`;

        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, "text/html");

            // Extract Did You Mean
            const spellEl = doc.querySelector('.spell');
            if (spellEl) {
                resultData.suggestion = spellEl.textContent.replace('Including results for', '').replace('Search only for', '').trim();
            }

            // Extract Search Results
            const resultNodes = doc.querySelectorAll('.result');
            resultNodes.forEach(node => {
                if (resultData.results.length >= maxResults) return;

                const titleEl = node.querySelector('.result__title a');
                const snippetEl = node.querySelector('.result__snippet');
                let urlEl = node.querySelector('.result__url');

                if (titleEl && snippetEl) {
                    let actualUrl = '';
                    // Clean URL
                    if (urlEl) {
                        actualUrl = urlEl.textContent.trim().replace(/\s+/g, '');
                        if (!actualUrl.startsWith('http')) {
                            actualUrl = 'https://' + actualUrl;
                        }
                    } else {
                        actualUrl = titleEl.href || '#';
                    }

                    resultData.results.push({
                        title: titleEl.textContent.trim(),
                        url: actualUrl,
                        snippet: snippetEl.textContent.trim()
                    });
                }
            });
        }
    } catch (error) {
        console.error("Internet Search API error:", error);
    }

    // Step 2: Fallback to Wikipedia if Internet block happens or no results
    if (resultData.results.length === 0) {
        console.log("Internet search blocked or empty, falling back to Wikipedia");
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srinfo=suggestion&utf8=&format=json&origin=*&srlimit=100`;
        try {
            const wResponse = await fetch(wikiUrl);
            const wData = await wResponse.json();
            if (wData.query && wData.query.searchinfo && wData.query.searchinfo.suggestion) {
                resultData.suggestion = wData.query.searchinfo.suggestion;
            }
            if (wData.query && wData.query.search) {
                resultData.results = wData.query.search.map(item => ({
                    title: item.title,
                    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                    snippet: item.snippet
                }));
            }
        } catch (wError) {
            console.error("Wikipedia Fallback error:", wError);
        }
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

    const prompt = `You are Amisphere AI, a personalized smart search assistant. \nUser's current query: '${query}'\nUser History Profile: ${context}\n\nTop 5 Web results for context:\n${wikiContext}\n\nBased on the user's current query, their historical interests, and the provided internet text knowledge, write a highly concise, helpful, and insightful summary.\nFocus on answering the user's query directly while also suggesting 1-2 external sites (with imaginary or real urls) or related topics they might like based on their history. No markdown code blocks, just plain bare HTML tags allowed (e.g. <b>, <i>, <br>, <ul>, <li>, <a href="...">) so it renders securely on the page.`;

    const apiUrl = `https://openrouter.ai/api/v1/chat/completions`;
    const aiContentDiv = document.getElementById('ai-content');
    let lastError = null;

    for (let currentModelIndex = 0; currentModelIndex < FREE_AI_MODELS.length; currentModelIndex++) {
        let modelName = FREE_AI_MODELS[currentModelIndex];
        let apiKey = getNextAPIKey();

        // Animation text with current model
        aiContentDiv.innerHTML = `<span class="ai-loading-text"><i class="fa-solid fa-circle-notch fa-spin"></i> Trying AI Matrix: <b>${modelName.split(':')[0]}</b>...</span>`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Amisphere',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "model": modelName,
                    "messages": [
                        { "role": "user", "content": prompt }
                    ]
                })
            });

            if (!response.ok) {
                lastError = new Error(`HTTP error! status: ${response.status}`);
                if (response.status === 401) {
                    console.warn(`OpenRouter Auth Failed (401). Stopping OpenRouter matrix.`)
                    break; // Un-authorized, key is blocked. Do not retry 20 models.
                }
                continue; // Goto next model/key
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                // Formatting AI success response
                let resultText = data.choices[0].message.content.replace(/```html/g, '').replace(/```/g, '');
                aiContentDiv.innerHTML = resultText + `<br><br><small style="color: #34a853; font-style: italic;"><i class="fa-solid fa-check-circle"></i> Generated by ${modelName}</small>`;
                return; // Stop and exit loop! we got a result
            }
        } catch (error) {
            console.warn(`OpenRouter Model Failed [${modelName}]:`, error);
            lastError = error;
            // Loop will continue to the next model automatically
            await new Promise(r => setTimeout(r, 500)); // Half second delay for animation effect
        }
    }

    // FALLBACK TO ORIGINAL GEMINI API IF OPENROUTER FAILS OR 401
    aiContentDiv.innerHTML = `<span class="ai-loading-text"><i class="fa-solid fa-circle-notch fa-spin"></i> OpenRouter failed. Activating Original Gemini Fallback...</span>`;
    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyD2UzpYWhaOC-g73BBzmJsqzPRzZN9g30g`;
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
            })
        });
        if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            if (geminiData.candidates && geminiData.candidates.length > 0) {
                let resultText = geminiData.candidates[0].content.parts[0].text.replace(/```html/g, '').replace(/```/g, '');
                aiContentDiv.innerHTML = resultText + `<br><br><small style="color: #34a853; font-style: italic;"><i class="fa-solid fa-check-circle"></i> Generated by Google Gemini API (Fallback Server)</small>`;
                return;
            }
        } else {
            lastError = new Error(`Gemini Fallback HTTP error! status: ${geminiResponse.status}`);
        }
    } catch (e) {
        lastError = e;
    }

    aiContentDiv.innerHTML = `Amisphere AI is currently unavailable or over quota. (${lastError?.message || "All models failed limits"})`;
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
