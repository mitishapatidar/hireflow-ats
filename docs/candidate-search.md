# HireFlow ATS — Candidate Search Engine & Performance Benchmarking

## 1. Search Engine Architecture
HireFlow implements a high-throughput, multi-attribute candidate search engine designed to scan tens of thousands of talent profiles with sub-second response times.

### Supported Search Vectors
1. **Candidate Full Name & Code:** Substring and prefix matching (`name`, `code`).
2. **Email Address:** Exact and partial domain matching (`email`).
3. **Current Title & Company:** Career history matching (`currentTitle`, `currentCompany`).
4. **Technical Skills:** Array element matching across candidate skill sets (`skills hasSome [query]`).
5. **Candidate Tags:** Relational tag matching (`tags some { name contains query }`).

---

## 2. Multi-Predicate Filter Matrix
The candidate query engine combines search terms with structured relational filters:

| Filter | Type | Matching Logic | Default |
|---|---|---|---|
| `search` | String | Case-insensitive multi-attribute search (OR) | `undefined` |
| `status` | Enum | Exact match on latest application status | All stages |
| `jobId` | String | Application relation match (`applications some { jobId }`) | All jobs |
| `ownerId` | String | Assigned recruiter match (`ownerId`) | All recruiters |
| `location` | String | Case-insensitive substring match | All locations |
| `includeArchived` | Boolean | Toggles `isArchived` filter (`false` = active only) | `false` |

---

## 3. Performance Benchmark & SLA Verification

### SLA Requirement
- **Target SLA:** Multi-predicate search over 10,000 candidate profiles under **300 ms** (Target: < 50 ms).

### Automated Vitest Benchmark Results (`apps/api/src/benchmark.test.ts`)
A dedicated automated benchmark suite verifies index performance and algorithmic complexity:

```
 RUN  v2.1.9 C:/HireFlow ATS project/apps/api

stdout | src/benchmark.test.ts > Performance Benchmark: 10,000 Candidates Search (< 300 ms SLA)
[Benchmark] 10,000 candidates multi-predicate search took 4.23 ms. Matches: 1000

 ✓ src/benchmark.test.ts (3 tests) 10ms
   ✓ performs indexed full-text candidate search under 300 ms SLA (Target: < 50ms) (4.23 ms)
   ✓ handles empty query results in sub-millisecond time (0.85 ms)
   ✓ enforces memory bounds during pagination over 10,000 records (1.12 ms)
```

### Result Summary
- **Execution Time:** **4.23 ms** for 10,000 records with compound predicates.
- **SLA Margin:** Exceeds the 300 ms SLA requirement by **98.6%**.
- **Memory Footprint:** Strict pagination limits (`take: limit`, `skip: offset`) prevent memory ballooning during large scale searches.
