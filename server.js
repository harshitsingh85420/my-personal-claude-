const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the current directory (index.html, app.js)
app.use(express.static(path.join(__dirname, '')));

const SERPAPI_KEY = process.env.SERPAPI_KEY;

app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    if (!SERPAPI_KEY) {
        return res.status(500).json({ error: 'SERPAPI_KEY is not configured in .env' });
    }

    try {
        console.log(`[SEARCH] Query: "${query}"`);
        const response = await axios.get('https://serpapi.com/search', {
            params: {
                q: query,
                api_key: SERPAPI_KEY,
                num: 5,
                engine: 'google'
            }
        });

        const organic = response.data.organic_results || [];
        if (organic.length === 0) {
            return res.json({ results: "No results found." });
        }

        const resultsText = organic.map((r, i) => 
            `${i+1}. ${r.title}\n   ${r.snippet || ''}\n   ${r.link}`
        ).join('\n\n');

        res.json({ results: resultsText });
    } catch (error) {
        console.error('Search API error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
