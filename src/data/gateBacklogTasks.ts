import { Task, Subtask, TaskPriority, TaskStatus } from "../types";

/**
 * GATE 2027 — College Lecture Backlog, modeled as a real hierarchical Task tree:
 *
 *   🎓 GATE 2027 — College Lecture Backlog          (main Task)
 *     ├─ Discrete Mathematics — 49 lectures pending  (child Task, parentId = main task)
 *     │    ├─ Graph Theory — 18 lectures             (Subtask)
 *     │    ├─ Mathematical Logic — 9 lectures        (Subtask)
 *     │    └─ ...
 *     ├─ DSA (Data Structures) — 20 lectures pending
 *     ├─ DAA (Algorithms) — 38 lectures pending
 *     ├─ DBMS — 42 lectures pending
 *     ├─ Digital Logic — 51 lectures pending
 *     ├─ Linear Algebra — 13 lectures pending
 *     ├─ Probability & Statistics — 6+ lectures pending (partial count)
 *     └─ Computer Networks (Intro) — 12 lectures pending
 *
 * Each subject Task's progress is driven by how many of its Subtasks are
 * checked off (the app's existing subtask-progress UI picks this up
 * automatically — no extra wiring needed).
 */

interface SubjectSeed {
  subjectTitle: string;
  totalLectures: number;
  priority: TaskPriority;
  topics: { name: string; lectures: number | null }[]; // null = count not yet known (TBD)
}

const SUBJECTS: SubjectSeed[] = [
  {
    subjectTitle: "Discrete Mathematics",
    totalLectures: 49,
    priority: TaskPriority.HIGH,
    topics: [
      { name: "Graph Theory", lectures: 18 },
      { name: "Mathematical Logic", lectures: 9 },
      { name: "Set Theory", lectures: 13 },
      { name: "Combinatorics", lectures: 9 },
    ]
  },
  {
    subjectTitle: "DSA (Data Structures)",
    totalLectures: 20,
    priority: TaskPriority.CRITICAL,
    topics: [
      { name: "Core DSA Lecture Series", lectures: 20 },
    ]
  },
  {
    subjectTitle: "DAA (Design & Analysis of Algorithms)",
    totalLectures: 38,
    priority: TaskPriority.HIGH,
    topics: [
      { name: "Analysis of Algorithms", lectures: 12 },
      { name: "Sorting Algorithms", lectures: 3 },
      { name: "Divide & Conquer", lectures: 8 },
      { name: "Greedy Method", lectures: 8 },
      { name: "Dynamic Programming", lectures: 7 },
    ]
  },
  {
    subjectTitle: "DBMS",
    totalLectures: 42,
    priority: TaskPriority.HIGH,
    topics: [
      { name: "Relational Model & Normal Forms", lectures: 9 },
      { name: "Queries (SQL)", lectures: 13 },
      { name: "ER Model", lectures: 2 },
      { name: "Indexing", lectures: 7 },
      { name: "Transactions & Concurrency", lectures: 11 },
    ]
  },
  {
    subjectTitle: "Digital Logic",
    totalLectures: 51,
    priority: TaskPriority.MEDIUM,
    topics: [
      { name: "Boolean Theorems", lectures: 15 },
      { name: "Combinational Circuits", lectures: 14 },
      { name: "Sequential Circuits", lectures: 12 },
      { name: "Miscellaneous Topics", lectures: 10 },
    ]
  },
  {
    subjectTitle: "Linear Algebra",
    totalLectures: 13,
    priority: TaskPriority.MEDIUM,
    topics: [
      { name: "Basics of Matrices", lectures: 3 },
      { name: "Rank & System of Equations", lectures: 5 },
      { name: "Eigenvalues & Eigenvectors", lectures: 5 },
    ]
  },
  {
    subjectTitle: "Probability & Statistics",
    totalLectures: 6, // + TBD
    priority: TaskPriority.MEDIUM,
    topics: [
      { name: "Permutations & Combinations", lectures: 6 },
      { name: "Probability (lecture count TBD — update once known)", lectures: null },
    ]
  },
  {
    subjectTitle: "Computer Networks (Intro)",
    totalLectures: 12,
    priority: TaskPriority.MEDIUM,
    topics: [
      { name: "Introduction", lectures: 4 },
      { name: "Network Delays", lectures: 4 },
      { name: "Flow Control", lectures: 4 },
    ]
  },
];

export const GATE_BACKLOG_TOTAL_LECTURES = SUBJECTS.reduce((sum, s) => sum + s.totalLectures, 0);

function nowIso(): string {
  return new Date().toISOString();
}

export function buildGateBacklogTaskTree(userId: string, generateId: () => string, dueDate: string): {
  mainTask: Task;
  childTasks: Task[];
  subtasksByTaskId: Record<string, Subtask[]>;
} {
  const mainTaskId = generateId();

  const mainTask: Task = {
    id: mainTaskId,
    userId,
    title: `🎓 GATE 2027 — College Lecture Backlog (${GATE_BACKLOG_TOTAL_LECTURES}+ lectures pending)`,
    description: "All pending recorded college lectures that must be cleared before/alongside GATE 2027 first-contact study. Each subject below is a subtask-tracked child task; check off each topic as you finish watching its lectures.",
    notes: "Generated from your typed backlog list. Lecture counts are as you reported them; the 'Probability' topic has no count yet — update it once known.",
    startDate: nowIso().split("T")[0],
    dueDate,
    dueTime: "23:59",
    parentId: null,
    priority: TaskPriority.CRITICAL,
    status: TaskStatus.IN_PROGRESS,
    category: "GATE 2027",
    subCategory: "College Backlog",
    tags: ["gate2027", "backlog", "lectures"],
    isFavorite: true,
    isPinned: true,
    recurrence: "none",
    isDeleted: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const childTasks: Task[] = [];
  const subtasksByTaskId: Record<string, Subtask[]> = {};

  for (const subject of SUBJECTS) {
    const childId = generateId();

    childTasks.push({
      id: childId,
      userId,
      title: `${subject.subjectTitle} — ${subject.totalLectures}${subject.topics.some(t => t.lectures === null) ? "+" : ""} lectures pending`,
      description: `Backlog lectures for ${subject.subjectTitle}. Check off each topic below as its lectures are fully watched.`,
      notes: "",
      startDate: nowIso().split("T")[0],
      dueDate,
      dueTime: "23:59",
      parentId: mainTaskId,
      priority: subject.priority,
      status: TaskStatus.TODO,
      category: "GATE 2027",
      subCategory: "College Backlog",
      tags: ["gate2027", "backlog", "lectures"],
      isFavorite: false,
      isPinned: false,
      recurrence: "none",
      isDeleted: false,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    subtasksByTaskId[childId] = subject.topics.map(t => ({
      id: generateId(),
      taskId: childId,
      parentId: null,
      title: t.lectures === null ? t.name : `${t.name} — ${t.lectures} lectures`,
      isCompleted: false,
      createdAt: nowIso()
    }));
  }

  return { mainTask, childTasks, subtasksByTaskId };
}
