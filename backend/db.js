// db.js

const { Pool } = require('pg');
require('dotenv').config();

// Get DB configs from .env or fallback
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'health_db',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});


// Still in db.js

// We'll call this function once from server.js to initialize tables
async function initDB() {
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
  
    console.log('Tables ensured (influencers, claims).');
  }
  
  module.exports = { pool, initDB };
  
