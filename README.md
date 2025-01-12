Health Influencer Claim Verification
====================================

This project provides a **Node.js (Express)** service that automatically fetches (or stores) health-related posts/tweets from an influencer, detects any health claims they make, **de-duplicates** repeated claims, and uses **OpenAI** to categorize and verify the validity of these claims. It stores the results in a **PostgreSQL** database and exposes a **REST API** for a front-end or other clients to consume.

Features
--------

1.  **Influencer Management**

    -   Create or update influencers (name, handle, follower count) in a PostgreSQL database.
    -   Fetch a list of all influencers or retrieve detailed info (including claims) for a specific influencer.
2.  **Claim Extraction & Verification**

    -   Pull (mock) tweets or text from the influencer.
    -   Use **OpenAI GPT** to automatically **extract** health-related claims.
    -   **De-duplicate** repeated claims (a naive approach by default---could integrate advanced methods).
    -   Categorize each claim (e.g., Nutrition, Medicine, Mental Health, Fitness, Other).
    -   Verify the claim ("Verified," "Questionable," or "Debunked") and assign a confidence score (0--100).
3.  **Trust Scoring**

    -   Compute an overall trust score for each influencer, based on the average confidence of their claims.
4.  **Database Storage**

    -   Stores **influencers** and **claims** in a PostgreSQL database with relationships.
    -   Each claim includes text, category, verification status, confidence score, and timestamp.
5.  **RESTful Endpoints**

    -   **`GET /influencers`** -- Lists all influencers.
    -   **`GET /influencers/:id`** -- Retrieves a single influencer's details and claims.
    -   **`POST /influencers`** -- Creates or updates an influencer.
    -   **`POST /analyze/:id`** -- Runs the OpenAI-based analysis pipeline for a given influencer.

How It Works
------------

1.  **Create an Influencer**

    -   POST their name, handle (unique), and follower count to `/influencers`.
2.  **Analyze**

    -   When you call `POST /analyze/:id`, the service:
        1.  **Fetches** (or simulates) tweets for that influencer.
        2.  Uses **OpenAI** to **extract** health-related claims from the text.
        3.  **De-duplicates** repeated claims.
        4.  **Categorizes** each claim into broad categories (Nutrition, Medicine, etc.).
        5.  **Verifies** each claim with a "Verified," "Questionable," or "Debunked" label and a **confidence score** (0--100).
        6.  **Stores** everything in the `claims` table, updating the influencer's `trust_score`.
3.  **View Results**

    -   **GET** `/influencers` to see all influencers, or `/influencers/:id` to see that influencer's claims in detail.

Tech Stack
----------

-   **Node.js** / **Express** for the backend API
-   **PostgreSQL** for data storage
-   **OpenAI** for LLM-based claim extraction, categorization, and verification
-   **Docker Compose** (optional) to run PostgreSQL and the Node service together

Project Structure
-----------------

go

Code kopieren

```.
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js        // Main Express app
│   ├── db.js            // Database connection & table init
│   └── ...
└── docker-compose.yml
```

Installation & Setup
--------------------

1.  **Clone** the repository.
2.  **Set up** your environment variables in a `.env` file or export them in your shell:

    bash

    Code kopieren

    `DB_HOST=localhost
    DB_USER=postgres
    DB_PASS=postgres
    DB_NAME=health_db
    OPENAI_API_KEY=sk-xxx
    PORT=5001`

3.  **Install** dependencies:

    bash

    Code kopieren

    `cd backend
    npm install`

4.  **Run with Docker Compose** (recommended):

    bash

    Code kopieren

    `docker-compose up --build`

    -   This spins up Postgres and the Node server on port **5001** (or whichever you configure).
    -   Or, to run locally without Docker, ensure Postgres is running separately, then:

        bash

        Code kopieren

        `npm start`

Usage
-----

1.  **Create an influencer**:

    bash

    Code kopieren

    `curl -X POST -H "Content-Type: application/json"\
      -d '{"name":"Dr. Health","handle":"drhealth","follower_count":10000}'\
      http://localhost:5001/influencers`

2.  **Check influencer list**:

    bash

    Code kopieren

    `curl http://localhost:5001/influencers`

3.  **Analyze** claims for influencer ID `1`:

    bash

    Code kopieren

    `curl -X POST http://localhost:5001/analyze/1`

4.  **View** updated influencer details (including claims):

    bash

    Code kopieren

    `curl http://localhost:5001/influencers/1`

Customization
-------------

-   **Tweet Ingestion**: Currently, tweets are **mocked**. Integrate real Twitter data or store tweets in a DB table if desired.
-   **De-duplication**: A naive string check is used by default; you can integrate more advanced embedding-based solutions.
-   **Verification**: Modify the OpenAI prompts or use a different model for more accurate claim verification.
-   **Frontend**: Build a React/Vue/Angular dashboard calling these endpoints to visualize influencer data, claims, and trust scores.

Contributing
------------

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

License
-------

MIT -- Feel free to use and adapt this project to your own needs.
