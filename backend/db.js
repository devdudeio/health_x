// db.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'health_db',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

/**
 * initDB() - Creates the core tables if they don't exist:
 *   - influencers
 *   - claims
 *   - tweets
 */
async function initDB() {
  // Influencers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS influencers (
      influencer_id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      handle VARCHAR(255) NOT NULL UNIQUE,
      follower_count INT DEFAULT 0,
      trust_score FLOAT DEFAULT 0.0,
      last_analyzed TIMESTAMP
    );
  `);

  // Claims table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS claims (
      claim_id SERIAL PRIMARY KEY,
      influencer_id INT REFERENCES influencers(influencer_id),
      claim_text TEXT NOT NULL,
      category VARCHAR(50),
      verification_status VARCHAR(50),
      confidence_score FLOAT DEFAULT 0.0,
      date_collected TIMESTAMP DEFAULT NOW()
    );
  `);

  // Tweets table (real tweets from Twitter)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tweets (
      tweet_id BIGINT PRIMARY KEY, -- Twitter's unique ID
      influencer_id INT REFERENCES influencers(influencer_id),
      tweet_text TEXT NOT NULL,
      created_at TIMESTAMP,
      inserted_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('Tables ensured: influencers, claims, tweets');
}

/**
 * storeTweets() - Inserts tweets into the DB, ignoring duplicates via ON CONFLICT.
 * @param {number} influencerId - ID of the influencer in our DB.
 * @param {Array} tweets - Array of tweet objects from Twitter API (id, text, created_at).
 */
async function storeTweets(influencerId, tweets = []) {
  if (!tweets.length) return;

  for (const t of tweets) {
    try {
      await pool.query(
        `INSERT INTO tweets (tweet_id, influencer_id, tweet_text, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tweet_id) DO NOTHING`,
        [t.id, influencerId, t.text, t.created_at]
      );
    } catch (error) {
      console.error('Error inserting tweet:', error);
    }
  }
  console.log(`Stored ${tweets.length} tweets for influencer_id = ${influencerId}`);
}

module.exports = {
  pool,
  initDB,
  storeTweets,
};
