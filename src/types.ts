/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TaskPriority {
  NONE = "None",
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
  CRITICAL = "Critical"
}

export enum TaskStatus {
  TODO = "Todo",
  IN_PROGRESS = "In Progress",
  WAITING = "Waiting",
  COMPLETED = "Completed",
  ARCHIVED = "Archived"
}

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Argon2/PBKDF2 cryptographically salted hash
  salt: string;
  pinHash?: string; // Optional PIN hash
  pinSalt?: string;
  createdAt: string;
  rememberMe: boolean;
  lockoutUntil?: string; // For brute force protection
  failedAttempts: number;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string; // supports rich text/markdown
  notes: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM
  endDate?: string; // YYYY-MM-DD
  parentId?: string | null; // For hierarchical task tree
  dependencyTaskId?: string | null; // Blocking task dependency (Parent task)
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  tags: string[]; // parsed tags
  isFavorite: boolean;
  isPinned: boolean;
  recurrence: string; // "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom:X"
  isDeleted: boolean; // For recycle bin
  deletedAt?: string;
  subCategory?: string; // Two-level organizational hierarchy (Category > Sub-category)
  createdAt: string;
  updatedAt: string;
  timerDuration?: number; // total accumulated seconds
  timerStartedAt?: string | null; // ISO timestamp of when started, or null if not running
  timerSeconds?: number;
  subtaskTimers?: Record<string, number>;
  targetPeriod?: string; // Target time period/milestone target
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  parentId: string | null; // Supports nesting
  title: string;
  isCompleted: boolean;
  createdAt: string;
  timerDuration?: number; // total accumulated seconds
  timerStartedAt?: string | null; // ISO timestamp of when started, or null if not running
  targetPeriod?: string; // Target time period/milestone target
}

export interface TaskReminder {
  id: string;
  taskId: string;
  remindAt: string; // ISO date string
  isSent: boolean;
  snoozedCount: number;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string; // Base64 encoded file data
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  taskId?: string;
  action: string; // e.g. "TASK_CREATED", "LOGIN_FAILED", "BACKUP_RESTORED"
  details: string;
  createdAt: string;
}

export interface SecurityEvent {
  id: string;
  event: string;
  details: string;
  timestamp: string;
}

export interface DatabaseBackup {
  version: number;
  timestamp: string;
  users: User[];
  tasks: Task[];
  checklistItems: ChecklistItem[];
  subtasks: Subtask[];
  reminders: TaskReminder[];
  attachments: TaskAttachment[];
  activityLogs: ActivityLog[];
  roadmaps?: { id: string; nodesJson: string }[];
  routines?: DailyRoutine[];
  subjects?: StudySubject[];
  habits?: Habit[];
  targets?: Target[];
  notes?: Note[];
}

export interface DailyRoutine {
  id: string;
  userId: string;
  name: string;
  dayOfWeek: string; // "all", "workday", "weekend", "Monday", "Tuesday", etc.
  isEnabled: boolean;
  items: string; // JSON string representation of RoutineItem[]
  isTemplate: boolean;
  createdAt: string;
}

export interface RoutineItem {
  id: string;
  time: string; // HH:MM
  duration: number; // minutes
  activity: string;
  isCompleted: boolean;
  color?: string;
  icon?: string;
}

export interface StudySubject {
  id: string;
  userId: string;
  name: string;
  examDate: string; // YYYY-MM-DD
  priority: TaskPriority;
  notes: string;
  completionPercent: number;
  chaptersJson: string; // JSON of Chapters
  revisionJson: string; // JSON of Revision schedule
  createdAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  streak: number;
  longestStreak: number;
  logsJson: string; // JSON string of Record<string, boolean>
  createdAt: string;
}

export interface Target {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: "daily" | "weekly" | "monthly" | "yearly";
  priority: TaskPriority;
  deadline: string; // YYYY-MM-DD
  progress: number; // percentage
  reminderTime?: string; // HH:MM or ISO
  category?: string; // custom category
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string; // Markdown supported
  folder: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReschedulingHistory {
  id: string;
  userId: string;
  timestamp: string;
  description: string;
  snapshotJson: string; // JSON serialized Task[] snapshot
}

// Multi-Exam Management
export interface Exam {
  id: string;
  userId: string;
  name: string;
  examDate: string; // YYYY-MM-DD
  targetScore: number;
  priority: TaskPriority;
  syllabusJson: string; // JSON hierarchical structure of Subjects, Units, Chapters, Topics, Subtopics
  completionPercent: number;
  color: string;
  createdAt: string;
}

// Study Intelligence
export interface StudySession {
  id: string;
  userId: string;
  examId: string;
  subjectId: string;
  topicName: string;
  plannedDuration: number; // minutes
  actualDuration: number; // minutes
  interruptions: number;
  productivityScore: number; // 1-5
  notes: string;
  createdAt: string;
}

export interface Mistake {
  id: string;
  userId: string;
  examId: string;
  subjectName: string;
  topicName: string;
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  confidenceRating: number; // 1-5
  scheduledRevisionAt: string; // YYYY-MM-DD
  isResolved: boolean;
  createdAt: string;
}

export interface PracticeGoal {
  id: string;
  userId: string;
  topicName: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  timeSpent: number; // seconds
  createdAt: string;
}

export interface ResourceItem {
  id: string;
  userId: string;
  examId: string;
  subjectName: string;
  topicName: string;
  title: string;
  type: "note" | "pdf" | "image" | "video" | "audio" | "link" | "flashcard";
  content: string; // text content, URL, base64 or JSON
  isFavorite?: boolean;
  tags?: string[];
  createdAt: string;
}


