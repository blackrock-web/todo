import { Exam, TaskPriority } from "../types";

/**
 * GATE CSE 2027 Preset
 * ---------------------------------------------------------------------------
 * Source material:
 *  1. "Parakram GATE 2027 Batch B (Hinglish)" complete lecture planner (PW).
 *  2. "GATE CSE Preparation: Data-Driven Tensorix Framework" — 7-month
 *     ultra-aggressive roadmap (July 1, 2026 -> Feb 15, 2027), including
 *     phase hour-budgets, weekly milestones, and the 65/35 First-Contact vs.
 *     Competitive split.
 *  3. User-supplied college backlog (pending recorded lectures still owed).
 *
 * Hour-conversion assumption for the college backlog:
 *   Each lecture is nominally 2 hours. The user watches most — but not all —
 *   of them at 2x speed. This preset assumes a 70/30 mix (70% at 2x -> 1 hr,
 *   30% at 1x -> 2 hrs), giving a blended average of 1.3 hrs/lecture. Adjust
 *   the `estimatedHours` fields directly in the app if your actual mix differs.
 */

interface SyllabusTopicSeed {
  id: string;
  name: string;
  completed: boolean;
  confidence: number;
  estimatedHours?: number;
}

interface SyllabusUnitSeed {
  id: string;
  name: string;
  topics: SyllabusTopicSeed[];
}

const HRS_PER_LECTURE_BLENDED = 1.3; // 70% @2x (1hr) + 30% @1x (2hr)

function lecHrs(lectures: number): number {
  return Math.round(lectures * HRS_PER_LECTURE_BLENDED * 2) / 2; // round to nearest 0.5
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function topic(name: string, hours: number | undefined, confidence = 3): SyllabusTopicSeed {
  return { id: nextId("topic"), name, completed: false, confidence, estimatedHours: hours };
}

export function buildGate2027Units(): SyllabusUnitSeed[] {
  return [
    {
      id: nextId("unit"),
      name: "🎓 College Backlog — Pending Lectures (Clear First)",
      topics: [
        topic(`Discrete Math: Graph Theory (18 lectures)`, lecHrs(18)),
        topic(`Discrete Math: Mathematical Logic (9 lectures)`, lecHrs(9)),
        topic(`Discrete Math: Set Theory (13 lectures)`, lecHrs(13)),
        topic(`Discrete Math: Combinatorics (9 lectures)`, lecHrs(9)),
        topic(`DSA: Core Lecture Series (20 lectures)`, lecHrs(20)),
        topic(`DAA: Analysis of Algorithms (12 lectures)`, lecHrs(12)),
        topic(`DAA: Sorting Algorithms (3 lectures)`, lecHrs(3)),
        topic(`DAA: Divide & Conquer (8 lectures)`, lecHrs(8)),
        topic(`DAA: Greedy Method (8 lectures)`, lecHrs(8)),
        topic(`DAA: Dynamic Programming (7 lectures)`, lecHrs(7)),
        topic(`DBMS: Relational Model & Normal Forms (9 lectures)`, lecHrs(9)),
        topic(`DBMS: Queries / SQL (13 lectures)`, lecHrs(13)),
        topic(`DBMS: ER Model (2 lectures)`, lecHrs(2)),
        topic(`DBMS: Indexing (7 lectures)`, lecHrs(7)),
        topic(`DBMS: Transactions & Concurrency (11 lectures)`, lecHrs(11)),
        topic(`Digital Logic: Boolean Theorems (15 lectures)`, lecHrs(15)),
        topic(`Digital Logic: Combinational Circuits (14 lectures)`, lecHrs(14)),
        topic(`Digital Logic: Sequential Circuits (12 lectures)`, lecHrs(12)),
        topic(`Digital Logic: Miscellaneous Topics (10 lectures)`, lecHrs(10)),
        topic(`Linear Algebra: Basics of Matrices (3 lectures)`, lecHrs(3)),
        topic(`Linear Algebra: Rank & System of Equations (5 lectures)`, lecHrs(5)),
        topic(`Linear Algebra: Eigenvalues & Eigenvectors (5 lectures)`, lecHrs(5)),
        topic(`Probability & Stats: Permutations & Combinations (6 lectures)`, lecHrs(6)),
        topic(`Probability & Stats: Probability (lecture count TBD — update once known)`, 0),
        topic(`Computer Networks: Introduction (4 lectures)`, lecHrs(4)),
        topic(`Computer Networks: Network Delays (4 lectures)`, lecHrs(4)),
        topic(`Computer Networks: Flow Control (4 lectures)`, lecHrs(4)),
      ]
    },
    {
      id: nextId("unit"),
      name: "🎯 Phase 1: Foundation Crash Course (Weeks 1-8 | Jul-Aug 2026)",
      topics: [
        topic("Discrete Mathematics — Full First Contact (7-month compressed target)", 110),
        topic("Digital Logic — Full First Contact (7-month compressed target)", 75),
        topic("Data Structures — First Contact Start (Weeks 5-18, first slice)", 117),
        topic("Programming Fundamentals (C/Java, ongoing)", 40, 3),
        topic("⭐ Milestone — Week 8 Mock Test (Target 65-80/160)", 0, 3),
      ]
    },
    {
      id: nextId("unit"),
      name: "📘 Phase 2: Core Theory Sprint (Weeks 9-20 | Sep-Nov 2026)",
      topics: [
        topic("Operating Systems — First Contact (Priority #1, must finish EARLY by Wk20)", 104),
        topic("Computer Architecture — First Contact", 77),
        topic("Theory of Computation — First Contact", 71),
        topic("Compiler Design — First Contact", 56),
        topic("Databases — First Contact", 65),
        topic("Computer Networks — First Contact (start late to compress)", 72),
        topic("⭐ Milestone — Week 12 Mock (Target 85-100/160)", 0, 3),
        topic("⭐ Milestone — Week 16 Mock (Target 100-115/160)", 0, 3),
        topic("🚨 ABSOLUTE DEADLINE — Week 20: 95% First Contact complete (Target 110-125/160)", 0, 3),
      ]
    },
    {
      id: nextId("unit"),
      name: "⚡ Phase 3: Competitive Blitz (Weeks 21-30 | Dec 2026-Jan 2027)",
      topics: [
        topic("Operating Systems — Competitive / Numerical drills", 56),
        topic("Data Structures — Competitive / LeetCode Medium-Hard", 63),
        topic("Computer Networks — Competitive / Subnetting + PYQs", 38),
        topic("Databases — Competitive / SQL + Normalization drills", 35),
        topic("Discrete Mathematics — Competitive revision", 33),
        topic("Computer Architecture — Competitive / Numerical drills", 33),
        topic("Compiler Design — Competitive / Parsing drills", 24),
        topic("Theory of Computation — Competitive revision", 24),
        topic("PYQ Solving — 10-year compilation (all subjects)", 40),
        topic("⭐ Milestone — Week 22 Mock (Target 125-135/160)", 0, 3),
        topic("⭐ Milestone — Week 24 Mock (Target 130-140/160)", 0, 3),
        topic("⭐ Milestone — Week 26 Mock (Target 135-145/160)", 0, 3),
        topic("⭐ Milestone — Week 28 Mock (Target 135-145/160)", 0, 3),
        topic("⭐ Milestone — Week 30 Mock (Target 140-150/160)", 0, 3),
      ]
    },
    {
      id: nextId("unit"),
      name: "🏁 Final Month: Exam Window & Recovery (Weeks 31-35 | Feb 2027)",
      topics: [
        topic("Final Revision — Formula cards + weak-area sharpening", 20),
        topic("Light Mocks (only if your exam slot is Feb 8-15)", 10),
        topic("🎯 GATE 2027 EXAM WINDOW (Feb 1-15, 2027)", 0, 3),
        topic("Rest & Mental Preparation (non-negotiable)", 0, 3),
      ]
    }
  ];
}

export const GATE_2027_NOTES = `GATE CSE 2027 — Ultra-Aggressive 7-Month Plan (Tensorix Framework)

EXECUTIVE SUMMARY
Target Exam: GATE 2027 (Feb 1-15, 2027)
Prep Start: July 1, 2026 | Duration: 7 months (HIGH RISK, non-negotiable intensity)
Registration: Sept 1-15, 2026 | Admit Card: Early Jan 2027 | Result: Late March 2027
Expected Study Hours: ~1,500 hrs total | Weekly Commitment: 45-50 hrs/week

REALITY CHECK: This is a high-risk, high-reward aggressive strategy. Requires 45+ hrs/week
consistently, with zero buffer for illness or emergencies. If you fall behind by more than
2 weeks on any First Contact deadline, escalate immediately (compress breadth, not OS/DSA depth).

65/35 SPLIT: 65% of time -> First Contact (Weeks 1-20) | 35% -> Competitive Phase (Weeks 21-30)

SUBJECT WEIGHTAGE PRIORITY (GATE CSE)
1. Data Structures & Algorithms — 12-14% (highest ROI)
2. Operating Systems — 8-10% (critical depth, numerical-heavy)
3. Computer Networks — 8-10%
4. Computer Architecture — 8-10%
5. Discrete Mathematics — 6-8% (foundation for everything)
6. Databases — 5-7%
7. Compiler Design — 5-7%
8. Theory of Computation — 5-7%
9. Digital Logic — 5-7% (light touch, already covered early)
10. Software Engineering / Info Security — 3-5% (quick wins only)

HARD DEADLINES (NO BUFFER)
Discrete Math: Week 4 | Digital Logic: Week 8 | Computer Architecture: Week 16
Theory of Computation: Week 16 | Data Structures: Week 18
Databases / Networks / Compiler Design: Week 20 | Operating Systems: Week 20 (finish EARLY)

CHECKPOINT RULE (every Sunday): if behind schedule, escalate same week — don't wait.
Week 24 (Dec 31, 2026) checkpoint: must score 125+/160 in mocks to stay on track.

ASSUMPTION NOTE: College backlog lecture hours were estimated at 1.3 hrs/lecture
(blend of 2x-speed and normal-speed viewing). Adjust individual topic hour estimates
in the Syllabus tab if your real pace differs.`;

export function buildGate2027Exam(userId: string, generateId: () => string): Exam {
  const units = buildGate2027Units();

  const extraMeta = {
    examTime: "09:00",
    officialWebsite: "",
    notesText: GATE_2027_NOTES,
    registrationDeadline: "2026-09-15",
    admitCardDate: "2027-01-05",
    resultDate: "2027-03-20",
    mockTests: [] as any[]
  };

  return {
    id: generateId(),
    userId,
    name: "GATE CSE 2027 (7-Month Ultra-Aggressive Plan)",
    examDate: "2027-02-08",
    targetScore: 150,
    priority: TaskPriority.CRITICAL,
    syllabusJson: JSON.stringify({ units, extraMeta }),
    completionPercent: 0,
    color: "#b5179e",
    createdAt: new Date().toISOString()
  };
}
