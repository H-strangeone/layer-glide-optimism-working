---

## What We Built and Why

### BM25F — not flat BM25, not TF-IDF
BM25F extends BM25 with field weights. "Python" in a job title is a fundamentally
stronger signal than "Python" buried in a 500-word description. We weight title×3,
description×1, company×0.5. This is what Elasticsearch does internally.

**Why not embeddings?** No API key available. BM25F is battle-tested, deterministic,
explainable, and achieves 80% of the quality for structured queries. Embeddings would
help with purely semantic queries ("someone like a Razorpay engineer") but hurt
explainability. We bridge the gap with query expansion.

**Why not a database?** The corpus is static (no new jobs at runtime). Loading 14k jobs
into an in-memory inverted index at startup gives sub-millisecond query time with no
network roundtrip. Elasticsearch is essentially this, distributed.

### Query expansion via synonym map
BM25 is lexical — exact token matching only. "devops" won't match "Infrastructure Engineer."
We built a domain-specific synonym map: "devops" → [kubernetes, docker, terraform, ci/cd].
Company intelligence layer: "razorpay" → [payments, fintech, high-scale, distributed].
This bridges vocabulary gaps without semantic embeddings.

### Negative signal detection
Pattern: `"not just X"`, `"not only X"`, `"beyond X"`.
Implementation: regex extraction of the term X, then check if job uses X without depth
signals (architecture, design, system, scale). If shallow match → penalize by 0.20.
This handles: "not just yaml pushers", "not just notebooks", "not just a React dev."

### Career signal inference
Job descriptions contain ownership language even without structured data.
"led team", "owned the platform", "designed the architecture" → infer seniority/ownership.
Used to boost results for vague queries like "founding engineer type generalist."

### Score normalization before fusion
BM25 outputs range 0–60+. Structured scores range -0.5 to 1.0. Direct addition would
let BM25 dominate always. We normalize both to [0,1] independently, then fuse at 0.6/0.4.
The 0.6 weight on BM25 reflects that keyword relevance is the primary signal; structured
adds precision.

### Confidence scoring
Measures agreement between BM25 and structured scorer.
Both >0.6 → "high" (both signals agree — trustworthy result).
Mixed → "medium" (one signal carrying it — inspect manually).
Both weak → "low" (borderline match).

---

## Sample Query Results (Top 5 each)

### Q1: "senior backend engineer, 4+ years, Python and Go, Bangalore"
Parsed: skills=[python, go], location=Bangalore, senior=true, minYears=4

| Rank | Title | Company | Score | Why |
|------|-------|---------|-------|-----|
| 1 | Senior Backend Engineer (Golang) | Sketch Brahma | 0.913 | Title match senior+backend+golang, desc has python+bangalore, location+skills+level all matched |
| 2 | Senior Python Developer | Shyam Future Tech | 0.911 | Highest BM25 (python density), senior+skills matched, scale/production career signals |
| 3 | Software Engineer - Python/DevOps | Williams-Sonoma | 0.890 | Strong python match, leadership+ownership+scale career signals |
| 4 | Senior Back End Developer | Angel and Genie | 0.881 | python+go in desc, senior level, architecture+scale signals |
| 5 | Back End Developer (Python+AIML) | Ubique Systems | 0.869 | Bangalore location match, python match, production signal |

### Q2: "someone who can own our payments infra, has worked at a fintech before"
Parsed: no skills extracted, no location (vague query)

| Rank | Title | Company | Score | Why |
|------|-------|---------|-------|-----|
| 1 | Associate Manager, SME Sales | Razorpay | 0.800 | BM25-dominant: payments+fintech+razorpay tokens hit, company intelligence expansion |
| 2 | Product Designer II | Razorpay | 0.772 | Same expansion, lower BM25 |
| 3 | Senior Manager Growth Marketing | Razorpay | 0.728 | payments+fintech tokens, ownership career signal |
| 4 | Senior Product Manager-UPI | BharatPe | 0.656 | UPI+payments+fintech direct keyword hits |
| 5 | Nodejs Developer (Microservices) | Flyweis | 0.599 | razorpay+stripe+gateway in desc, backend role |

**Note on Q2**: This query fails to filter engineering roles. "payments infra" implies backend
engineering but our system has no role-type classifier. Razorpay jobs dominate because the
company name appears in many job descriptions as a payment provider example. This is a
known failure case (detailed below).

### Q3: "ML engineer who's done production deployment, not just notebooks"
Parsed: skills=[machine learning], negatives=[notebooks]

| Rank | Title | Company | Score | Why |
|------|-------|---------|-------|-----|
| 1 | Ai/Ml Engineer | Revin Krishi | 1.000 | ML+production+deployment in title+desc, negative penalty not triggered (has depth signals) |
| 2 | AI/ML Engineer - MLOps | UPS | 0.980 | MLOps = production deployment by definition, strong keyword match |
| 3 | Software Engr II | Honeywell | 0.965 | production+deployment in desc, ML skills match |
| 4 | Senior ML Engineer (Ops) | Gather AI | 0.959 | "Ops" suffix signals production focus, ownership signal |
| 5 | Machine Learning Engineer | Incept Labs | 0.947 | Direct title match, production+scale signals |

### Q4: "fresh grad, strong fundamentals, has built real side projects"
Parsed: intern=true

| Rank | Title | Company | Score | Why |
|------|-------|---------|-------|-----|
| 1 | Back End Developer Intern | Inficore Soft | 1.000 | "strong fundamentals, real side projects" exact phrase match in desc, intern level match |
| 2 | Frontend Developer Intern | Wake Up Whistle | 0.897 | intern level, "fresh, real, projects" tokens hit |
| 3 | Social Media Manager - Internship | ThemCurves | 0.856 | intern level matched, "built real projects" in desc |
| 4 | Junior Back End Developer Intern | Skillzenloop | 0.844 | intern, "strong real side projects" |
| 5 | Node.js Developer Intern | Inficore Soft | 0.820 | intern level, fundamentals+projects keywords |

### Q9: "founding engineer type generalist, 2-5 yrs, has startup experience"
Parsed: startup=true, years=[2-5]

| Rank | Title | Company | Score | Why |
|------|-------|---------|-------|-----|
| 1 | Engineering Manager | Gloroots AI | 0.920 | startup signal, leadership+scale career signals, years match |
| 2 | Founding AI Research Engineer | ConsultBae | 0.884 | "founding engineer" exact title match, startup+founding career signals |
| 3 | Technical Lead | Lane | 0.877 | founding+startup in desc, architecture+founding signals |
| 4 | Founding Engineer | Tattva Twins | 0.853 | Perfect title match, multiple career signals |
| 5 | Business Development Manager | Relay AI | 0.834 | startup+founding+seed in desc |

---

## Where It Breaks

### Failure 1: Vague role-intent queries return non-engineering jobs
**Query**: "someone who can own our payments infra"
**Problem**: Rank 1 is "Associate Manager SME Sales @ Razorpay." The system has no
role-type classifier. It detects "payments" and "fintech" via expansion, which causes
all Razorpay jobs to score high on BM25 regardless of the role.
**Root cause**: No job-role ontology. We can't distinguish engineering vs sales vs marketing
roles from the query.
**Fix**: Add a role-type signal extractor. "infra", "backend", "engineer" in the query
should add a required constraint on job title containing engineering terms. Alternatively,
pre-classify all jobs into role categories (Engineering/Product/Design/Sales) using keyword
rules and filter before ranking.

### Failure 2: "IC to lead and back to IC" — concept has no vocabulary
**Query**: "someone who's gone from IC to lead and back to IC"
**Problem**: Top results include hardware IC (Integrated Circuit) jobs — "Senior Analog IC
Designer @ Texas Instruments." The acronym "IC" is ambiguous. In software, IC = Individual
Contributor. In hardware, IC = Integrated Circuit.
**Root cause**: Pure lexical matching can't disambiguate homonyms. The query has no other
strong signals to anchor the software context.
**Fix**: Context-based disambiguation. If the query also contains "lead", "engineer",
"software" → interpret IC as Individual Contributor. If the query contains "circuit",
"analog", "VLSI" → IC = Integrated Circuit. A simple co-occurrence rule would fix this.

### Failure 3: "senior person, not a job hopper" — inferred constraint, no data
**Query**: "senior person who's been at one company for 3+ years, not a job hopper"
**Problem**: Rank 1 is "Senior Software Engineer @ Hopper" (the travel company). BM25
matches "Hopper" the company name as if it were the concept of "job hopper."
**Root cause**: Job descriptions don't contain tenure information. We'd need candidate
resumes to check how long someone has stayed at companies. This constraint is fundamentally
unmatchable on the job side — it's a candidate attribute, not a job attribute.
**Fix**: This query direction should be candidate search, not job search. In job search,
the closest proxy is detecting if job descriptions mention "long-term", "stable team",
"low turnover" — rare signals. A better fix is a candidate search mode for
tenure-based queries.

---

## If We Had a Week

### Day 1-2: Semantic embeddings layer
Replace or augment BM25 with sentence embeddings (via a local model like
`all-MiniLM-L6-v2` from HuggingFace, which runs CPU-only). Pre-embed all 14k job
descriptions offline. At query time, embed the query and compute cosine similarity.
This handles "someone like a Razorpay engineer" and other semantic queries that BM25
misses entirely.

Fusion strategy: Reciprocal Rank Fusion (RRF) over BM25 ranks and embedding ranks.
RRF is more robust than weighted sum because it's rank-based — outlier scores don't
distort results.

### Day 3: Role-type classifier
Pre-classify all 14k jobs into: Engineering / Product / Design / Data / Sales / Marketing /
Operations. Use keyword rules (title contains "engineer", "developer", "SDE" → Engineering).
Add role-type extraction to the query parser ("payments infra" → Engineering role required).
Apply as a hard pre-filter before BM25 scoring.

### Day 4: Redis cache layer
Replace `sync.Map` with Redis for:
- Persistence across server restarts (cache survives deploys)
- Shared cache across multiple server instances (horizontal scaling)
- LRU eviction policy (Redis handles memory pressure automatically)
- Cache analytics (hit rate, popular queries) via Redis `INFO`

Cache key: SHA256(normalized_query). TTL: 5 minutes.

### Day 5: Per-client rate limiting + API keys
Current rate limiter is global. Add per-IP token bucket using
`map[string]*rate.Limiter` keyed by `X-Forwarded-For`. Add API key auth so
enterprise clients get higher rate limits. Implement request queuing with
`rate.Wait()` for non-realtime clients (batch processing).

### Day 6: Query feedback loop
Log every query, result set, and whether the user clicked a result (via a
`/feedback` endpoint). Use click-through rate (CTR) as a relevance signal.
Queries with high CTR on result #1 → system is working. Queries with CTR on
result #8 → system is failing for that query type. Use this data to tune
fusion weights (currently hardcoded at 0.6/0.4).

### Day 7: Candidate search mode
Use the same BM25F infrastructure to search candidates by resume text against
a job description query. This handles tenure-based queries ("not a job hopper")
which require candidate-side data. The system architecture already supports this —
`loader.LoadCandidates()` exists. The missing piece is an equivalent candidate index.
