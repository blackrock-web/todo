/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { User, Task, TaskPriority, TaskStatus, ActivityLog, TaskReminder, ChecklistItem, Subtask, Target } from "./types";
import { db } from "./db/sqlite";
import { AuthScreen } from "./components/AuthScreen";
import { DashboardWidget } from "./components/DashboardWidget";
import { FocusModePanel } from "./components/FocusModePanel";
import { FocusTimer } from "./components/FocusTimer";
import { TaskForm } from "./components/TaskForm";
import { ListView, CardView, KanbanView, CalendarView, AgendaView, TableView, TimelineView } from "./components/TaskViews";
import { PDFExport } from "./components/PDFExport";
import { BackupPanel } from "./components/BackupPanel";
import { AuditLogView } from "./components/AuditLogView";
import { RoadmapTree } from "./components/RoadmapTree";
import { AnalyticsView } from "./components/AnalyticsView";
import { DailyRoutinePlanner } from "./components/DailyRoutinePlanner";
import { StudyPlanner } from "./components/StudyPlanner";
import { TargetPlanner } from "./components/TargetPlanner";
import { HabitTracker } from "./components/HabitTracker";
import { NotesManager } from "./components/NotesManager";
import { EodReviewModal } from "./components/EodReviewModal";
import { IntelligentRescheduler } from "./components/IntelligentRescheduler";
import { CommandPalette } from "./components/CommandPalette";
import { ProSuiteHub } from "./components/ProSuiteHub";
import { evaluateRules } from "./lib/AutomationRules";
import { AppHealthMonitor } from "./components/pro/AppHealthMonitor";
import { AchievementCenter } from "./components/pro/AchievementCenter";
import { ExamManager } from "./components/pro/ExamManager";
import { HelpCenter } from "./components/pro/HelpCenter";
import { ProfileCenter } from "./components/pro/ProfileCenter";
import { FirstRunExperience } from "./components/pro/FirstRunExperience";
import { hashPassword, generateRandomBytes } from "./utils/security";
import { NotificationService } from "./services/notificationService";
import { 
  Shield, CheckSquare, Search, Plus, Trash2, Calendar, FileText, Command,
  Database, ShieldAlert, LogOut, Lock, Settings, ChevronRight, Trophy,
  Menu, X, Filter, AlertTriangle, Play, Volume2, KeyRound, BellRing, Trash, Sparkles, Map, BarChart3, Sun, Moon, Archive, Palette,
  Clock, BookOpen, Zap, Target as TargetIcon, RefreshCw, HelpCircle, GraduationCap, User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [masterKey, setMasterKey] = useState<string | null>(null); // Password hash
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState<number>(-1);
  const [categories, setCategories] = useState<string[]>([]);
  const [isFocusActiveInApp, setIsFocusActiveInApp] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(() => {
    return localStorage.getItem("first-run-experience-completed") !== "true";
  });

  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "pro-hub" | "achievements" | "analytics" | "todos" | "archive" | "roadmap" | "pdf" | "backup" | "audit" | "settings" | "recycle" | "routines" | "study" | "habits" | "targets" | "notes" | "rescheduler" | "exams" | "help" | "profile" | "theme-settings">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [showEodModal, setShowEodModal] = useState(false);

  // Toast notifications with Undo support
  interface ToastMessage {
    id: string;
    message: string;
    onUndo?: () => Promise<void> | void;
  }
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showUndoToast = (message: string, onUndo: () => Promise<void>) => {
    const id = generateRandomBytes(8);
    setToast({ id, message, onUndo });
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 10000);
  };

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all" | "active">("active");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDateOption, setFilterDateOption] = useState<"all" | "today" | "custom">("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<"dark-plum" | "light-contrast" | "system">(() => {
    return (localStorage.getItem("app-theme-mode") as any) || "system";
  });
  const [activeTheme, setActiveTheme] = useState<"dark-plum" | "light-contrast">("dark-plum");

  useEffect(() => {
    localStorage.setItem("app-theme-mode", themeMode);
    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const updateTheme = () => {
        setActiveTheme(mediaQuery.matches ? "dark-plum" : "light-contrast");
      };
      updateTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", updateTheme);
        return () => mediaQuery.removeEventListener("change", updateTheme);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(updateTheme);
        return () => mediaQuery.removeListener(updateTheme);
      }
    } else {
      setActiveTheme(themeMode);
    }
  }, [themeMode]);

  // Native SQLite Migration states
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    const checkMigration = async () => {
      try {
        const available = await db.checkForMigration();
        if (available) {
          setShowMigrationPrompt(true);
        }
      } catch (e) {
        console.warn("Migration check failed:", e);
      }
    };
    checkMigration();
  }, []);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      await db.runMigration();
      showUndoToast("Migration completed successfully! Your data is now in SQLite.", () => Promise.resolve());
      setShowMigrationPrompt(false);
    } catch (err) {
      console.error("Migration failed:", err);
    } finally {
      setIsMigrating(false);
    }
  };

  // Recent Searches and Presets
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recent-searches") || "[]");
    } catch {
      return [];
    }
  });

  interface FilterPreset {
    id: string;
    name: string;
    searchQuery: string;
    filterPriority: string;
    filterStatus: string;
    filterCategory: string;
    selectedTagFilter: string | null;
    filterDateOption: string;
    filterStartDate: string;
    filterEndDate: string;
  }

  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => {
    try {
      const saved = localStorage.getItem("filter-presets");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "work-high",
        name: "Work High Priority",
        searchQuery: "",
        filterPriority: TaskPriority.HIGH,
        filterStatus: "active",
        filterCategory: "Work",
        selectedTagFilter: null,
        filterDateOption: "all",
        filterStartDate: "",
        filterEndDate: ""
      },
      {
        id: "all-completed",
        name: "Completed Tasks",
        searchQuery: "",
        filterPriority: "all",
        filterStatus: TaskStatus.COMPLETED,
        filterCategory: "all",
        selectedTagFilter: null,
        filterDateOption: "all",
        filterStartDate: "",
        filterEndDate: ""
      }
    ];
  });

  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");

  // Auto Archive settings state
  const [autoArchiveOption, setAutoArchiveOption] = useState<string>(() => {
    return localStorage.getItem("auto-archive-option") || "disabled";
  });

  useEffect(() => {
    localStorage.setItem("auto-archive-option", autoArchiveOption);
  }, [autoArchiveOption]);

  // Task View Mode
  const [viewMode, setViewMode] = useState<"list" | "card" | "kanban" | "calendar" | "agenda" | "table" | "timeline">("list");

  // Modals
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Settings
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(10); // in minutes
  const [settingsMessage, setSettingsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lock status
  const [isLocked, setIsLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const [systemPermissionStatus, setSystemPermissionStatus] = useState<"granted" | "denied" | "default">("default");

  // Request Notification permission on mount
  useEffect(() => {
    NotificationService.requestPermission().then((granted) => {
      setSystemPermissionStatus(granted ? "granted" : "denied");
    });
  }, []);

  // Recurring Tasks Engine / Service Check
  const checkAndProcessRecurringTasks = async (allTasks: Task[]) => {
    const completedRecurringTasks = allTasks.filter(
      t => t.status === TaskStatus.COMPLETED && t.recurrence && t.recurrence !== "none" && !t.isDeleted
    );

    let createdAny = false;

    for (const task of completedRecurringTasks) {
      // 1. Calculate next due date
      const currentDueDate = task.dueDate || new Date().toISOString().split("T")[0];
      const date = new Date(currentDueDate + "T00:00:00");
      if (isNaN(date.getTime())) continue;

      if (task.recurrence === "daily") {
        date.setDate(date.getDate() + 1);
      } else if (task.recurrence === "weekly") {
        date.setDate(date.getDate() + 7);
      } else if (task.recurrence === "monthly") {
        date.setMonth(date.getMonth() + 1);
      } else if (task.recurrence === "yearly") {
        date.setFullYear(date.getFullYear() + 1);
      } else {
        continue;
      }

      const nextDueDateStr = date.toISOString().split("T")[0];

      // Check if a task with the same title, nextDueDate, and NOT deleted already exists in local database
      const existing = allTasks.find(
        t => t.title === task.title && t.dueDate === nextDueDateStr && !t.isDeleted
      );

      if (!existing) {
        // Create the next task instance
        const nextId = generateRandomBytes(16);
        const nextTask: Task = {
          id: nextId,
          userId: task.userId,
          title: task.title,
          description: task.description,
          notes: task.notes,
          startDate: nextDueDateStr,
          dueDate: nextDueDateStr,
          dueTime: task.dueTime,
          parentId: task.parentId,
          priority: task.priority,
          status: TaskStatus.TODO,
          category: task.category,
          tags: task.tags,
          isFavorite: task.isFavorite,
          isPinned: task.isPinned,
          recurrence: task.recurrence, // carry forward the recurrence setting
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await db.execute("INSERT INTO tasks", [nextTask]);
        await db.logEvent(
          task.userId,
          "TASK_RECURRED",
          `Automatically spawned next recurring instance for '${task.title}' due on ${nextDueDateStr}`,
          nextTask.id
        );

        // Copy checklist items and subtasks!
        try {
          // Checklist items
          const checklists = await db.execute<ChecklistItem>("SELECT * FROM checklistItems WHERE taskId = ?", [task.id]);
          for (const item of checklists) {
            const newItem: ChecklistItem = {
              id: generateRandomBytes(16),
              taskId: nextId,
              title: item.title,
              isCompleted: false, // reset to false for new task
              createdAt: new Date().toISOString()
            };
            await db.execute("INSERT INTO checklistItems", [newItem]);
          }

          // Subtasks
          const subs = await db.execute<Subtask>("SELECT * FROM subtasks WHERE taskId = ?", [task.id]);
          const idMap = new Map<string, string>();
          
          const rootSubs = subs.filter(s => !s.parentId);
          const childSubs = subs.filter(s => s.parentId);

          for (const sub of rootSubs) {
            const newId = generateRandomBytes(16);
            idMap.set(sub.id, newId);
            const newSub: Subtask = {
              id: newId,
              taskId: nextId,
              parentId: null,
              title: sub.title,
              isCompleted: false,
              createdAt: new Date().toISOString()
            };
            await db.execute("INSERT INTO subtasks", [newSub]);
          }

          let remaining = [...childSubs];
          let loopProtect = 0;
          while (remaining.length > 0 && loopProtect < 10) {
            const nextBatch: Subtask[] = [];
            for (const sub of remaining) {
              const mappedParentId = sub.parentId ? idMap.get(sub.parentId) : null;
              if (!sub.parentId || mappedParentId) {
                const newId = generateRandomBytes(16);
                idMap.set(sub.id, newId);
                const newSub: Subtask = {
                  id: newId,
                  taskId: nextId,
                  parentId: mappedParentId || null,
                  title: sub.title,
                  isCompleted: false,
                  createdAt: new Date().toISOString()
                };
                await db.execute("INSERT INTO subtasks", [newSub]);
              } else {
                nextBatch.push(sub);
              }
            }
            remaining = nextBatch;
            loopProtect++;
          }
        } catch (copyErr) {
          console.error("Failed to copy sub-elements for recurring task", copyErr);
        }

        createdAny = true;
      }
    }

    return createdAny;
  };

  // Auto-Archive Completed Service Check
  const processAutoArchive = async (allTasks: Task[]) => {
    if (autoArchiveOption === "disabled") return false;

    const now = new Date();
    let updatedAny = false;

    // Map option to milliseconds
    const msMap: Record<string, number> = {
      "immediate": 0,
      "1h": 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "3d": 3 * 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };

    const limitMs = msMap[autoArchiveOption];
    if (limitMs === undefined) return false;

    const completedTasks = allTasks.filter(
      t => t.status === TaskStatus.COMPLETED && !t.isDeleted
    );

    for (const task of completedTasks) {
      const updatedAtTime = new Date(task.updatedAt).getTime();
      if (isNaN(updatedAtTime)) continue;

      if (now.getTime() - updatedAtTime >= limitMs) {
        // Archive the task
        const updated = {
          ...task,
          status: TaskStatus.ARCHIVED,
          updatedAt: new Date().toISOString()
        };
        await db.execute("UPDATE tasks", [updated]);
        await db.logEvent(
          currentUser?.id || "local_user",
          "TASK_AUTO_ARCHIVED",
          `Automatically archived task '${task.title}' after completion duration of ${autoArchiveOption}.`,
          task.id
        );
        updatedAny = true;
      }
    }

    return updatedAny;
  };

  const getSortedTasksWithCustomOrder = (rawTasks: Task[]) => {
    const savedOrder = localStorage.getItem(`tasks-order-${currentUser?.id || "local_user"}`);
    if (!savedOrder) return rawTasks;
    try {
      const orderedIds: string[] = JSON.parse(savedOrder);
      const idToIndex = new Map<string, number>();
      orderedIds.forEach((id, index) => {
        idToIndex.set(id, index);
      });
      return [...rawTasks].sort((a, b) => {
        const indexA = idToIndex.has(a.id) ? idToIndex.get(a.id)! : 999999;
        const indexB = idToIndex.has(b.id) ? idToIndex.get(b.id)! : 999999;
        return indexA - indexB;
      });
    } catch (e) {
      return rawTasks;
    }
  };

  // Sync / load tasks from database
  const loadTasks = async () => {
    if (!currentUser) return;
    try {
      // Execute local relational query mapping to our IndexedDB SQLite equivalent
      const allTasks = await db.execute<Task>("SELECT * FROM tasks");

      // Automatically run daily recurrence service check
      const spawned = await checkAndProcessRecurringTasks(allTasks);

      // Automatically run auto-archive completed check
      const archived = await processAutoArchive(allTasks);

      if (spawned || archived) {
        const refreshedTasks = await db.execute<Task>("SELECT * FROM tasks");
        setTasks(getSortedTasksWithCustomOrder(refreshedTasks));
        const cats = Array.from(new Set(refreshedTasks.map(t => t.category).filter(c => c && c.trim() !== "")));
        setCategories(cats);
      } else {
        setTasks(getSortedTasksWithCustomOrder(allTasks));
        const cats = Array.from(new Set(allTasks.map(t => t.category).filter(c => c && c.trim() !== "")));
        setCategories(cats);
      }
    } catch (e) {
      console.error("Failed to load tasks", e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadTasks();
    }
  }, [currentUser]);

  // Local background scheduling engine (reminders, due tasks, targets, and EOD auto-trigger)
  useEffect(() => {
    if (!currentUser) return;

    const checkScheduler = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const currentTimeStr = now.toTimeString().split(" ")[0].slice(0, 5); // HH:MM
        const [currHour, currMin] = currentTimeStr.split(":").map(Number);

        // Check Quiet Hours before triggering notifications
        const isQuietTimeActive = () => {
          const qStartStr = localStorage.getItem(`sched-quiet-start-${currentUser.id}`) || "18:00";
          const qEndStr = localStorage.getItem(`sched-quiet-end-${currentUser.id}`) || "20:00";
          
          const [sH, sM] = qStartStr.split(":").map(Number);
          const [eH, eM] = qEndStr.split(":").map(Number);
          const startMins = (sH || 0) * 60 + (sM || 0);
          const endMins = (eH || 0) * 60 + (eM || 0);
          const nowMins = currHour * 60 + currMin;

          if (startMins === endMins) return false;
          if (startMins < endMins) {
            return nowMins >= startMins && nowMins < endMins;
          } else {
            return nowMins >= startMins || nowMins < endMins;
          }
        };

        const isQuiet = isQuietTimeActive();

        // Centralized high-reliability notifier that combines audio, browser popups, and visual in-app toasts
        const triggerSchedulerAlert = (title: string, body: string, tag?: string) => {
          if (isQuiet) return;

          // Play synthesized audio alert
          playChime();

          // 1. Attempt native notification
          NotificationService.sendNotification(title, body);

          // 2. Always show high-fidelity visual in-app Toast fallback to guarantee delivery (critical for iframe sandboxes)
          const toastId = generateRandomBytes(8);
          setToast({
            id: toastId,
            message: `🔔 ${title} — ${body}`
          });

          // Auto-dismiss after 10 seconds
          setTimeout(() => {
            setToast(current => current?.id === toastId ? null : current);
          }, 10000);
        };

        // Query all tasks from SQLite
        const allTasks = await db.execute<Task>("SELECT * FROM tasks");

        // 1. Query task reminders from SQLite with robust missed recovery
        const allReminders = await db.execute<TaskReminder>("SELECT * FROM reminders");
        const activeReminders = allReminders.filter(r => {
          if (r.isSent) return false;
          const rDate = new Date(r.remindAt);
          if (isNaN(rDate.getTime())) return false; // Verify timestamp validity
          return rDate <= now;
        });

        for (const rem of activeReminders) {
          const task = allTasks.find(t => t.id === rem.taskId);
          if (task && !task.isDeleted) {
            const scheduledTime = new Date(rem.remindAt);
            const isMissed = (now.getTime() - scheduledTime.getTime()) > 60000; // Over 1 minute delay is recovered
            const titlePrefix = isMissed ? "[Missed / Recovered Reminder] " : "Reminder: ";

            // Trigger centralized high-reliability notification
            triggerSchedulerAlert(`${titlePrefix}${task.title}`, task.description || "Task is scheduled now.", rem.id);

            // Mark as sent
            const updatedRem = { ...rem, isSent: true };
            await db.execute("UPDATE reminders", [updatedRem]);
          } else if (!task) {
            // Task no longer exists or is deleted, mark as sent to clean up
            const updatedRem = { ...rem, isSent: true };
            await db.execute("UPDATE reminders", [updatedRem]);
          }
        }

        // 2. Query due tasks with robust recovery
        const pendingTasks = allTasks.filter(t => !t.isDeleted && t.status !== TaskStatus.COMPLETED && t.dueDate && t.dueTime);
        for (const t of pendingTasks) {
          try {
            const dueTimeStr = t.dueTime || "00:00";
            const dueDateTime = new Date(`${t.dueDate}T${dueTimeStr}`);
            if (isNaN(dueDateTime.getTime())) continue; // Skip invalid dates

            if (dueDateTime <= now) {
              const notifiedKey = `due-notified-${t.id}`;
              const alreadyNotified = localStorage.getItem(notifiedKey) === "true";

              if (!alreadyNotified) {
                const isMissed = (now.getTime() - dueDateTime.getTime()) > 60000;
                const titlePrefix = isMissed ? "[Missed / Recovered Task] " : "Task Due Now: ";

                triggerSchedulerAlert(`${titlePrefix}${t.title}`, `This task is scheduled for ${t.dueTime} on ${t.dueDate}.`, `due-${t.id}`);
                localStorage.setItem(notifiedKey, "true");
              }
            }
          } catch (e) {
            console.error("Failed to process task due time check:", e);
          }
        }

        // 3. Query target reminders from SQLite with robust recovery
        const allTargets = await db.execute<Target>("SELECT * FROM targets");
        const triggerableTargets = allTargets.filter(t => {
          if (t.progress >= 100 || !t.reminderTime) return false;
          
          const [remHour, remMin] = t.reminderTime.split(":").map(Number);
          // Has the time passed or is it exactly now?
          const timeHasPassed = (currHour > remHour) || (currHour === remHour && currMin >= remMin);
          return timeHasPassed;
        });

        if (triggerableTargets.length > 0) {
          const triggeredKey = `triggered-targets-${todayStr}`;
          const triggeredSet = new Set<string>(JSON.parse(localStorage.getItem(triggeredKey) || "[]"));
          
          let updatedTriggered = false;
          for (const target of triggerableTargets) {
            if (!triggeredSet.has(target.id)) {
              const [remHour, remMin] = target.reminderTime!.split(":").map(Number);
              const isMissed = (currHour > remHour) || (currHour === remHour && currMin > remMin);
              const titlePrefix = isMissed ? "[Missed / Recovered Target] " : "Target Locked: ";

              triggerSchedulerAlert(`${titlePrefix}${target.title}`, `Your goal is set for today. Target type: ${target.type}.`, target.id);
              triggeredSet.add(target.id);
              updatedTriggered = true;
            }
          }
          if (updatedTriggered) {
            localStorage.setItem(triggeredKey, JSON.stringify(Array.from(triggeredSet)));
          }
        }

        // 4. Trigger End of Day Review Modal with robust recovery if current time is at or after reviewTime
        const reviewTime = localStorage.getItem(`end-of-day-review-time-${currentUser.id}`) || "20:00";
        const isReviewEnabled = localStorage.getItem(`end-of-day-review-enabled-${currentUser.id}`) !== "false";
        
        const [revHour, revMin] = reviewTime.split(":").map(Number);
        const hasPassedReviewTime = (currHour > revHour) || (currHour === revHour && currMin >= revMin);

        if (isReviewEnabled && hasPassedReviewTime) {
          const reviewTriggeredKey = `eod-review-triggered-${todayStr}`;
          if (!localStorage.getItem(reviewTriggeredKey)) {
            const isMissed = (currHour > revHour) || (currHour === revHour && currMin > revMin);
            const titlePrefix = isMissed ? "End of Day Review [Missed / Recovered]" : "End of Day Review";
            
            setShowEodModal(true);
            localStorage.setItem(reviewTriggeredKey, "true");
            triggerSchedulerAlert(titlePrefix, isMissed 
              ? "Welcome back! Let's resume with your daily productivity review and planning tomorrow."
              : "Time for your productivity summary and tomorrow's planning!", "eod-review");
          }
        }

      } catch (err) {
        console.error("Local background scheduling engine error:", err);
      }
    };

    // Run immediately on startup / login to process recovered events right away
    checkScheduler();

    const interval = setInterval(checkScheduler, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [currentUser]);

  const handleReorderTasks = (draggedId: string, targetId: string) => {
    const currentFilteredIds = filteredTasks.map(t => t.id);
    const draggedIndex = currentFilteredIds.indexOf(draggedId);
    const targetIndex = currentFilteredIds.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

    // Rearrange in current filtered list
    const updatedFilteredIds = [...currentFilteredIds];
    updatedFilteredIds.splice(draggedIndex, 1);
    updatedFilteredIds.splice(targetIndex, 0, draggedId);

    // Persist in master ordered list in localStorage
    const savedOrder = localStorage.getItem(`tasks-order-${currentUser?.id || "local_user"}`);
    let masterOrderedIds: string[] = [];
    if (savedOrder) {
      try {
        masterOrderedIds = JSON.parse(savedOrder);
      } catch (e) {}
    }
    
    // If empty, initialize
    if (masterOrderedIds.length === 0) {
      masterOrderedIds = tasks.map(t => t.id);
    }

    // Move dragged item next to the target item in the master list
    masterOrderedIds = masterOrderedIds.filter(id => id !== draggedId);
    const newTargetIdx = masterOrderedIds.indexOf(targetId);
    if (newTargetIdx !== -1) {
      masterOrderedIds.splice(newTargetIdx, 0, draggedId);
    } else {
      masterOrderedIds.push(draggedId);
    }

    localStorage.setItem(`tasks-order-${currentUser?.id || "local_user"}`, JSON.stringify(masterOrderedIds));

    // Refresh state
    setTasks(getSortedTasksWithCustomOrder(tasks));
  };

  // Sync theme changes to localStorage
  useEffect(() => {
    localStorage.setItem("app-theme", activeTheme);
  }, [activeTheme]);

  // Compute tag counts for the active tags sidebar
  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.isDeleted) return;
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => {
          const clean = tag.trim().toLowerCase();
          if (clean) {
            counts[clean] = (counts[clean] || 0) + 1;
          }
        });
      }
    });
    return counts;
  }, [tasks]);

  // Bulk actions handlers
  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleBulkComplete = async () => {
    if (selectedTaskIds.length === 0) return;
    try {
      const now = new Date().toISOString();
      const originalTasksSnapshot: Task[] = [];
      for (const id of selectedTaskIds) {
        const taskList = tasks.filter(t => t.id === id);
        if (taskList.length > 0) {
          originalTasksSnapshot.push({ ...taskList[0] });
          const t = taskList[0];
          const updated = {
            ...t,
            status: TaskStatus.COMPLETED,
            updatedAt: now
          };
          await db.execute("UPDATE tasks", [updated]);
        }
      }
      if (currentUser) {
        await db.logEvent(currentUser.id, "BULK_TASKS_COMPLETED", `Completed ${selectedTaskIds.length} tasks in bulk.`);
      }
      const count = selectedTaskIds.length;
      setSelectedTaskIds([]);
      await loadTasks();

      showUndoToast(`Completed ${count} tasks in bulk`, async () => {
        for (const oTask of originalTasksSnapshot) {
          await db.execute("UPDATE tasks", [oTask]);
        }
        if (currentUser) {
          await db.logEvent(currentUser.id, "BULK_UNDO", `Undid bulk completion of ${count} tasks.`);
        }
        await loadTasks();
      });
    } catch (e) {
      console.error("Bulk complete failed:", e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    try {
      const now = new Date().toISOString();
      const originalTasksSnapshot: Task[] = [];
      for (const id of selectedTaskIds) {
        const taskList = tasks.filter(t => t.id === id);
        if (taskList.length > 0) {
          originalTasksSnapshot.push({ ...taskList[0] });
          const t = taskList[0];
          const updated = {
            ...t,
            isDeleted: true,
            deletedAt: now,
            updatedAt: now
          };
          await db.execute("UPDATE tasks", [updated]);
        }
      }
      if (currentUser) {
        await db.logEvent(currentUser.id, "BULK_TASKS_DELETED", `Moved ${selectedTaskIds.length} tasks to Recycle Bin in bulk.`);
      }
      const count = selectedTaskIds.length;
      setSelectedTaskIds([]);
      await loadTasks();

      showUndoToast(`Moved ${count} tasks to Recycle Bin in bulk`, async () => {
        for (const oTask of originalTasksSnapshot) {
          await db.execute("UPDATE tasks", [oTask]);
        }
        if (currentUser) {
          await db.logEvent(currentUser.id, "BULK_UNDO", `Undid bulk deletion of ${count} tasks.`);
        }
        await loadTasks();
      });
    } catch (e) {
      console.error("Bulk delete failed:", e);
    }
  };

  const handleBulkMoveCategory = async (newCat: string) => {
    if (selectedTaskIds.length === 0 || !newCat.trim()) return;
    try {
      const now = new Date().toISOString();
      const originalTasksSnapshot: Task[] = [];
      for (const id of selectedTaskIds) {
        const taskList = tasks.filter(t => t.id === id);
        if (taskList.length > 0) {
          originalTasksSnapshot.push({ ...taskList[0] });
          const t = taskList[0];
          const updated = {
            ...t,
            category: newCat.trim(),
            updatedAt: now
          };
          await db.execute("UPDATE tasks", [updated]);
        }
      }
      if (currentUser) {
        await db.logEvent(currentUser.id, "BULK_TASKS_RECATEGORIZED", `Moved ${selectedTaskIds.length} tasks to category '${newCat}' in bulk.`);
      }
      const count = selectedTaskIds.length;
      setSelectedTaskIds([]);
      await loadTasks();

      showUndoToast(`Moved ${count} tasks to category '${newCat}'`, async () => {
        for (const oTask of originalTasksSnapshot) {
          await db.execute("UPDATE tasks", [oTask]);
        }
        if (currentUser) {
          await db.logEvent(currentUser.id, "BULK_UNDO", `Undid bulk category move of ${count} tasks.`);
        }
        await loadTasks();
      });
    } catch (e) {
      console.error("Bulk move category failed:", e);
    }
  };

  const handleBulkAddTag = async (newTag: string) => {
    if (selectedTaskIds.length === 0 || !newTag.trim()) return;
    const cleanTag = newTag.trim().toLowerCase().replace(/#/g, "");
    if (!cleanTag) return;
    try {
      const now = new Date().toISOString();
      const originalTasksSnapshot: Task[] = [];
      for (const id of selectedTaskIds) {
        const taskList = tasks.filter(t => t.id === id);
        if (taskList.length > 0) {
          originalTasksSnapshot.push({ ...taskList[0] });
          const t = taskList[0];
          const updatedTags = Array.from(new Set([...(t.tags || []), cleanTag]));
          const updated = {
            ...t,
            tags: updatedTags,
            updatedAt: now
          };
          await db.execute("UPDATE tasks", [updated]);
        }
      }
      if (currentUser) {
        await db.logEvent(currentUser.id, "BULK_TASKS_TAGGED", `Added tag '#${cleanTag}' to ${selectedTaskIds.length} tasks in bulk.`);
      }
      const count = selectedTaskIds.length;
      setSelectedTaskIds([]);
      await loadTasks();

      showUndoToast(`Added tag '#${cleanTag}' to ${count} tasks`, async () => {
        for (const oTask of originalTasksSnapshot) {
          await db.execute("UPDATE tasks", [oTask]);
        }
        if (currentUser) {
          await db.logEvent(currentUser.id, "BULK_UNDO", `Undid bulk tag addition of '#${cleanTag}' on ${count} tasks.`);
        }
        await loadTasks();
      });
    } catch (e) {
      console.error("Bulk add tag failed:", e);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedTaskIds.length === 0) return;
    try {
      const now = new Date().toISOString();
      const originalTasksSnapshot: Task[] = [];
      for (const id of selectedTaskIds) {
        const taskList = tasks.filter(t => t.id === id);
        if (taskList.length > 0) {
          originalTasksSnapshot.push({ ...taskList[0] });
          const t = taskList[0];
          const updated = {
            ...t,
            status: TaskStatus.ARCHIVED,
            updatedAt: now
          };
          await db.execute("UPDATE tasks", [updated]);
        }
      }
      if (currentUser) {
        await db.logEvent(currentUser.id, "BULK_TASKS_ARCHIVED", `Archived ${selectedTaskIds.length} tasks in bulk.`);
      }
      const count = selectedTaskIds.length;
      setSelectedTaskIds([]);
      await loadTasks();

      showUndoToast(`Archived ${count} tasks in bulk`, async () => {
        for (const oTask of originalTasksSnapshot) {
          await db.execute("UPDATE tasks", [oTask]);
        }
        if (currentUser) {
          await db.logEvent(currentUser.id, "BULK_UNDO", `Undid bulk archiving of ${count} tasks.`);
        }
        await loadTasks();
      });
    } catch (e) {
      console.error("Bulk archive failed:", e);
    }
  };

  // Inactivity auto lock monitor
  useEffect(() => {
    if (!currentUser) return;

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", recordActivity);
    window.addEventListener("click", recordActivity);
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("scroll", recordActivity);

    const checkInterval = setInterval(() => {
      const msLimit = inactivityTimeout * 60 * 1000;
      if (Date.now() - lastActivityRef.current > msLimit && !isLocked) {
        handleLock();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener("mousemove", recordActivity);
      window.removeEventListener("click", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("scroll", recordActivity);
      clearInterval(checkInterval);
    };
  }, [currentUser, inactivityTimeout, isLocked]);

  // Global Keyboard Shortcuts (Ctrl/Cmd + N to add task, Ctrl/Cmd + F to search)
  useEffect(() => {
    if (!currentUser) return;

    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N -> Create new task
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditingTask(null);
        setIsTaskFormOpen(true);
      }

      // Ctrl/Cmd + F -> Focus search input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActiveTab("todos");
        setTimeout(() => {
          const searchInput = document.getElementById("input-search-tasks") as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 50);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [currentUser]);

  // Securely lock the application
  const handleLock = async () => {
    if (currentUser) {
      await db.logEvent(currentUser.id, "APPLICATION_LOCKED", "Security lock engaged due to inactivity or manual action.");
    }
    db.clearContext();
    setIsLocked(true);
    setCurrentUser(null);
    setMasterKey(null);
  };

  const handleLogout = async () => {
    if (currentUser) {
      await db.logEvent(currentUser.id, "LOGOUT", "User successfully logged out of session.");
    }
    db.clearContext();
    setCurrentUser(null);
    setMasterKey(null);
  };

  // Triggers professional synthesized browser sounds
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Web Audio chime failed", e);
    }
  };

  // Triggers desktop browser notifications
  const triggerNotification = (title: string, body: string) => {
    playChime();
    NotificationService.sendNotification(title, body);
  };

  // Task Toggles & Edits
  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleToggleComplete = async (task: Task) => {
    const isCompleted = task.status === TaskStatus.COMPLETED;
    const newStatus = isCompleted ? TaskStatus.TODO : TaskStatus.COMPLETED;

    if (newStatus === TaskStatus.COMPLETED && task.dependencyTaskId) {
      const dependencyTask = tasks.find(t => t.id === task.dependencyTaskId);
      if (dependencyTask && dependencyTask.status !== TaskStatus.COMPLETED) {
        // Trigger blocking warning toast
        const toastId = generateRandomBytes(8);
        setToast({
          id: toastId,
          message: `⚠️ Action Blocked: This task is blocked by "${dependencyTask.title}". Please complete it first.`
        });
        setTimeout(() => {
          setToast(current => current?.id === toastId ? null : current);
        }, 6000);
        triggerNotification("Action Blocked", `Blocked by "${dependencyTask.title}"`);
        return;
      }
    }

    const updated = { ...task, status: newStatus, updatedAt: new Date().toISOString() };
    
    await db.execute("UPDATE tasks", [updated]);
    await db.logEvent(
      currentUser?.id || "local_user",
      newStatus === TaskStatus.COMPLETED ? "TASK_RESOLVED" : "TASK_REOPENED",
      `Marked task '${task.title}' as ${newStatus}`,
      task.id
    );
    
    if (newStatus === TaskStatus.COMPLETED) {
      await evaluateRules("Task completed", {
        task: updated,
        userId: currentUser?.id || "local_user"
      });
    }

    loadTasks();
    triggerNotification(
      newStatus === TaskStatus.COMPLETED ? "Task Completed!" : "Task Re-opened",
      `'${task.title}' updated successfully.`
    );
  };

  const handleToggleFavorite = async (task: Task) => {
    const updated = { ...task, isFavorite: !task.isFavorite, updatedAt: new Date().toISOString() };
    await db.execute("UPDATE tasks", [updated]);
    loadTasks();
  };

  const handleTogglePin = async (task: Task) => {
    const updated = { ...task, isPinned: !task.isPinned, updatedAt: new Date().toISOString() };
    await db.execute("UPDATE tasks", [updated]);
    loadTasks();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleDeleteTask = async (task: Task) => {
    // Soft delete -> move to recycle bin
    const updated = { ...task, isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.execute("UPDATE tasks", [updated]);
    await db.logEvent(currentUser?.id || "local_user", "TASK_DELETED", `Moved task '${task.title}' to Recycle Bin.`, task.id);
    loadTasks();
  };

  const handlePermanentDelete = async (task: Task) => {
    // Delete task and its subrelations
    await db.execute("DELETE FROM checklistItems WHERE taskId = ?", [task.id]);
    await db.execute("DELETE FROM subtasks WHERE taskId = ?", [task.id]);
    await db.execute("DELETE FROM reminders WHERE taskId = ?", [task.id]);
    await db.execute("DELETE FROM attachments WHERE taskId = ?", [task.id]);
    await db.execute("DELETE FROM tasks WHERE id = ?", [task.id]); // Emulated delete
    
    // Direct delete from IndexedDB objectStore is handled automatically by query parser, but let's wipe
    const transaction = db["db"]!.transaction("tasks", "readwrite");
    const store = transaction.objectStore("tasks");
    store.delete(task.id);

    await db.logEvent(currentUser?.id || "local_user", "TASK_PERMANENT_DELETE", `Permanently deleted task '${task.title}' and all checklist, subtask, and attachments.`, task.id);
    loadTasks();
  };

  const handleRestoreTask = async (task: Task) => {
    const updated = { ...task, isDeleted: false, deletedAt: undefined, updatedAt: new Date().toISOString() };
    await db.execute("UPDATE tasks", [updated]);
    await db.logEvent(currentUser?.id || "local_user", "TASK_RESTORED", `Restored task '${task.title}' from Recycle Bin.`, task.id);
    loadTasks();
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMessage(null);

    if (!newPassword || !confirmNewPassword) {
      setSettingsMessage({ type: "error", text: "Please enter both fields." });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setSettingsMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (newPassword.length < 8) {
      setSettingsMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    try {
      const salt = generateRandomBytes(16);
      const { hash } = await hashPassword(newPassword, salt);

      const updatedUser: User = {
        ...currentUser!,
        passwordHash: hash,
        salt,
        updatedAt: new Date().toISOString()
      } as any;

      await db.execute("UPDATE users SET", [updatedUser]);
      setCurrentUser(updatedUser);
      setMasterKey(hash);
      setNewPassword("");
      setConfirmNewPassword("");
      setSettingsMessage({ type: "success", text: "Master password successfully changed." });
      await db.logEvent(currentUser!.id, "PASSWORD_CHANGED", "Master password has been cryptographically rotated.");
    } catch (e) {
      setSettingsMessage({ type: "error", text: "Failed to update master password." });
    }
  };

  // Set PIN Handler
  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMessage(null);

    if (newPin && (newPin.length !== 4 || isNaN(Number(newPin)))) {
      setSettingsMessage({ type: "error", text: "PIN must be exactly 4 numeric digits." });
      return;
    }

    try {
      let pinHash = undefined;
      let pinSalt = undefined;

      if (newPin) {
        const pinObj = await hashPassword(newPin);
        pinHash = pinObj.hash;
        pinSalt = pinObj.salt;
      }

      const updatedUser: User = {
        ...currentUser!,
        pinHash,
        pinSalt
      };

      await db.execute("UPDATE users SET", [updatedUser]);
      setCurrentUser(updatedUser);
      setNewPin("");
      setSettingsMessage({ type: "success", text: newPin ? "PIN Lock successfully registered." : "PIN Lock removed." });
      await db.logEvent(currentUser!.id, "PIN_UPDATED", newPin ? "Security PIN set/rotated." : "Security PIN cleared.");
    } catch (e) {
      setSettingsMessage({ type: "error", text: "Failed to save secure PIN." });
    }
  };

  // Master reset
  const handleMasterReset = async () => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete all tasks, checklist items, files, backups, and user credentials. This operation cannot be undone. Proceed?")) {
      return;
    }

    try {
      const request = indexedDB.deleteDatabase("DailyTodoSQLiteDB");
      request.onsuccess = () => {
        localStorage.clear();
        window.location.reload();
      };
    } catch (e) {
      alert("Reset failed.");
    }
  };

  // Filter Tasks
  const getFilteredTasks = () => {
    return tasks.filter((task) => {
      // 1. Exclude deleted if not in recycle tab
      if (activeTab === "recycle") {
        return task.isDeleted;
      }
      if (task.isDeleted) return false;

      // 1.5 Handle Archive tab filtering versus active task filtering
      if (activeTab === "archive") {
        if (task.status !== TaskStatus.ARCHIVED) return false;
      } else {
        if (task.status === TaskStatus.ARCHIVED) return false;
      }

      // 2. Search query matches title, description, notes, tags
      const q = searchQuery.toLowerCase();
      if (q) {
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description.toLowerCase().includes(q);
        const matchNotes = task.notes.toLowerCase().includes(q);
        const matchTags = task.tags.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchNotes && !matchTags) return false;
      }

      // 3. Filter Priority
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;

      // 4. Filter Status
      if (filterStatus === "active") {
        if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.ARCHIVED) return false;
      } else if (filterStatus !== "all" && task.status !== filterStatus) {
        return false;
      }

      // 5. Filter Category
      if (filterCategory !== "all" && task.category !== filterCategory) return false;

      // 5.5 Filter Tag
      if (selectedTagFilter) {
        if (!task.tags || !task.tags.some(t => t.toLowerCase() === selectedTagFilter.toLowerCase())) {
          return false;
        }
      }

      // 6. Custom Date Range Filters
      if (filterDateOption === "today") {
        const todayStr = new Date().toISOString().split("T")[0];
        if (task.dueDate !== todayStr) return false;
      } else if (filterDateOption === "custom") {
        if (filterStartDate) {
          if (!task.dueDate || task.dueDate < filterStartDate) return false;
        }
        if (filterEndDate) {
          if (!task.dueDate || task.dueDate > filterEndDate) return false;
        }
      }

      return true;
    });
  };

  const handleSavePreset = () => {
    const name = presetNameInput.trim();
    if (!name) return;
    const newPreset: FilterPreset = {
      id: generateRandomBytes(16),
      name,
      searchQuery,
      filterPriority,
      filterStatus,
      filterCategory,
      selectedTagFilter,
      filterDateOption,
      filterStartDate,
      filterEndDate
    };
    const updated = [...filterPresets, newPreset];
    setFilterPresets(updated);
    localStorage.setItem("filter-presets", JSON.stringify(updated));
    setIsSavingPreset(false);
    setPresetNameInput("");
  };

  const applyPreset = (preset: FilterPreset) => {
    setSearchQuery(preset.searchQuery || "");
    setFilterPriority(preset.filterPriority as any || "all");
    setFilterStatus(preset.filterStatus as any || "all");
    setFilterCategory(preset.filterCategory || "all");
    setSelectedTagFilter(preset.selectedTagFilter || null);
    setFilterDateOption(preset.filterDateOption as any || "all");
    setFilterStartDate(preset.filterStartDate || "");
    setFilterEndDate(preset.filterEndDate || "");
  };

  const handleDeletePreset = (id: string) => {
    const updated = filterPresets.filter(p => p.id !== id);
    setFilterPresets(updated);
    localStorage.setItem("filter-presets", JSON.stringify(updated));
  };

  const filteredTasks = getFilteredTasks();

  // Keyboard Arrow key navigation and selection clamping
  useEffect(() => {
    if (filteredTasks.length === 0) {
      setFocusedTaskIndex(-1);
    } else if (focusedTaskIndex >= filteredTasks.length) {
      setFocusedTaskIndex(filteredTasks.length - 1);
    }
  }, [filteredTasks.length, focusedTaskIndex]);

  // Ctrl+K keyboard shortcut registration for global Command Palette
  useEffect(() => {
    const handleCtrlK = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleCtrlK);
    return () => {
      window.removeEventListener("keydown", handleCtrlK);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isEditable = document.activeElement?.getAttribute("contenteditable") === "true";
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT" || isEditable) {
        return;
      }

      if (!["ArrowUp", "ArrowDown", "Enter", "Space", " "].includes(e.key)) {
        return;
      }

      if (filteredTasks.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedTaskIndex((prev) => {
          const nextIndex = prev + 1;
          return nextIndex < filteredTasks.length ? nextIndex : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedTaskIndex((prev) => {
          const nextIndex = prev - 1;
          return nextIndex >= 0 ? nextIndex : prev;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (focusedTaskIndex >= 0 && focusedTaskIndex < filteredTasks.length) {
          handleEditTask(filteredTasks[focusedTaskIndex]);
        }
      } else if (e.key === " " || e.key === "Space") {
        e.preventDefault();
        if (focusedTaskIndex >= 0 && focusedTaskIndex < filteredTasks.length) {
          handleToggleComplete(filteredTasks[focusedTaskIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredTasks, focusedTaskIndex]);

  const renderMigrationModal = () => {
    if (!showMigrationPrompt) return null;
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6"
        >
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Database Migration Available</h3>
              <p className="text-xs text-slate-400 mt-1">
                We detected database records from your previous browser session. Would you like to migrate them to your new high-performance local SQLite database?
              </p>
            </div>
          </div>

          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 space-y-3">
            <div className="flex items-center space-x-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>This is a one-time import.</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Your existing tasks, habits, and configurations from the web browser will be loaded into the secure native SQLite storage.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={() => setShowMigrationPrompt(false)}
              disabled={isMigrating}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-indigo-600/25 transition-all"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Migrating...</span>
                </>
              ) : (
                <>
                  <span>Migrate Now</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  // Redirect to Auth if not logged in
  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onAuthSuccess={(user, key) => {
            setCurrentUser(user);
            setMasterKey(key);
            setIsLocked(false);
          }}
        />
        {renderMigrationModal()}
      </>
    );
  }

  return (
    <div id="app-root" className={`min-h-screen ${activeTheme === "light-contrast" ? "theme-light-contrast bg-app-bg text-app-text" : "bg-slate-50 text-slate-950"} flex flex-col md:flex-row font-sans`}>
      {renderMigrationModal()}
      {/* Mobile Header Bar */}
      <div className={`md:hidden ${activeTheme === "light-contrast" ? "bg-header-mobile-bg border-b border-card-border text-slate-900" : "bg-slate-900 text-white"} px-4 py-3 flex justify-between items-center shadow-md`}>
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-indigo-400" />
          <span className="font-extrabold tracking-tight">Daily Todo</span>
        </div>
        <button id="btn-toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded-lg hover:bg-slate-800/20">
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar mobile overlay backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-[1px] z-30 md:hidden"
        />
      )}

      {/* Desktop & Mobile Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 bg-sidebar-bg text-sidebar-text w-64 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out z-40 flex flex-col justify-between border-r border-card-border shadow-2xl`}>
        <div className="p-6 space-y-6 flex-1 flex flex-col min-h-0">
          <div className="hidden md:flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="leading-tight">
              <h2 className="font-extrabold text-sm tracking-tight text-sidebar-text">Daily Todo</h2>
              <span className="text-[10px] text-indigo-400 font-bold">Secure relational storage</span>
            </div>
          </div>

          {/* Command Palette Trigger Button */}
          <button 
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/40 hover:bg-slate-900/60 text-indigo-200 border border-indigo-500/10 rounded-xl text-[10px] font-bold cursor-pointer transition-all shrink-0"
            title="Open Command Palette (Ctrl+K)"
          >
            <span className="flex items-center space-x-1.5">
              <Command className="h-3.5 w-3.5 text-indigo-400" />
              <span>Command Palette</span>
            </span>
            <kbd className="bg-slate-950 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono text-[8px] tracking-wide text-indigo-300">Ctrl+K</kbd>
          </button>

          <div className="space-y-1.5 pt-4 overflow-y-auto pr-1">
            {[
              { id: "dashboard", label: "Overview Dashboard", icon: CheckSquare },
              { id: "pro-hub", label: "Academic Pro Suite", icon: Sparkles },
              { id: "exams", label: "Exam Manager", icon: GraduationCap },
              { id: "profile", label: "Profile Center", icon: UserIcon },
              { id: "achievements", label: "Achievements & XP", icon: Trophy },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
              { id: "todos", label: "Daily Tasks", icon: Calendar },
              { id: "rescheduler", label: "Smart Rescheduler", icon: RefreshCw },
              { id: "routines", label: "Daily Routines", icon: Clock },
              { id: "study", label: "Study Planner", icon: BookOpen },
              { id: "habits", label: "Habit Tracker", icon: Zap },
              { id: "targets", label: "Target Planner", icon: TargetIcon },
              { id: "notes", label: "Markdown Notes", icon: FileText },
              { id: "archive", label: "Task Archive", icon: Archive },
              { id: "roadmap", label: "Project Roadmap", icon: Map },
              { id: "pdf", label: "PDF Reports", icon: FileText },
              { id: "backup", label: "Backups & Import", icon: Database },
              { id: "audit", label: "Security Logs", icon: ShieldAlert },
              { id: "recycle", label: "Recycle Bin", icon: Trash },
              { id: "help", label: "Help Center", icon: HelpCircle },
              { id: "settings", label: "System Settings", icon: Settings },
              { id: "theme-settings", label: "Theme Customization", icon: Palette }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                      : "text-sidebar-text/75 hover:bg-sidebar-item-hover hover:text-sidebar-text"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tags Cloud Organization System */}
          <div className="pt-4 border-t border-card-border/20 space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-sidebar-text/60 uppercase tracking-wider">Tags Cloud</span>
              {selectedTagFilter && (
                <button
                  onClick={() => setSelectedTagFilter(null)}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold transition-all cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>
            {Object.keys(tagCounts).length === 0 ? (
              <p className="text-[10px] text-sidebar-text/40 italic">No tags defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {Object.entries(tagCounts).map(([tag, count]) => {
                  const isSelected = selectedTagFilter?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTagFilter(isSelected ? null : tag)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-sidebar-item-hover/50 hover:bg-sidebar-item-hover text-sidebar-text/70 border-card-border/10 hover:text-sidebar-text"
                      }`}
                    >
                      <span>#{tag}</span>
                      <span className={`text-[8px] px-1 rounded ${isSelected ? "bg-indigo-700 text-indigo-100" : "bg-sidebar-item-hover text-sidebar-text/40"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* User Info & Lock controls */}
        <div className="p-6 border-t border-card-border/25 space-y-3 bg-slate-950/20">
          {/* EOD Review Button */}
          <div className="pb-1">
            <button
              onClick={() => setShowEodModal(true)}
              className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/10 transition-colors cursor-pointer"
            >
              <Zap className="h-4 w-4 text-amber-300 animate-pulse" />
              <span>End of Day Review</span>
            </button>
          </div>

          {/* Theme Toggle Button */}
          <div className="pb-2 border-b border-card-border/10">
            <button
              id="btn-toggle-theme"
              onClick={() => setActiveTheme(activeTheme === "dark-plum" ? "light-contrast" : "dark-plum")}
              className="w-full px-3 py-2 bg-sidebar-item-hover/40 hover:bg-sidebar-item-hover border border-card-border/10 rounded-xl text-xs font-bold text-sidebar-text/80 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center space-x-2">
                {activeTheme === "dark-plum" ? (
                  <>
                    <Moon className="h-4 w-4 text-indigo-400" />
                    <span>Dark Plum Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4 text-fuchsia-500" />
                    <span>Light Purple-Pink</span>
                  </>
                )}
              </span>
              <span className="text-[9px] bg-slate-950/50 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Toggle
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-400">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-sidebar-text truncate">{currentUser.username}</p>
              <p className="text-[9px] text-sidebar-text/40 truncate">127.0.0.1 • Offline</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              id="btn-lock-session"
              onClick={handleLock}
              className="px-3 py-1.5 bg-sidebar-item-hover/40 hover:bg-sidebar-item-hover text-sidebar-text/80 text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors border border-card-border/10"
            >
              <Lock className="h-3 w-3" />
              <span>Lock App</span>
            </button>

            <button
              id="btn-logout-session"
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors border border-red-900/10"
            >
              <LogOut className="h-3 w-3" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 shadow-xl z-30 md:hidden flex justify-around items-center px-4 pb-safe">
        {[
          { id: "dashboard", label: "Dashboard", icon: CheckSquare },
          { id: "todos", label: "Tasks", icon: Calendar },
          { id: "study", label: "Study", icon: BookOpen },
          { id: "habits", label: "Habits", icon: Zap },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all ${
                isActive ? "text-indigo-600 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}
        {/* Hamburger Trigger for more sections */}
        <button
          onClick={() => setSidebarOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all ${
            sidebarOpen ? "text-indigo-600 font-bold scale-105" : "text-slate-400"
          }`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="p-6 pb-24 md:p-8 md:pb-8 w-full max-w-none space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {!isFocusActiveInApp && (
                  <div className="flex justify-between items-center animate-fadeIn">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                        Welcome Back! <Sparkles className="h-5 w-5 text-indigo-500 ml-1.5 animate-bounce" />
                      </h1>
                      <p className="text-xs text-slate-500">Here is your local offline productivity checkpoint.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        id="btn-goto-analytics"
                        onClick={() => setActiveTab("analytics")}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer"
                      >
                        <BarChart3 className="h-4 w-4 text-slate-500" />
                        <span>View Analytics</span>
                      </button>
                      <button
                        id="btn-add-task-dash"
                        onClick={() => { setEditingTask(null); setIsTaskFormOpen(true); }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-md shadow-indigo-100 transition-all cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create Task</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Daily Focus Panel */}
                <FocusModePanel 
                  tasks={tasks} 
                  onTaskUpdated={loadTasks} 
                  onFocusActiveChange={(active) => setIsFocusActiveInApp(active)}
                />

                {/* Focus Timer Station */}
                {!isFocusActiveInApp && (
                  <FocusTimer 
                    tasks={tasks.filter(t => t.status !== TaskStatus.COMPLETED && !t.isDeleted).map(t => ({ id: t.id, title: t.title }))}
                    onSessionComplete={() => {
                      loadTasks(); // reload to refresh completed activities, achievements and logs
                    }}
                  />
                )}

                {!isFocusActiveInApp && (
                  <div className="space-y-6 animate-fadeIn">
                    <DashboardWidget tasks={tasks.filter(t => !t.isDeleted)} onTaskAdded={loadTasks} />

                    {/* Overdue Warnings */}
                    {tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split("T")[0] && t.status !== TaskStatus.COMPLETED && !t.isDeleted).length > 0 && (
                      <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start space-x-3 text-orange-800 text-xs font-semibold">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500 mt-0.5" />
                        <div>
                          <p>Warning: You have overdue tasks remaining!</p>
                          <button onClick={() => setActiveTab("todos")} className="text-indigo-600 hover:underline mt-1 font-bold">View Overdue Tasks</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "rescheduler" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                      Intelligent Rescheduler <RefreshCw className="h-5 w-5 text-indigo-500 ml-1.5" />
                    </h1>
                    <p className="text-xs text-slate-500">Heuristic schedule alignment, timeline conflict solvers, and backlog managers.</p>
                  </div>
                </div>
                <IntelligentRescheduler tasks={tasks} onTasksUpdated={loadTasks} />
              </motion.div>
            )}

            {activeTab === "pro-hub" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <ProSuiteHub onTasksUpdated={loadTasks} activeTheme={activeTheme} />
              </motion.div>
            )}

            {activeTab === "analytics" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                      Interactive Analytics <BarChart3 className="h-5 w-5 text-indigo-500 ml-1.5" />
                    </h1>
                    <p className="text-xs text-slate-500">Real-time productivity trends and task category distributions.</p>
                  </div>
                </div>
                <AnalyticsView tasks={tasks} />
              </motion.div>
            )}

            {activeTab === "todos" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Daily Todos Control Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Search className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      id="input-search-tasks"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const term = searchQuery.trim();
                          if (term && !recentSearches.includes(term)) {
                            const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
                            setRecentSearches(updated);
                            localStorage.setItem("recent-searches", JSON.stringify(updated));
                          }
                        }
                      }}
                      onBlur={() => {
                        const term = searchQuery.trim();
                        if (term && !recentSearches.includes(term)) {
                          const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
                          setRecentSearches(updated);
                          localStorage.setItem("recent-searches", JSON.stringify(updated));
                        }
                      }}
                      placeholder="Search task title, desc, labels..."
                      className="block w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* View Modes selectors */}
                  <div className="flex items-center space-x-1 border border-slate-200 p-1 rounded-xl shrink-0 bg-slate-50">
                    {[
                      { id: "list", label: "List" },
                      { id: "card", label: "Card" },
                      { id: "kanban", label: "Kanban" },
                      { id: "calendar", label: "Calendar" },
                      { id: "timeline", label: "Timeline" },
                      { id: "agenda", label: "Agenda" },
                      { id: "table", label: "Table" }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        id={`btn-viewmode-${mode.id}`}
                        onClick={() => setViewMode(mode.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                          viewMode === mode.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <button
                    id="btn-create-task-todos"
                    onClick={() => { setEditingTask(null); setIsTaskFormOpen(true); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-md shadow-indigo-100 shrink-0 cursor-pointer"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    <span>Create Task</span>
                  </button>
                </div>

                {/* Recent Searches & Saved Presets Component */}
                <div className="bg-white border border-slate-100 p-4 rounded-2xl space-y-3.5 shadow-sm">
                  {/* Row 1: Recent Searches & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-500 flex items-center shrink-0">
                        <Search className="h-3.5 w-3.5 mr-1 text-slate-400" /> Recent:
                      </span>
                      {recentSearches.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">No recent searches.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((term, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSearchQuery(term)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                            >
                              {term}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setRecentSearches([]);
                              localStorage.removeItem("recent-searches");
                            }}
                            className="text-[10px] text-red-500 hover:text-red-600 font-bold ml-1 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Preset Saving Inline Trigger */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {isSavingPreset ? (
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            placeholder="Preset Name..."
                            value={presetNameInput}
                            onChange={(e) => setPresetNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSavePreset();
                              }
                            }}
                            className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32 font-bold"
                          />
                          <button
                            onClick={handleSavePreset}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsSavingPreset(false)}
                            className="text-slate-400 hover:text-slate-600 text-[10px] font-bold px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPresetNameInput("");
                            setIsSavingPreset(true);
                          }}
                          className="px-3 py-1 bg-white border border-slate-200 text-slate-600 hover:text-slate-800 text-[10px] font-bold rounded-xl flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-500 animate-pulse" />
                          <span>Save Current Filters as Preset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Preset Tabs row */}
                  <div className="flex items-center space-x-2 border-t border-slate-100/60 pt-3 text-xs">
                    <span className="font-bold text-slate-500 shrink-0">Preset Tabs:</span>
                    <div className="flex flex-wrap gap-1.5 overflow-x-auto py-0.5 max-w-full">
                      {filterPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center bg-slate-50 border border-slate-150/80 rounded-xl px-2.5 py-1 text-[10px] font-bold shadow-sm space-x-1.5 hover:border-indigo-200 transition-colors"
                        >
                          <button
                            onClick={() => applyPreset(preset)}
                            className="text-slate-700 hover:text-indigo-600 cursor-pointer"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Delete preset"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {filterPresets.length === 0 && (
                        <span className="text-slate-400 italic text-[11px]">No saved presets yet.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Advanced Filters Drawer */}
                <div className="bg-white p-4 border border-slate-100 rounded-2xl shadow-sm flex flex-wrap gap-4 items-center">
                  <span className="text-xs font-bold text-slate-500 flex items-center">
                    <Filter className="h-3.5 w-3.5 mr-1" /> Active Filters:
                  </span>

                  {/* Filter Status */}
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-slate-400">Status:</span>
                    <select
                      id="filter-select-status"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="border-none bg-slate-50 px-2 py-1 rounded-lg font-semibold text-slate-700"
                    >
                      <option value="active">Active (Pending)</option>
                      <option value="all">All</option>
                      <option value={TaskStatus.TODO}>Todo</option>
                      <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                      <option value={TaskStatus.WAITING}>Waiting</option>
                      <option value={TaskStatus.COMPLETED}>Completed</option>
                      <option value={TaskStatus.ARCHIVED}>Archived</option>
                    </select>
                  </div>

                  {/* Filter Priority */}
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-slate-400">Priority:</span>
                    <select
                      id="filter-select-priority"
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value as any)}
                      className="border-none bg-slate-50 px-2 py-1 rounded-lg font-semibold text-slate-700"
                    >
                      <option value="all">All</option>
                      <option value={TaskPriority.NONE}>None</option>
                      <option value={TaskPriority.LOW}>Low</option>
                      <option value={TaskPriority.MEDIUM}>Medium</option>
                      <option value={TaskPriority.HIGH}>High</option>
                      <option value={TaskPriority.CRITICAL}>Critical</option>
                    </select>
                  </div>

                  {/* Filter Category */}
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-slate-400">Category:</span>
                    <select
                      id="filter-select-category"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="border-none bg-slate-50 px-2 py-1 rounded-lg font-semibold text-slate-700"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Date Option */}
                  <div className="flex items-center space-x-1 text-xs border-l border-slate-150 pl-4">
                    <span className="text-slate-400">Date Option:</span>
                    <select
                      id="filter-select-date-option"
                      value={filterDateOption}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setFilterDateOption(val);
                        if (val !== "custom") {
                          setFilterStartDate("");
                          setFilterEndDate("");
                        }
                      }}
                      className="border-none bg-slate-50 px-2 py-1 rounded-lg font-semibold text-slate-700"
                    >
                      <option value="all">All Dates</option>
                      <option value="today">Today</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {/* Filter Date Range (only if custom is selected) */}
                  {filterDateOption === "custom" && (
                    <div className="flex items-center space-x-2 text-xs border-l border-slate-100 pl-4">
                      <span className="text-slate-400">From:</span>
                      <input
                        id="filter-input-start-date"
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-slate-400">To:</span>
                      <input
                        id="filter-input-end-date"
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {(filterStartDate || filterEndDate) && (
                        <button
                          id="btn-clear-date-filter"
                          type="button"
                          onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
                          className="text-[10px] text-red-500 hover:text-red-700 font-bold ml-1 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Grid Renderers */}
                <div className="space-y-4">
                  {viewMode === "list" && (
                    <ListView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      onUpdateTask={handleUpdateTask}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelectTask={handleToggleSelectTask}
                      focusedTaskId={focusedTaskIndex >= 0 && focusedTaskIndex < filteredTasks.length ? filteredTasks[focusedTaskIndex].id : null}
                      onReorderTasks={handleReorderTasks}
                      allExistingTags={Object.keys(tagCounts)}
                    />
                  )}
                  {viewMode === "card" && (
                    <CardView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      onUpdateTask={handleUpdateTask}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelectTask={handleToggleSelectTask}
                    />
                  )}
                  {viewMode === "kanban" && (
                    <KanbanView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelectTask={handleToggleSelectTask}
                    />
                  )}
                  {viewMode === "calendar" && (
                    <CalendarView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                    />
                  )}
                  {viewMode === "agenda" && (
                    <AgendaView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelectTask={handleToggleSelectTask}
                    />
                  )}
                  {viewMode === "table" && (
                    <TableView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelectTask={handleToggleSelectTask}
                    />
                  )}
                  {viewMode === "timeline" && (
                    <TimelineView
                      tasks={filteredTasks}
                      onToggleComplete={handleToggleComplete}
                      onEditTask={handleEditTask}
                      onDeleteTask={handleDeleteTask}
                      onToggleFavorite={handleToggleFavorite}
                      onTogglePin={handleTogglePin}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelectTask={handleToggleSelectTask}
                    />
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "exams" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <ExamManager onRefreshNeeded={loadTasks} activeTheme={activeTheme} />
              </motion.div>
            )}

            {activeTab === "help" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <HelpCenter onRefreshNeeded={loadTasks} activeTheme={activeTheme} />
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <ProfileCenter onRefreshNeeded={loadTasks} activeTheme={activeTheme} />
              </motion.div>
            )}

            {activeTab === "achievements" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AchievementCenter activeUser={currentUser?.id || "local_user"} />
              </motion.div>
            )}

            {activeTab === "roadmap" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <RoadmapTree />
              </motion.div>
            )}

            {activeTab === "pdf" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <PDFExport tasks={tasks.filter(t => !t.isDeleted)} />
              </motion.div>
            )}

            {activeTab === "backup" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <BackupPanel onRestoreCompleted={loadTasks} />
              </motion.div>
            )}

            {activeTab === "audit" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AuditLogView />
              </motion.div>
            )}

            {activeTab === "archive" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100/60">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Task Archive</h4>
                    <p className="text-xs text-slate-500">
                      Safely preserve historical completed tasks without cluttering your primary Daily Tasks view.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {tasks.filter(t => t.status === TaskStatus.ARCHIVED && !t.isDeleted).map((task) => (
                    <div key={task.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-white border border-slate-100 rounded-xl shadow-xs gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="text-sm font-bold text-slate-800">{task.title}</h5>
                          {task.category && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                              {task.category}{task.subCategory ? ` › ${task.subCategory}` : ""}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-500 max-w-xl">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 font-semibold mr-1">
                            Archived: {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "Recently"}
                          </span>
                          {task.tags && task.tags.map((tag, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-indigo-50/80 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100/50">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2 shrink-0">
                        <button
                          onClick={async () => {
                            const updated = {
                              ...task,
                              status: TaskStatus.TODO,
                              updatedAt: new Date().toISOString()
                            };
                            await db.execute("UPDATE tasks", [updated]);
                            await db.logEvent(currentUser?.id || "local_user", "TASK_RESTORED_FROM_ARCHIVE", `Restored task '${task.title}' from Archive to Daily Tasks.`, task.id);
                            loadTasks();
                          }}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                        >
                          Restore to List
                        </button>

                        <button
                          onClick={() => handleDeleteTask(task)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.status === TaskStatus.ARCHIVED && !t.isDeleted).length === 0 && (
                    <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl">
                      <Archive className="h-10 w-10 text-slate-300 mx-auto mb-2.5 animate-pulse" />
                      <p className="text-xs text-slate-400 font-bold">No tasks in your archive.</p>
                      <p className="text-[10px] text-slate-400/80 mt-1 max-w-xs mx-auto">
                        Tasks will appear here when completed tasks are archived manually or via auto-archive rules.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "recycle" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Recycle Bin</h4>
                    <p className="text-xs text-slate-500">Safely recover soft-deleted items or permanently remove them from local SQLite storage.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {tasks.filter(t => t.isDeleted).map((task) => (
                    <div key={task.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-xl shadow-xs">
                      <div>
                        <h5 className="text-sm font-bold text-slate-800">{task.title}</h5>
                        <p className="text-[10px] text-slate-400">Deleted: {task.deletedAt ? new Date(task.deletedAt).toLocaleString() : "Recently"}</p>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRestoreTask(task)}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-indigo-600 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Restore
                        </button>

                        <button
                          onClick={() => handlePermanentDelete(task)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Delete Permanently
                        </button>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.isDeleted).length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-12 font-medium">Recycle Bin is empty.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "routines" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <DailyRoutinePlanner onActivityLogged={loadTasks} />
              </motion.div>
            )}

            {activeTab === "study" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <StudyPlanner onActivityLogged={loadTasks} />
              </motion.div>
            )}

            {activeTab === "habits" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <HabitTracker onActivityLogged={loadTasks} />
              </motion.div>
            )}

            {activeTab === "targets" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <TargetPlanner onActivityLogged={loadTasks} />
              </motion.div>
            )}

            {activeTab === "notes" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <NotesManager onActivityLogged={loadTasks} />
              </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h4 className="text-base font-extrabold text-slate-900">System Security Options</h4>
                    <p className="text-xs text-slate-500">Update local master codes and inactivity lockouts.</p>
                  </div>

                  {settingsMessage && (
                    <div className={`p-4 rounded-xl border text-xs font-semibold ${
                      settingsMessage.type === "success" ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
                    }`}>
                      {settingsMessage.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Rotate Master Code */}
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <h5 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Change Master Password</h5>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">New Password (Min 8 chars)</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="block w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="block w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100"
                      >
                        Rotate Master Key
                      </button>
                    </form>

                    {/* PIN Config */}
                    <form onSubmit={handleSetPin} className="space-y-4 border-l border-slate-100 pl-0 md:pl-6">
                      <h5 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">PIN Lock Setup</h5>
                      <p className="text-xs text-slate-500">
                        Configure a rapid 4-digit code to lock and unlock the interface. Leave blank and submit to disable.
                      </p>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Enter 4-Digit PIN</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                          placeholder="••••"
                          className="block w-40 px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-center font-mono tracking-widest text-lg"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        Register PIN Lock
                      </button>
                    </form>
                  </div>

                  <div className="border-t border-slate-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Auto Lock timer */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Inactivity Timeout</h5>
                      <p className="text-xs text-slate-500">
                        Automatically lock the app context and trigger password/PIN challenge after periods of idle inactivity.
                      </p>
                      <select
                        value={inactivityTimeout}
                        onChange={(e) => setInactivityTimeout(Number(e.target.value))}
                        className="block w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700"
                      >
                        <option value={1}>1 Minute</option>
                        <option value={5}>5 Minutes</option>
                        <option value={10}>10 Minutes (Default)</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour</option>
                      </select>
                    </div>

                    {/* Factory wipe */}
                    <div className="space-y-3 border-l border-slate-100 pl-0 md:pl-6">
                      <h5 className="text-xs font-extrabold uppercase text-red-500 tracking-wider flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1 text-red-500" /> Administrative Factory Reset
                      </h5>
                      <p className="text-xs text-slate-500">
                        Wipe the secure local relational database completely, clearing keys, logs, attachments, and login access.
                      </p>
                      <button
                        type="button"
                        onClick={handleMasterReset}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl"
                      >
                        Secure Wipe Database
                      </button>
                    </div>
                  </div>
                </div>

                <AppHealthMonitor />

                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h4 className="text-base font-extrabold text-slate-900">Task Management & Archiving</h4>
                    <p className="text-xs text-slate-500">Configure parameters for automatic task archival.</p>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Auto-Archive Completed Tasks</h5>
                    <p className="text-xs text-slate-500">
                      When enabled, completed tasks will be automatically moved to the Task Archive after a specified duration. Archived tasks are kept safe in your local encrypted storage and can be viewed under the "Task Archive" tab.
                    </p>
                    <div className="max-w-xs">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Auto-Archive Delay</label>
                      <select
                        value={autoArchiveOption}
                        onChange={(e) => setAutoArchiveOption(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700"
                      >
                        <option value="disabled">Disabled (Do not archive automatically)</option>
                        <option value="immediate">Immediately</option>
                        <option value="1h">After 1 hour</option>
                        <option value="12h">After 12 hours</option>
                        <option value="24h">After 24 hours</option>
                        <option value="3d">After 3 days</option>
                        <option value="7d">After 7 days</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h4 className="text-base font-extrabold text-slate-900">Notification Preferences & Quiet Hours</h4>
                    <p className="text-xs text-slate-500">Configure when you want to receive alerts and set Quiet Hours.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Permission Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 border border-slate-100 rounded-2xl">
                      <div>
                        <div className="text-xs font-bold text-slate-700">System Notification Permission</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {systemPermissionStatus === "granted"
                            ? "Permission Granted. Notifications are active."
                            : systemPermissionStatus === "denied"
                            ? "Permission Denied. Please enable notifications in your system settings."
                            : "Permission not yet requested or pending."}
                        </div>
                      </div>
                      
                      {systemPermissionStatus !== "granted" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const granted = await NotificationService.requestPermission();
                            setSystemPermissionStatus(granted ? "granted" : "denied");
                            if (granted) {
                              NotificationService.sendNotification("Notifications Enabled!", "You will now receive task and routine alerts.");
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100"
                        >
                          Enable Notifications
                        </button>
                      )}

                      {systemPermissionStatus === "granted" && (
                        <button
                          type="button"
                          onClick={() => {
                            NotificationService.sendNotification("Test Notification", "This is a test notification from your Study & Routine Planner.");
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all"
                        >
                          Send Test Notification
                        </button>
                      )}
                    </div>

                    {/* Quiet Hours form elements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Quiet Hours Start</label>
                        <input
                          type="time"
                          value={localStorage.getItem(`sched-quiet-start-${currentUser?.id}`) || "18:00"}
                          onChange={(e) => {
                            localStorage.setItem(`sched-quiet-start-${currentUser?.id}`, e.target.value);
                            setTasks([...tasks]); // force update
                          }}
                          className="block w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Quiet Hours End</label>
                        <input
                          type="time"
                          value={localStorage.getItem(`sched-quiet-end-${currentUser?.id}`) || "20:00"}
                          onChange={(e) => {
                            localStorage.setItem(`sched-quiet-end-${currentUser?.id}`, e.target.value);
                            setTasks([...tasks]); // force update
                          }}
                          className="block w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      During Quiet Hours, browser notifications will be automatically muted so you can focus or rest peacefully.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "theme-settings" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className={`border rounded-2xl p-6 shadow-sm space-y-6 ${activeTheme === "light-contrast" ? "bg-white border-slate-100" : "bg-slate-900 border-slate-800"}`}>
                  <div className={`border-b pb-4 ${activeTheme === "light-contrast" ? "border-slate-100" : "border-slate-800"}`}>
                    <h4 className={`text-base font-extrabold ${activeTheme === "light-contrast" ? "text-slate-900" : "text-white"}`}>Theme Customization</h4>
                    <p className={`text-xs ${activeTheme === "light-contrast" ? "text-slate-500" : "text-slate-400"}`}>Choose how the academic system looks on your device.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Dark Plum Theme Card */}
                    <button
                      type="button"
                      onClick={() => setThemeMode("dark-plum")}
                      className={`group p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden cursor-pointer ${
                        themeMode === "dark-plum"
                          ? "bg-slate-950 border-indigo-500 ring-2 ring-indigo-500/20"
                          : activeTheme === "light-contrast"
                            ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                            : "bg-slate-950/40 hover:bg-slate-950/60 border-slate-800"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-950/40 text-indigo-400 rounded-xl">
                          <Moon className="h-5 w-5" />
                        </div>
                        {themeMode === "dark-plum" && (
                          <span className="text-[9px] bg-indigo-500 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <h5 className={`text-sm font-bold ${activeTheme === "light-contrast" && themeMode !== "dark-plum" ? "text-slate-900" : "text-white"}`}>Dark Plum</h5>
                      <p className={`text-xs mt-1.5 ${activeTheme === "light-contrast" && themeMode !== "dark-plum" ? "text-slate-500" : "text-indigo-200/60"}`}>
                        A cozy deep violet and plum canvas optimized for long nighttime study sessions and low-light environments.
                      </p>
                      <div className="mt-4 flex items-center space-x-1">
                        <span className="w-4 h-4 rounded-full bg-slate-950 border border-indigo-500/30"></span>
                        <span className="w-4 h-4 rounded-full bg-indigo-600"></span>
                        <span className="w-4 h-4 rounded-full bg-purple-600"></span>
                      </div>
                    </button>

                    {/* Light Contrast Theme Card */}
                    <button
                      type="button"
                      onClick={() => setThemeMode("light-contrast")}
                      className={`group p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden cursor-pointer ${
                        themeMode === "light-contrast"
                          ? "bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-md"
                          : activeTheme === "light-contrast"
                            ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                            : "bg-slate-950/40 hover:bg-slate-950/60 border-slate-800"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
                          <Sun className="h-5 w-5" />
                        </div>
                        {themeMode === "light-contrast" && (
                          <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <h5 className={`text-sm font-bold ${activeTheme === "light-contrast" ? "text-slate-900" : "text-white"}`}>Light (Purple-Pink)</h5>
                      <p className={`text-xs mt-1.5 ${activeTheme === "light-contrast" ? "text-slate-500" : "text-slate-400"}`}>
                        A bright, fully purple/pink themed palette focusing on a warm, energetic look while staying legible.
                      </p>
                      <div className="mt-4 flex items-center space-x-1">
                        <span className="w-4 h-4 rounded-full bg-white border border-slate-300"></span>
                        <span className="w-4 h-4 rounded-full bg-indigo-600"></span>
                        <span className="w-4 h-4 rounded-full bg-slate-800"></span>
                      </div>
                    </button>

                    {/* System Preference Theme Card */}
                    <button
                      type="button"
                      onClick={() => setThemeMode("system")}
                      className={`group p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden cursor-pointer ${
                        themeMode === "system"
                          ? activeTheme === "light-contrast"
                            ? "bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-md"
                            : "bg-slate-950 border-indigo-500 ring-2 ring-indigo-500/20"
                          : activeTheme === "light-contrast"
                            ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                            : "bg-slate-950/40 hover:bg-slate-950/60 border-slate-800"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${activeTheme === "light-contrast" ? "bg-slate-100 text-slate-700" : "bg-slate-800 text-indigo-400"}`}>
                          <Palette className="h-5 w-5" />
                        </div>
                        {themeMode === "system" && (
                          <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <h5 className={`text-sm font-bold ${activeTheme === "light-contrast" ? "text-slate-900" : "text-white"}`}>System Preference</h5>
                      <p className={`text-xs mt-1.5 ${activeTheme === "light-contrast" ? "text-slate-500" : "text-slate-400"}`}>
                        Automatically adjust the interface based on your operating system’s current dark or light mode setting.
                      </p>
                      <div className="mt-4 flex items-center space-x-1">
                        <span className="text-[10px] font-bold text-slate-400">Current match: </span>
                        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${activeTheme === "dark-plum" ? "bg-slate-950 text-indigo-300" : "bg-slate-100 text-slate-700"}`}>
                          {activeTheme === "dark-plum" ? "Dark Plum 🌙" : "Light Purple-Pink ☀️"}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Task Creation & Editing Drawer Modal */}
      {isTaskFormOpen && (
        <TaskForm
          task={editingTask}
          onClose={() => {
            setIsTaskFormOpen(false);
            setEditingTask(null);
          }}
          onSave={loadTasks}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedTaskIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl px-6 py-4 flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-6 z-50 animate-fadeIn"
          >
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">
                {selectedTaskIds.length} Task{selectedTaskIds.length > 1 ? "s" : ""} Selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBulkComplete}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20"
              >
                Bulk Complete
              </button>

              <button
                onClick={handleBulkArchive}
                className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-900/50 text-amber-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
              >
                Bulk Archive
              </button>

              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
              >
                Bulk Delete
              </button>

              <div className="flex items-center bg-slate-800/80 rounded-xl border border-slate-750 px-2 py-0.5">
                <span className="text-[9px] text-slate-400 font-bold mr-1">Add Tag:</span>
                <input
                  type="text"
                  placeholder="press enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        handleBulkAddTag(val);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                  className="bg-transparent border-none text-[10px] font-bold text-slate-200 focus:outline-none placeholder-slate-500 w-20"
                />
              </div>

              <div className="flex items-center bg-slate-800/80 rounded-xl border border-slate-750 px-2 py-0.5">
                <span className="text-[9px] text-slate-400 font-bold mr-1">Move to:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkMoveCategory(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-transparent border-none text-[10px] font-bold text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                  ))}
                  <option value="General" className="bg-slate-900">General</option>
                  <option value="Personal" className="bg-slate-900">Personal</option>
                  <option value="Work" className="bg-slate-900">Work</option>
                </select>
              </div>

              <button
                onClick={() => setSelectedTaskIds([])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification with Undo */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center justify-between space-x-6 z-50 max-w-sm"
          >
            <div className="flex items-center space-x-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <p className="text-xs font-bold text-slate-200">{toast.message}</p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {toast.onUndo && (
                <button
                  onClick={async () => {
                    if (toast.onUndo) {
                      await toast.onUndo();
                    }
                    setToast(null);
                  }}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold rounded-lg transition-all cursor-pointer shadow-sm shadow-indigo-600/15"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End of Day Review Modal */}
      <EodReviewModal
        isOpen={showEodModal}
        onClose={() => setShowEodModal(false)}
        tasks={tasks}
        onActivityLogged={loadTasks}
        onNavigateToTab={(tab) => {
          setActiveTab(tab);
          setShowEodModal(false);
        }}
      />

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTasksUpdated={loadTasks}
        activeTheme={activeTheme}
        setActiveTheme={setActiveTheme}
      />

      {/* Onboarding First-Run Experience */}
      {showFirstRun && currentUser && (
        <FirstRunExperience
          currentUser={currentUser}
          activeTheme={activeTheme}
          onComplete={() => {
            setShowFirstRun(false);
            loadTasks();
            // Dispatch a refresh signal so all sub-components re-query their datasets
            try {
              window.dispatchEvent(new Event("onboarding-completed"));
            } catch (e) {}
          }}
        />
      )}
    </div>
  );
}
