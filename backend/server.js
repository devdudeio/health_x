// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { pool, initDB, storeTweets } = require('./db');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize DB Tables
initDB().catch(err => console.error('Error creating tables:', err));

// OpenAI setup
const openAiKey = process.env.OPENAI_API_KEY || '';
if (!openAiKey) {
  console.warn('WARNING: No OPENAI_API_KEY provided');
}
const openAiConfig = new Configuration({ apiKey: openAiKey });
const openai = new OpenAIApi(openAiConfig);

// Twitter Bearer Token
const twitterBearer = process.env.TWITTER_BEARER_TOKEN || '';
if (!twitterBearer) {
  console.warn('WARNING: No TWITTER_BEARER_TOKEN provided');
}

/**
 * fetchTweetsFromTwitter() - Retrieves tweets for a user (by handle) from Twitter API v2.
 * @param {string} handle - The Twitter handle (e.g. 'drhealth').
 * @param {number} count - Number of tweets to fetch (1-100).
 */
async function fetchTweetsFromTwitter(handle, count = 5) {
  if (!twitterBearer) {
    throw new Error('TWITTER_BEARER_TOKEN not set in environment');
  }
  // 1) Lookup user by username
  const userUrl = `https://api.twitter.com/2/users/by/username/${handle}`;
  const userRes = await fetch(userUrl, {
    headers: { Authorization: `Bearer ${twitterBearer}` }
  });
  if (!userRes.ok) {
    throw new Error(`User fetch failed: ${userRes.status} - ${await userRes.text()}`);
  }
  const userData = await userRes.json();
  const userId = userData?.data?.id;
  if (!userId) {
    throw new Error(`User not found for handle: ${handle}`);
  }

  // 2) Fetch tweets for that user
  const tweetsUrl = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${count}&tweet.fields=created_at`;
  const tweetsRes = await fetch(tweetsUrl, {
    headers: { Authorization: `Bearer ${twitterBearer}` }
  });
  if (!tweetsRes.ok) {
    throw new Error(`Tweets fetch failed: ${tweetsRes.status} - ${await tweetsRes.text()}`);
  }
  const tweetsJson = await tweetsRes.json();
  const tweets = tweetsJson?.data || [];
  return tweets; // array of {id, text, created_at}
}

/**
 * Example usage of OpenAI to extract claims from text.
 */
async function extractClaimsFromText(text) {
  const prompt = `
  Extract all factual health-related claims from the following text, one per line:
  ---
  ${text}
  ---
  If none found, return an empty list.
  `;
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
    const lines = response.data.choices[0].message.content.split('\n');
    return lines.map(l => l.trim()).filter(Boolean);
  } catch (err) {
    console.error('OpenAI error (extractClaims):', err);
    return [];
  }
}

// ---------------
//  REST Endpoints
// ---------------

// Ping
app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// GET all influencers
app.get('/influencers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM influencers ORDER BY influencer_id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('GET /influencers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET influencer details + claims
app.get('/influencers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // influencer
    const infRes = await pool.query('SELECT * FROM influencers WHERE influencer_id=$1', [id]);
    if (infRes.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    const influencer = infRes.rows[0];

    // claims
    const cRes = await pool.query('SELECT * FROM claims WHERE influencer_id=$1 ORDER BY claim_id ASC', [id]);
    influencer.claims = cRes.rows;

    // tweets
    const tRes = await pool.query('SELECT * FROM tweets WHERE influencer_id=$1 ORDER BY created_at DESC', [id]);
    influencer.tweets = tRes.rows;

    res.json(influencer);
  } catch (error) {
    console.error('GET /influencers/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create/update influencer
app.post('/influencers', async (req, res) => {
  const { name, handle, follower_count } = req.body || {};
  if (!handle) {
    return res.status(400).json({ error: 'handle is required' });
  }
  try {
    // check if influencer exists
    const checkRes = await pool.query('SELECT * FROM influencers WHERE handle=$1', [handle]);
    if (checkRes.rows.length === 0) {
      // create
      const insertRes = await pool.query(
        `INSERT INTO influencers(name, handle, follower_count)
         VALUES($1,$2,$3) RETURNING influencer_id`,
        [name || '', handle, follower_count || 0]
      );
      const newId = insertRes.rows[0].influencer_id;
      res.status(201).json({ message: 'Influencer created', influencer_id: newId });
    } else {
      // update
      const inf = checkRes.rows[0];
      await pool.query(
        'UPDATE influencers SET name=$1, follower_count=$2 WHERE influencer_id=$3',
        [name || inf.name, follower_count || inf.follower_count, inf.influencer_id]
      );
      res.json({ message: 'Influencer updated', influencer_id: inf.influencer_id });
    }
  } catch (error) {
    console.error('POST /influencers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST fetch real tweets for influencer, store in DB
app.post('/influencers/:id/fetchTweets', async (req, res) => {
  const { id } = req.params;
  const { count } = req.body || { count: 5 };
  try {
    // find influencer
    const infRes = await pool.query('SELECT influencer_id, handle FROM influencers WHERE influencer_id=$1', [id]);
    if (infRes.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    const influencer = infRes.rows[0];

    // fetch from Twitter
    const tweets = await fetchTweetsFromTwitter(influencer.handle, count);
    // store in DB
    await storeTweets(influencer.influencer_id, tweets);

    res.json({
      message: `Fetched ${tweets.length} tweets for @${influencer.handle}`,
      tweets: tweets.map(t => ({ id: t.id, text: t.text })),
    });
  } catch (error) {
    console.error('POST /influencers/:id/fetchTweets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST analyze influencer (example of claim extraction)
app.post('/analyze/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1) get influencer
    const infRes = await pool.query('SELECT * FROM influencers WHERE influencer_id=$1', [id]);
    if (infRes.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    const influencer = infRes.rows[0];

    // 2) get tweets from DB (could also fetch live from Twitter)
    const tweetRows = await pool.query(
      `SELECT tweet_text FROM tweets WHERE influencer_id=$1 ORDER BY created_at DESC`,
      [influencer.influencer_id]
    );
    if (tweetRows.rows.length === 0) {
      return res.json({ message: 'No tweets in DB for this influencer. Fetch tweets first!' });
    }

    // combine text
    const allText = tweetRows.rows.map(r => r.tweet_text).join('\n');

    // 3) extract claims
    const rawClaims = await extractClaimsFromText(allText);
    if (!rawClaims.length) {
      return res.json({ message: 'No health-related claims found', claims_analyzed: 0 });
    }

    // 4) (Optional) de-duplicate, categorize, verify, etc.
    // For simplicity, we'll just store them as-is. Let's skip advanced steps here.

    // 5) store claims in DB
    for (const cText of rawClaims) {
      await pool.query(
        `INSERT INTO claims (influencer_id, claim_text)
         VALUES ($1, $2)`,
        [influencer.influencer_id, cText]
      );
    }

    res.json({
      message: 'Analysis complete',
      claims_analyzed: rawClaims.length,
    });
  } catch (error) {
    console.error('POST /analyze/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
