# Cutting Optimizer Benchmark Report — Mobilius

## 1. Test Environment

- **Processor**: Intel(R) Xeon(R) CPU E5-1650 v4 @ 3.60GHz (6 cores, 12 threads)
- **OS**: Linux Ubuntu x86_64 (Kernel 7.0.0-38-generic)
- **Runtime**: Node.js v22.22.1 / Vitest v5.0.4
- **Date**: October 19, 2026

---

## 2. Benchmark Results Table

Measurements taken with realistic 2750 x 1830 mm melamine sheets and standard kerf/trim settings:

| Test Case | Parts Count | Sheets Used | Lower Bound | Gap to Bound | Utilization (%) | Passes | Elapsed Time (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Kitchen Base 80cm** | 8 | 1 | 1 | 0 | 47.0% | 19 | 17 ms |
| **2. Kitchen Wall Cabinet 80cm** | 8 | 1 | 1 | 0 | 39.2% | 18 | 1 ms |
| **3. 2-Door Wardrobe** | 10 | 2 | 2 | 0 | 76.2% | 28 | 1 ms |
| **4. 3-Door Wardrobe with Divider** | 14 | 3 | 3 | 0 | 70.5% | 38 | 1 ms |
| **5. Office Desk with Pedestal** | 10 | 1 | 1 | 0 | 71.4% | 23 | < 1 ms |
| **6. Tall Bookshelf** | 9 | 1 | 1 | 0 | 51.8% | 22 | < 1 ms |
| **7. 4-Drawer Chest** | 20 | 1 | 1 | 0 | 66.4% | 41 | 1 ms |
| **8. Bathroom Vanity 90cm** | 10 | 1 | 1 | 0 | 45.1% | 22 | < 1 ms |
| **9. TV Media Console 180cm** | 9 | 1 | 1 | 0 | 58.1% | 20 | < 1 ms |
| **10. Shoe Cabinet (Grain NONE)** | 10 | 1 | 1 | 0 | 41.6% | 23 | < 1 ms |
| **11. Synthetic Exact Tile Grid** | 16 | 2 | 2 | 0 | 50.0% | 40 | < 1 ms |
| **12. Synthetic Strips Set** | 18 | 2 | 1 | 1 | 47.8% | 38 | 23 ms |
| **13. Scale Test (150 Parts)** | 150 | 6 | 5 | 1 | 78.2% | 258 | 49 ms |

---

## 3. Comparison with Quality Targets (Section 8.5)

| Target | Requirement | Measured Result | Status |
| :--- | :--- | :--- | :---: |
| **Sheet Optimality** | $\le \text{lowerBound} + 1$ in $\ge 95\%$ of realistic sets | **100%** (10 of 10 reached lower bound exactly: gap = 0) | **PASS** |
| **Execution Speed** | $\le 3000$ ms for 150 parts | **49 ms** (61x faster than target) | **PASS** |
| **Pass Minimization** | `MIN_CUTS` passes $\le$ `MIN_MATERIAL` passes in 100% of sets | **100%** verified across multi-objective alternatives | **PASS** |
| **Cooperative Cancellation** | Web Worker abort terminates in $\le 200$ ms | **2 ms** measured | **PASS** |
| **Mathematical Validity** | `validateLayout` passes on 100% of generated layouts | **100%** pass across all test suites | **PASS** |
