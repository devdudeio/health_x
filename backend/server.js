// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, initDB } = require('./db');
const { Configuration, OpenAIApi } = require('openai');

// 1. Express App
const app = express();
app.use(cors());
app.use(express.json());  // for parsing JSON bodies

// 2. OpenAI Config
const openAiKey = process.env.OPENAI_API_KEY || '';
if (!openAiKey) {
  console.warn('WARNING: No OPENAI_API_KEY in environment.');
}
const configuration = new Configuration({
  apiKey: openAiKey,
});
const openai = new OpenAIApi(configuration);

// 3. Init DB (create tables)
initDB().catch((err) => {
  console.error('Error creating tables:', err);
});

// 4. Mock function: fetch tweets
async function fetchTweets(handle, numTweets = 20) {
  // In real code, call Twitter API
  // For now, mock:
  const tweets = [
    `Sample tweet #1 about health from @${handle}`,
    `Sample tweet #2 about nutrition from @${handle}`,
    `Sample tweet #3 about mental health from @${handle}`
  ];
  // Return up to numTweets
  return tweets.slice(0, numTweets);
}

// 5. Extract claims (via OpenAI)
async function extractClaimsFromText(text) {
  const prompt = `
  Extract all factual health-related claims from the following text, one per line. 
  If none found, return an empty list.
  TEXT:
  ${text}
  `;
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0
    });
    const content = response.data.choices[0].message.content;
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    // Some lines might have a dash or bullet
    const cleaned = lines.map(line => line.replace(/^[-*]\s*/, '').trim());
    return cleaned;
  } catch (err) {
    console.error('OpenAI error (extractClaims):', err);
    return [];
  }
}

// 6. (Optional) De-duplicate claims
// Node doesn't have sentence_transformers by default, so let's do a naive approach:
// We'll just remove exact duplicates or near-exact duplicates
function deduplicateClaims(claims) {
  const unique = [];
  const set = new Set();

  for (const c of claims) {
    // naive: case-insensitive trim
    const key = c.trim().toLowerCase();
    if (!set.has(key)) {
      set.add(key);
      unique.push(c.trim());
    }
  }
  return unique;
}

// 7. Categorize claim
async function categorizeClaim(claimText) {
  const prompt = `
  Classify the following health claim into one category:
  - Nutrition
  - Medicine
  - Mental Health
  - Fitness
  - Other

  Claim: "${claimText}"

  Return ONLY the single category.
  `;
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenAI error (categorizeClaim):', err);
    return 'Other';
  }
}

// 8. Verify claim
async function verifyClaim(claimText) {
  const prompt = `
  Consider the health claim: "${claimText}"
  Decide if it's: Verified, Questionable, or Debunked.
  Also give a confidence score (0-100).
  Return JSON like: {"status": "Verified", "confidence": 85}
  `;
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
    const raw = response.data.choices[0].message.content.trim();
    // Attempt to parse JSON
    const parsed = JSON.parse(raw);
    const status = parsed.status || 'Questionable';
    const conf = parsed.confidence || 50;
    return { status, confidence: conf };
  } catch (err) {
    console.error('OpenAI error (verifyClaim):', err);
    // fallback
    return { status: 'Questionable', confidence: 50 };
  }
}

// 9. ROUTES

// 9.1 Ping
app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// 9.2 GET all influencers
app.get('/influencers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM influencers');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 9.3 GET single influencer details (+ claims)
app.get('/influencers/:influencer_id', async (req, res) => {
  const { influencer_id } = req.params;
  try {
    const infResult = await pool.query(
      'SELECT * FROM influencers WHERE influencer_id = $1',
      [influencer_id]
    );
    if (infResult.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    const influencer = infResult.rows[0];
    const claimResult = await pool.query(
      'SELECT * FROM claims WHERE influencer_id = $1 ORDER BY claim_id ASC',
      [influencer_id]
    );
    influencer.claims = claimResult.rows;
    res.json(influencer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 9.4 POST create/update influencer
app.post('/influencers', async (req, res) => {
  const { name, handle, follower_count } = req.body;
  if (!handle) {
    return res.status(400).json({ error: 'Handle is required' });
  }
  try {
    // check if exists
    let existing = await pool.query(
      'SELECT * FROM influencers WHERE handle = $1',
      [handle]
    );
    if (existing.rows.length === 0) {
      // create new
      const insertResult = await pool.query(
        `INSERT INTO influencers (name, handle, follower_count)
         VALUES ($1, $2, $3)
         RETURNING influencer_id`,
        [name || '', handle, follower_count || 0]
      );
      const newId = insertResult.rows[0].influencer_id;
      res.status(201).json({ message: 'Influencer created', influencer_id: newId });
    } else {
      // update existing
      const inf = existing.rows[0];
      await pool.query(
        'UPDATE influencers SET name = $1, follower_count = $2 WHERE influencer_id = $3',
        [name || inf.name, follower_count || inf.follower_count, inf.influencer_id]
      );
      res.json({ message: 'Influencer updated', influencer_id: inf.influencer_id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 9.5 POST analyze influencer
app.post('/analyze/:influencer_id', async (req, res) => {
  const { influencer_id } = req.params;
  try {
    // 1) get influencer
    let infResult = await pool.query('SELECT * FROM influencers WHERE influencer_id = $1', [influencer_id]);
    if (infResult.rows.length === 0) {
      return res.status(404).json({ error: 'Influencer not found' });
    }
    const influencer = infResult.rows[0];

    // 2) fetch tweets
    const tweets = await fetchTweets(influencer.handle, 20);
    if (!tweets.length) {
      return res.json({ message: 'No tweets found', claims_analyzed: 0 });
    }

    // 3) extract claims
    const combinedText = tweets.join('\n');
    const rawClaims = await extractClaimsFromText(combinedText);
    if (!rawClaims.length) {
      return res.json({ message: 'No health-related claims found', claims_analyzed: 0 });
    }

    // 4) deduplicate
    const uniqueClaims = deduplicateClaims(rawClaims);

    // 5) categorize + verify
    let totalConf = 0;
    let verifiedCount = 0;
    for (const ctext of uniqueClaims) {
      const category = await categorizeClaim(ctext);
      const verification = await verifyClaim(ctext);
      const { status, confidence } = verification;
      if (status.toLowerCase() === 'verified') verifiedCount++;

      totalConf += confidence;

      // store in DB
      await pool.query(
        `INSERT INTO claims (influencer_id, claim_text, category, verification_status, confidence_score)
         VALUES ($1, $2, $3, $4, $5)`,
        [influencer_id, ctext, category, status, confidence]
      );
    }

    // 6) compute new trust score
    const overallTrust = uniqueClaims.length > 0 ? (totalConf / uniqueClaims.length) : 0;

    await pool.query(
      'UPDATE influencers SET trust_score=$1, last_analyzed=NOW() WHERE influencer_id=$2',
      [overallTrust, influencer_id]
    );

    return res.json({
      message: 'Analysis complete',
      claims_analyzed: uniqueClaims.length,
      verified_count: verifiedCount,
      overall_trust_score: overallTrust
    });
  } catch (err) {
    console.error('Analyze error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 10. START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Node server listening on port ${PORT}`);
});
