# Prople Store — Core Architecture & Algorithmic Distribution Plan (`plan.md`)

This document outlines the end-to-end technical blueprint for app distribution, dynamic section ranking, contextual dayparting (time-of-day affinity), similarity & recommendation mathematics, search intelligence (RAG), caching hierarchy (Redis + Client), and fraud-resistant download checkpointing for **Prople Store**.

---

## 1. Executive Architecture & Distribution Pipeline

The Prople Store distribution engine operates as a multi-stage funnel designed to deliver sub-50ms cached responses and sub-200ms personalized feeds while ensuring high catalog diversity, organic discovery, and developer fairness.

```
+------------------------------------------------------------------------------------+
|                                CATALOG DATABASE & REALTIME METRICS                 |
|   (Firestore / Apps / Reviews / Changelogs / Verified Signatures / Raw Logs)      |
+------------------------------------------------------------------------------------+
                                           |
                                           v
+------------------------------------------------------------------------------------+
|                                OFFLINE / BATCH COMPUTATION                          |
|  * Text & Tag Embeddings (Gemini Embeddings 768-dim)                               |
|  * Co-install Graph Matrices (Markov item-item transitions)                        |
|  * Wilson Score Ratings & Bayesian Averages                                        |
|  * 24h/7d Velocity Decay Aggregations                                              |
+------------------------------------------------------------------------------------+
                                           |
                                           v
+------------------------------------------------------------------------------------+
|                         NEARLINE & DISTRIBUTED CACHE LAYER                          |
|  * Redis Leaderboards (Sorted Sets `ZSET` for Top Charts & Trending)               |
|  * Redis Vector Store / HNSW Index (Fast Similarity Lookup)                        |
|  * In-Memory LRU Cache for Static Metadata & Category Taxonomy                     |
+------------------------------------------------------------------------------------+
                                           |
                                           v
+------------------------------------------------------------------------------------+
|                       ONLINE RANKING & TIME-OF-DAY SCHEDULER                        |
|  * Temporal Context Filters (Morning / Work / Evening / Night / Weekend)           |
|  * Dynamic Section Pruning & Visibility Thresholds                                |
|  * Real-time User Intent Blending & Cold-Start Balancing                           |
+------------------------------------------------------------------------------------+
                                           |
                                           v
+------------------------------------------------------------------------------------+
|                             CLIENT-SIDE PRESENTATION & EDGE                        |
|  * Responsive Component Feed (Banners, Carousels, Squircle Grids, Card Columns)   |
|  * Checkpoint-based Download Manager with SHA-256 Validation & Offline Queue       |
+------------------------------------------------------------------------------------+
```

---

## 2. Dynamic Section Management & Dayparting (Time-of-Day Affinity)

### 2.1 The Need for Dayparting
App utility correlates directly with user context:
- A user at 08:00 AM wants news, public transit, coffee orders, or task managers.
- A user at 08:00 PM wants immersive games, streaming services, or relaxed social feeds.
- Presenting heavy gaming titles during morning commutes degrades conversion and increases bounce rates.

### 2.2 Time-of-Day Affinity Matrix

The store dynamically shifts section weights according to the client's localized timezone:

| Time Slot | Phase Name | Primary Categories Boosted | Deprioritized Categories | Primary Banner / Feed Focus |
|:---|:---|:---|:---|:---|
| **06:00 – 10:00** | *Morning Surge* | Productivity, News, Finance, Weather, Transit | Heavy 3D Games, Long-form Video | Morning Briefing, Quick Utilities, Task Trackers |
| **10:00 – 16:00** | *Workday / Focus* | Business, Communication, Education, Tools | Immersive RPGs, Party Games | Workflow Enhancers, Document Scanners, Focus Apps |
| **16:00 – 21:00** | *Evening Leisure* | Action/Casual Games, Social, Entertainment, Food | Enterprise, Academic, Calculators | New & Updated Games, Trending Media, Streaming |
| **21:00 – 02:00** | *Night Relaxation* | Audio, Meditation, Comics/Books, Casual Games | High-Intensity Productivity, Work Chat | Sleep & Wellness, Audiobooks, Night Reading |
| **02:00 – 06:00** | *Low Activity* | System Utilities, Wallpapers, Offline Tools | Live Multiplayer Events | Storage Cleaners, Battery Managers, Lightweight Tools |
| **Weekends (All)** | *Weekend Discovery* | Travel, Photography, Shopping, Local Events | Corporate, Spreadsheet & Enterprise | Creative Studios, Travel Planners, Big Game Releases |

### 2.3 Section Weight Calculation Formula
For an app $A$ belonging to categories $C_A$ at current localized hour $H \in [0, 23]$:

$$\text{Weight}(A, H) = \text{BaseScore}(A) \times \left(1 + \sum_{c \in C_A} \beta_{c}(H)\right)$$

Where:
- $\text{BaseScore}(A)$ is derived from historical quality and engagement metrics.
- $\beta_{c}(H) \in [-0.4, +0.6]$ is the daypart multiplier for category $c$ at hour $H$.
- A dampening coefficient ensures that evergreen top apps (e.g. WhatsApp, Spotify) are never hidden, but exploratory apps rise and fall contextually.

### 2.4 Visibility & Pruning Gates
To avoid sparse or visually repetitive carousels, each section adheres to strict minimum item criteria:
- **Hero Spotlight Banners**: Minimum 3 items, maximum 7 items. Must possess high-resolution 16:9 feature graphics.
- **Horizontal Carousels (e.g., Suggested for You)**: Minimum 4 items. If catalog count $< 4$, the section automatically collapses cleanly without layout shifts.
- **Categorical Two-Column Grids (You Might Like, Explore Hubs)**: Minimum 4 items (even numbers only to maintain grid balance).

---

## 3. Mathematical Calculations & Algorithms

### 3.1 App Similarity Scoring ($S_{\text{total}}$)

Similarity between a target app $A$ and candidate app $B$ is computed through a multi-factor hybrid function:

$$S(A, B) = w_1 \cdot S_{\text{embed}}(A, B) + w_2 \cdot S_{\text{jaccard}}(T_A, T_B) + w_3 \cdot S_{\text{co-install}}(A, B) + w_4 \cdot S_{\text{dev}}(A, B) - \text{Penalty}(B)$$

#### 1. Semantic Embedding Cosine Similarity ($S_{\text{embed}}$)
Extracted from Gemini `text-embedding-004` representations generated from `[title + short_description + category + feature_tags]`:

$$S_{\text{embed}}(A, B) = \frac{\vec{E}_A \cdot \vec{E}_B}{\|\vec{E}_A\| \|\vec{E}_B\|} \in [-1, 1]$$

#### 2. Tag & Category Jaccard Similarity ($S_{\text{jaccard}}$)
Measures strict structural categorization overlap:

$$S_{\text{jaccard}}(T_A, T_B) = \frac{|T_A \cap T_B|}{|T_A \cup T_B|}$$

#### 3. Co-installation Graph Association ($S_{\text{co-install}}$)
Calculated using Pointwise Mutual Information (PMI) on user download histories:

$$\text{PMI}(A, B) = \log_2 \left(\frac{P(A \cap B)}{P(A) \cdot P(B)}\right)$$

Normalized to $[0, 1]$ using a sigmoid scaling function.

#### 4. Developer / Publisher Affinity ($S_{\text{dev}}$)
$$S_{\text{dev}}(A, B) = \begin{cases} 1.0 & \text{if } \text{Dev}_A = \text{Dev}_B \\ 0.0 & \text{otherwise} \end{cases}$$

#### 5. Weights & Deduplication Penalty
- Recommended weight balance: $w_1 = 0.45, w_2 = 0.25, w_3 = 0.20, w_4 = 0.10$.
- $\text{Penalty}(B) = 1.0$ if app $B$ is already installed on the client device or has identical package bundle identifiers.

---

### 3.2 Related Searches & Query Expansion Algorithm

When a user searches for query $Q$, the search engine computes related search chips using three complementary vectors:

```
                  +----------------------------------------+
                  |            Input Query (Q)             |
                  +----------------------------------------+
                       /              |               \
                      v               v                v
          +-----------------+ +----------------+ +------------------+
          |  1. N-Gram &    | |  2. Markov Co- | |  3. Semantic     |
          |  Fuzzy Token    | |  occurrence    | |  Intent Cluster  |
          |  Overlap        | |  (Search Logs) | |  (Gemini Embed)  |
          +-----------------+ +----------------+ +------------------+
                      \               |                /
                       v              v               v
                  +----------------------------------------+
                  |      Catalog Feasibility Gate          |
                  |  (Must match >= 2 real apps in DB)     |
                  +----------------------------------------+
                                      |
                                      v
                  +----------------------------------------+
                  |   Top 3-5 Ranked Related Search Chips  |
                  +----------------------------------------+
```

1. **Token Co-occurrence in Successful Search Sessions**:
   If users searching for $Q$ frequently reformulate their query to $Q'$ within a 5-minute session and subsequently initiate a download, the transition probability is incremented:
   $$P(Q' \mid Q) = \frac{\text{Sessions}(Q \to Q' \text{ with install})}{\sum_k \text{Sessions}(Q \to Q_k)}$$

2. **Catalog Feasibility Gate**:
   A query suggestion is **strictly discarded** unless the store verifies that tapping it produces $\ge 2$ distinct, valid, downloadable applications. This completely prevents dead-end searches.

---

### 3.3 Trending Velocity & Acceleration Algorithm

Top charts reflect raw volume, but **Trending Searches & Apps** must surface fast-moving breakout titles before they saturate all-time leaderboards.

#### Exponential Time-Decayed Velocity ($V$)
$$V(A, t) = \sum_{i=1}^{N} e^{-\lambda (t - t_i)}$$

Where:
- $t_i$ is the timestamp of install/search event $i$.
- $\lambda = \frac{\ln(2)}{T_{1/2}}$ with a half-life $T_{1/2} = 12 \text{ hours}$.

#### Surge Acceleration Factor ($\alpha$)
To distinguish established giants (e.g. 50k installs every day = high velocity, zero surge) from emergent apps (e.g. 50 installs yesterday $\to$ 5,000 installs today = massive surge):

$$\alpha(A) = \frac{V_{\text{last 24h}}(A) - V_{\text{baseline 7d}}(A)}{\sigma_{\text{baseline}}(A) + \epsilon}$$

Apps are ranked in the Trending section based on a composite score:
$$\text{TrendingScore}(A) = \log_{10}(V(A) + 1) \times \alpha(A) \times \text{QualityRatingMultiplier}(A)$$

---

### 3.4 Quality & Rating Mathematical Guardrails (Wilson Score)

Raw average star rating ($R_{\text{avg}}$) is vulnerable to small sample bias (e.g. an app with one 5-star review outranking an app with 4.8 stars across 10,000 reviews). Prople Store calculates the **Lower Bound of the Wilson Score Interval** for ratings:

$$W = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

Where:
- $n$ = Total ratings count.
- $\hat{p}$ = Proportion of positive ratings (ratings $\ge 4.0$ normalized).
- $z$ = $1.96$ for 95% confidence level.

This guarantees that apps promoted on the Home and Explore tabs have statistically verified user satisfaction.

---

## 4. Download Lifecycle, Verifications & Countable Checkpoints

To ensure zero corrupted installations, tamper resistance, accurate metrics, and seamless background operations, the download manager follows a 5-checkpoint state machine.

### 4.1 Download State Machine

```
   +------------------+
   |   1. INITIATED   |  --> Request pre-flight token & storage quota check
   +------------------+
            |
            v
   +------------------+
   |  2. ALLOCATING   |  --> Pre-allocates local file buffer / CacheStorage
   +------------------+
            |
            v
   +------------------+
   |  3. STREAMING    |  --> Chunked transfer with byte-range resume support
   +------------------+      Emits countable progression: 25%, 50%, 75%, 100%
            |
            v
   +------------------+
   | 4. VERIFYING     |  --> SHA-256 integrity hash check against server manifest
   +------------------+
            |
            v
   +------------------+
   |  5. COMPLETED    |  --> Exchanges signed installation receipt with backend
   +------------------+      Atomically increments verified download count
```

### 4.2 Countable Checkpoints & Anti-Fraud Verification
A common vulnerability in application stores is client-side manipulation of download counters (e.g., repeatedly firing click handlers). Prople Store implements **Cryptographic Checkpoint Receipts**:

1. **Pre-Flight Token Issuance**:
   When the user clicks "Install", the client requests a single-use signed download token from `/api/downloads/token`:
   ```json
   {
     "appId": "app_photo_pro",
     "clientNonce": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
     "timestamp": 1774000000,
     "signature": "hmac_sha256_token"
   }
   ```
2. **Chunked Stream with Checkpoint Milestones**:
   The download worker tracks real bytes received. Telemetry events trigger strictly at **25%, 50%, 75%, and 100%**.
3. **Integrity Validation**:
   Upon reaching 100%, the browser calculates the binary SHA-256 hash using the Web Cryptography API (`crypto.subtle.digest('SHA-256', buffer)`).
4. **Receipt Validation & Counter Increment**:
   The client posts the verification signature back to `/api/downloads/confirm`. The server validates:
   - Token validity (not expired, not replayed).
   - Time elapsed (rejects instant 0ms "downloads").
   - Unique User/Device fingerprint deduplication (one counted download per unique user per app per version).
   Only after validation passes is the atomic database counter incremented:
   ```ts
   // Server-side atomic increment
   await db.collection('apps').doc(appId).update({
     downloadsCount: FieldValue.increment(1)
   });
   ```

### 4.3 Scheduled & Background Resilient Downloads
- **Network State Observer**: Uses the Network Information API (`navigator.connection`). Automatically pauses heavy downloads when transitioning from Wi-Fi to Metered Cellular unless user explicitly enables "Download over cellular".
- **IndexedDB Byte-Range Cache**: Incomplete downloads persist in IndexedDB chunks. If a user refreshes or closes the browser, the download resumes at the exact byte offset using HTTP `Range: bytes=X-` headers.

---

## 5. Caching Strategy & Redis Hierarchy

To achieve high throughput and protect database quotas, Prople Store utilizes a 4-tier caching pyramid:

```
+-------------------------------------------------------------+
| Layer 1: Browser In-Memory & Service Worker (Workbox / IDB) | -> 0ms (Instant)
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
| Layer 2: HTTP Edge CDN (Cloud Run / Cloudflare ETag Cache)   | -> 15-30ms
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
| Layer 3: Redis Cache (In-Memory K/V & Sorted Sets)          | -> 2-5ms
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
| Layer 4: Primary Firestore Database & Object Storage (GCS)  | -> 80-250ms
+-------------------------------------------------------------+
```

### 5.1 Redis Key Structure & TTL Matrix

| Key Pattern | Redis Type | Description | TTL | Invalidation Trigger |
|:---|:---|:---|:---|:---|
| `store:feed:home:{daypart}:{tab}` | `STRING` (JSON) | Pre-computed Home sections | 15 mins | New app release or daily cron |
| `store:feed:explore` | `STRING` (JSON) | Computed Explore sections | 30 mins | Catalog modification |
| `store:leaderboard:downloads:24h` | `ZSET` | Trending velocity scores | 5 mins | Sliding window score update |
| `store:leaderboard:top_charts:{cat}` | `ZSET` | Top free / Top grossing by category | 1 hour | Batch rating/download sync |
| `store:app:details:{appId}` | `STRING` (JSON) | Sanitized app metadata & review aggregate | 2 hours | App edit or new review posted |
| `store:search:cache:{hash(query)}` | `STRING` (JSON) | Top 20 query results | 1 hour | Daily catalog re-indexing |
| `store:sim:matrix:{appId}` | `ZSET` | Pre-calculated top 20 similar app IDs | 24 hours | Embedding re-clustering job |
| `store:user:session:{userId}` | `HASH` | User recent category views & install history | 7 days | User action |

### 5.2 Cache Invalidation & Event-Driven Write-Through
When an admin updates an app in the console or a new version is approved:
1. Document writes to Firestore.
2. An asynchronous event publishes to Redis Pub/Sub:
   - `DEL store:app:details:{appId}`
   - `DEL store:feed:home:*`
   - Recomputes vector entry in Redis HNSW index.
3. Edge CDN responds with `ETag` validation: clients receive `304 Not Modified` if no changes occurred, conserving egress bandwidth.

---

## 6. RAG (Retrieval-Augmented Generation) & Semantic Search

Traditional lexical search (keyword matching) fails for descriptive intent queries like:
- *"find apps to learn guitar chords with microphone feedback"*
- *"game like subway surfers but cyberpunk without annoying ads"*
- *"minimalist finance tracker with export to csv"*

Prople Store bridges this gap through a 3-step RAG pipeline:

```
                            User Intent Query
                                   |
                                   v
+---------------------------------------------------------------------+
| 1. QUERY UNDERSTANDING & EMBEDDING                                  |
|   - Spell normalization & query extraction                          |
|   - Generate query vector: Gemini text-embedding-004 (768-dim)      |
+---------------------------------------------------------------------+
                                   |
                                   v
+---------------------------------------------------------------------+
| 2. HYBRID RETRIEVAL (Vector Distance + Keyword Match)               |
|   - Redis Vector Search (HNSW Cosine top-K, K=50)                   |
|   - Exact / Prefix Inverted Index (BM25 lexical, K=50)              |
|   - Reciprocal Rank Fusion (RRF) to merge candidate lists           |
+---------------------------------------------------------------------+
                                   |
                                   v
+---------------------------------------------------------------------+
| 3. RAG CONTEXT ASSEMBLY & RERANKING                                 |
|   - Feed top candidates + query context into Gemini 2.5 Flash       |
|   - Prompt: Verify feature fulfillment, safety, and no-ad constraint|
|   - Output: Ranked App IDs with highlighted matching justification  |
+---------------------------------------------------------------------+
                                   |
                                   v
             Client Results Stream (Sub-350ms with fast path)
```

### 6.1 Fast Path vs. Deep RAG Routing
To optimize latency and cost:
- **Fast Path (Lexical/Cached)**: If query matches known title (`app.name.toLowerCase() == query`), publisher code, or exact category name $\to$ Return cached indexed result immediately ($<25\text{ms}$).
- **Deep RAG Path**: Triggered only when:
  - Query word count $\ge 3$
  - Lexical results count $< 3$
  - Query contains conversational cues (*"best", "similar to", "how to", "free without", "like"*)

---

## 7. Implementation Roadmap & Execution Checklist

| Milestone | Scope | Deliverables | Target Latency / SLA |
|:---|:---|:---|:---|
| **Phase 1: Algorithmic Distribution** | Online client/server distribution services | * Time-of-day affinity scheduler (`appDistributionAlgorithm.ts`)<br>* Wilson score ratings calculation (`appMetricsAlgorithm.ts`)<br>* Dynamic category pruning logic | $< 100\text{ms}$ client render |
| **Phase 2: Checkpoint Download Engine** | Resilient download state machine | * Pre-flight token API (`/api/downloads/token`)<br>* SHA-256 client verification worker<br>* Atomic database incrementing with deduplication receipts | 100% verified download authenticity |
| **Phase 3: Redis & Tiered Caching** | Infrastructure performance optimization | * Redis Docker / Upstash integration for sorted sets<br>* Top Charts & Trending leaderboards sliding window<br>* Client-side IndexedDB query cache | $< 25\text{ms}$ feed response |
| **Phase 4: Semantic RAG Search** | Natural language discovery engine | * Offline Gemini vector embedding batch pipeline<br>* Vector distance candidate retriever<br>* Hybrid fallback & smart conversational query expansion | $< 400\text{ms}$ conversational search |

---

*This document serves as the architectural contract for future implementation tasks across backend services, algorithmic models, and user experience touchpoints.*
