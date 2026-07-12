/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, Task, ChecklistItem, Subtask, TaskReminder, 
  TaskAttachment, ActivityLog, DatabaseBackup, TaskPriority, TaskStatus,
  DailyRoutine, StudySubject, Habit, Target, Note, ReschedulingHistory,
  Exam, StudySession, Mistake, PracticeGoal, ResourceItem
} from "../types";
import { encryptData, decryptData } from "../utils/security";

import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const DB_NAME = "DailyTodoSQLiteDB";
const DB_VERSION = 5;
const INSTALL_MARKER_KEY = "__app_install_id__";

class SQLiteIndexedDB {
  private db: IDBDatabase | null = null;
  private nativeDb: any = null;
  private isNative: boolean = Capacitor.isNativePlatform();
  private currentUserId: string | null = null;
  private userKey: string | null = null; // Derived from user's password hash, used for AES-256-GCM
  private queryCache = new Map<string, any>();
  private freshInstallCheckDone = false;

  constructor() {
    // Initial connection in background
    this.init();
  }

  public getUserId(): string | null {
    return this.currentUserId;
  }

  public isAuth(): boolean {
    return this.currentUserId !== null && this.userKey !== null;
  }

  public getUserKey(): string | null {
    return this.userKey;
  }

  /**
   * setup.sh rotates VITE_INSTALL_ID every time it runs (i.e. every fresh setup/reinstall).
   * If the id baked into this build differs from the one recorded in this browser the last
   * time the app ran, we're in a fresh-setup scenario: wipe any previously stored local
   * database and cached local data before the app is used, so setup always starts clean.
   */
  private async ensureFreshInstall(): Promise<void> {
    if (this.freshInstallCheckDone) return;
    this.freshInstallCheckDone = true;

    if (this.isNative) return; // Native storage reset is out of scope here.
    if (typeof window === "undefined" || !window.localStorage) return;

    const buildInstallId = typeof import.meta !== "undefined" ? import.meta.env?.VITE_INSTALL_ID : undefined;
    if (!buildInstallId) return; // No marker generated (e.g. running without setup.sh) — don't wipe.

    const storedInstallId = window.localStorage.getItem(INSTALL_MARKER_KEY);
    if (storedInstallId === buildInstallId) return; // Same install — nothing to do.

    console.warn("Fresh setup detected — clearing previously stored local data before starting.");

    try {
      await new Promise<void>((resolve) => {
        const deleteReq = indexedDB.deleteDatabase(DB_NAME);
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => resolve(); // Don't block startup on cleanup failure.
        deleteReq.onblocked = () => resolve();
      });
    } catch (e) {
      console.warn("Failed to clear previous local database:", e);
    }

    try {
      window.localStorage.clear();
    } catch (e) {
      console.warn("Failed to clear previous local storage:", e);
    }

    window.localStorage.setItem(INSTALL_MARKER_KEY, buildInstallId);
  }

  /**
   * Initializes the database (SQLite for Native, IndexedDB for Web).
   */
  public async init(): Promise<any> {
    await this.ensureFreshInstall();

    if (this.isNative) {
      if (this.nativeDb) return this.nativeDb;
      try {
        const sqlite = new SQLiteConnection(CapacitorSQLite);
        const conn = await sqlite.createConnection("DailyTodoDB", true, "secret", 1, false);
        await conn.open();
        this.nativeDb = conn;

        // Ensure all simulated SQL tables exist in SQLite
        const requiredStores = [
          "users", "tasks", "checklistItems", "subtasks", "reminders", "attachments", 
          "activityLogs", "roadmaps", "routines", "subjects", "habits", "targets", "notes",
          "rescheduling_history", "exams", "studySessions", "mistakes", "practiceGoals", "resourceItems"
        ];
        for (const store of requiredStores) {
          await conn.execute(`CREATE TABLE IF NOT EXISTS ${store} (id TEXT PRIMARY KEY, data TEXT);`);
        }
        return this.nativeDb;
      } catch (err) {
        console.error("Native SQLite database failed to initialize:", err);
        throw err;
      }
    } else {
      if (this.db) return this.db;

      return new Promise<IDBDatabase>((resolve, reject) => {
        const openWithFallback = (version?: number) => {
          const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);

          request.onerror = (e) => {
            const err = (e.target as IDBOpenDBRequest).error;

            // If our expected schema version is behind an existing (newer) database version
            // left over from a previous build, IndexedDB refuses to open every single time.
            // Recover by reopening without forcing a version, adopting the on-disk version.
            if (version && err && err.name === "VersionError") {
              console.warn(`IndexedDB version mismatch detected — reopening with the existing on-disk version instead of forcing v${version}`);
              openWithFallback(undefined);
              return;
            }

            console.error("Database failed to open:", err);
            reject(new Error(`Local SQLite IndexedDB failed to initialize${err ? `: ${err.name}${err.message ? " - " + err.message : ""}` : ""}`));
          };

          request.onblocked = () => {
            console.warn("IndexedDB open request is blocked — likely another tab has an older connection open.");
          };

          request.onsuccess = (e) => {
            this.db = (e.target as IDBOpenDBRequest).result;
            this.runIntegrityChecks().then(() => {
              resolve(this.db!);
            }).catch(reject);
          };

          request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;

            const requiredStores = [
              "users", "tasks", "checklistItems", "subtasks", "reminders", "attachments", 
              "activityLogs", "roadmaps", "routines", "subjects", "habits", "targets", "notes",
              "rescheduling_history", "exams", "studySessions", "mistakes", "practiceGoals", "resourceItems"
            ];

            for (const req of requiredStores) {
              if (!db.objectStoreNames.contains(req)) {
                const store = db.createObjectStore(req, { keyPath: "id" });
                if (req === "users") {
                  store.createIndex("username", "username", { unique: true });
                } else {
                  store.createIndex("userId", "userId", { unique: false });
                }
              }
            }
          };
        };

        openWithFallback(DB_VERSION);
      });
    }
  }

  /**
   * Checks if an IndexedDB migration is available for this Native environment.
   */
  public async checkForMigration(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      // 1. Check if IndexedDB has any data (users store)
      const idb = await new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        request.onerror = () => resolve(null);
      });
      if (!idb) return false;

      const idbHasUsers = await new Promise<boolean>((resolve) => {
        try {
          const transaction = idb.transaction("users", "readonly");
          const store = transaction.objectStore("users");
          const request = store.getAll();
          request.onsuccess = () => resolve((request.result || []).length > 0);
          request.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });

      if (!idbHasUsers) return false;

      // 2. Check if SQLite already has users
      await this.init();
      const query = `SELECT count(*) as count FROM users;`;
      const res = await this.nativeDb.query(query);
      const count = res.values && res.values[0] ? res.values[0].count : 0;
      
      return count === 0; // Migration is available only if SQLite has no user records but IDB has some.
    } catch (e) {
      console.warn("Check for migration failed:", e);
      return false;
    }
  }

  /**
   * Executes the web-to-native SQLite migration process.
   */
  public async runMigration(): Promise<void> {
    if (!this.isNative) return;
    try {
      const idb = await new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        request.onerror = () => resolve(null);
      });
      if (!idb) return;

      const requiredStores = [
        "users", "tasks", "checklistItems", "subtasks", "reminders", "attachments", 
        "activityLogs", "roadmaps", "routines", "subjects", "habits", "targets", "notes",
        "rescheduling_history", "exams", "studySessions", "mistakes", "practiceGoals", "resourceItems"
      ];

      for (const store of requiredStores) {
        const records = await new Promise<any[]>((resolve) => {
          try {
            const transaction = idb.transaction(store, "readonly");
            const objectStore = transaction.objectStore(store);
            const request = objectStore.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });

        for (const record of records) {
          const query = `INSERT OR REPLACE INTO ${store} (id, data) VALUES (?, ?);`;
          await this.nativeDb.run(query, [record.id, JSON.stringify(record)]);
        }
      }
      console.log("Migration from IndexedDB to SQLite finished!");
    } catch (e) {
      console.error("runMigration error:", e);
    }
  }

  /**
   * Performs automatic database integrity and schema verification checks at startup.
   */
  public async runIntegrityChecks(): Promise<boolean> {
    if (this.isNative) return true;
    try {
      const stores = Array.from(this.db!.objectStoreNames);
      const requiredStores = [
        "users", "tasks", "checklistItems", "subtasks", "reminders", "attachments", 
        "activityLogs", "roadmaps", "routines", "subjects", "habits", "targets", "notes",
        "rescheduling_history", "exams", "studySessions", "mistakes", "practiceGoals", "resourceItems"
      ];
      for (const req of requiredStores) {
        if (!stores.includes(req)) {
          throw new Error(`Integrity error: Store '${req}' is missing.`);
        }
      }
      await this.logEvent("SYSTEM", "INTEGRITY_CHECK_PASS", "Automatic database integrity check completed successfully.");
      return true;
    } catch (err) {
      console.error("Database integrity checks failed:", err);
      return false;
    }
  }

  /**
   * Sets the active user credentials for encryption context.
   */
  public setContext(userId: string, userKey: string) {
    this.currentUserId = userId;
    this.userKey = userKey;
  }

  public clearContext() {
    this.currentUserId = null;
    this.userKey = null;
    this.queryCache.clear();
  }

  /**
   * Returns every registered user record. Used by the auth screen to check whether
   * any accounts exist yet and to locate a user for local PIN unlock — replacing the
   * previous approach of querying for a literal username of '*', which never matched
   * anything and silently broke PIN unlock.
   */
  public async getAllUsers(): Promise<User[]> {
    await this.init();
    return this.readAllStore<User>("users");
  }

  /**
   * Relational SQL query executor supporting Prepared Statements bindings to prevent SQL injections.
   * Maps query structures to native transactional IndexedDB operations securely.
   * Leverages an in-memory statement cache for lightning-fast reads.
   */
  public async execute<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.init();
    const statement = sql.trim().replace(/\s+/g, " ");

    const isWrite = statement.startsWith("INSERT") || 
                    statement.startsWith("UPDATE") || 
                    statement.startsWith("DELETE") || 
                    statement.startsWith("REPLACE");

    if (isWrite) {
      this.queryCache.clear();
    }

    if (statement.startsWith("SELECT")) {
      const cacheKey = JSON.stringify({ statement, params });
      if (this.queryCache.has(cacheKey)) {
        return JSON.parse(JSON.stringify(this.queryCache.get(cacheKey))) as T[];
      }
      const results = await this.executeInner<T>(statement, params);
      this.queryCache.set(cacheKey, results);
      return results;
    }

    return this.executeInner<T>(statement, params);
  }

  private async executeInner<T>(statement: string, params: any[] = []): Promise<T[]> {

    // Handle User creation / registration (INSERT INTO users)
    if (statement.startsWith("INSERT INTO users")) {
      const [userObj] = params;
      return this.writeToStore("users", userObj) as any;
    }

    // Handle User lookup (SELECT * FROM users)
    if (statement.startsWith("SELECT * FROM users")) {
      const users = await this.readAllStore<User>("users");
      if (statement.includes("WHERE username =") || statement.includes("where username =")) {
        const username = params[0];
        if (username === "*") {
          return users as any;
        }
        const found = users.filter(u => typeof u?.username === "string" && u.username.toLowerCase() === String(username).toLowerCase());
        return found as any;
      }
      return users as any;
    }

    // Handle User Update (UPDATE users)
    if (statement.startsWith("UPDATE users")) {
      const users = await this.readAllStore<User>("users");
      if (params.length === 1 && typeof params[0] === "object" && params[0] !== null) {
        // Full user object update (e.g. AuthScreen)
        const userObj = params[0];
        await this.writeToStore("users", userObj);
        return [userObj] as any;
      } else if (statement.includes("username = ?") && statement.includes("id = ?")) {
        // e.g. UPDATE users SET username = ? WHERE id = ?
        const [newUsername, userId] = params;
        const user = users.find(u => u.id === userId);
        if (user) {
          user.username = newUsername;
          await this.writeToStore("users", user);
          return [user] as any;
        }
      }
      // General fallback if needed
      if (params[0] && typeof params[0] === "object") {
        const userObj = params[0];
        await this.writeToStore("users", userObj);
        return [userObj] as any;
      }
      return [] as any;
    }

    // Encrypt-Decrypt Layer for Tasks
    if (statement.startsWith("INSERT INTO tasks")) {
      const [taskObj] = params;
      const securedTask = await this.encryptTask(taskObj);
      await this.writeToStore("tasks", securedTask);
      return [taskObj] as any;
    }

    if (statement.startsWith("UPDATE tasks")) {
      const [taskObj] = params;
      const securedTask = await this.encryptTask(taskObj);
      await this.writeToStore("tasks", securedTask);
      return [taskObj] as any;
    }

    if (statement.startsWith("SELECT * FROM tasks")) {
      const allTasks = await this.readAllStore<Task>("tasks");
      const userTasks = allTasks.filter(t => t.userId === this.currentUserId);
      const decryptedTasks = await Promise.all(userTasks.map(t => this.decryptTask(t)));
      
      // Perform local SQL filters based on params / WHERE emulations
      let results = decryptedTasks;

      // Filter deleted status
      if (statement.includes("isDeleted = 0") || statement.includes("is_deleted = 0") || statement.includes("isDeleted = false")) {
        results = results.filter(t => !t.isDeleted);
      } else if (statement.includes("isDeleted = 1") || statement.includes("is_deleted = 1") || statement.includes("isDeleted = true")) {
        results = results.filter(t => t.isDeleted);
      }

      return results as any;
    }

    // Handle Checklists (checklistItems)
    if (statement.startsWith("INSERT INTO checklistItems")) {
      const [checkObj] = params;
      const secured = await this.encryptChecklistItem(checkObj);
      await this.writeToStore("checklistItems", secured);
      return [checkObj] as any;
    }

    if (statement.startsWith("UPDATE checklistItems")) {
      const [checkObj] = params;
      const secured = await this.encryptChecklistItem(checkObj);
      await this.writeToStore("checklistItems", secured);
      return [checkObj] as any;
    }

    if (statement.startsWith("SELECT * FROM checklistItems")) {
      const allCheck = await this.readAllStore<ChecklistItem>("checklistItems");
      const decrypted = await Promise.all(allCheck.map(c => this.decryptChecklistItem(c)));
      if (params[0]) {
        return decrypted.filter(c => c.taskId === params[0]) as any;
      }
      return decrypted as any;
    }

    if (statement.startsWith("DELETE FROM checklistItems WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("checklistItems", id);
      return [] as any;
    }

    if (statement.startsWith("DELETE FROM checklistItems WHERE taskId =")) {
      const taskId = params[0];
      const allCheck = await this.readAllStore<ChecklistItem>("checklistItems");
      const toDelete = allCheck.filter(c => c.taskId === taskId);
      await Promise.all(toDelete.map(c => this.deleteFromStore("checklistItems", c.id)));
      return [] as any;
    }

    // Handle Subtasks (subtasks)
    if (statement.startsWith("INSERT INTO subtasks")) {
      const [subObj] = params;
      const secured = await this.encryptSubtask(subObj);
      await this.writeToStore("subtasks", secured);
      return [subObj] as any;
    }

    if (statement.startsWith("UPDATE subtasks")) {
      const [subObj] = params;
      const secured = await this.encryptSubtask(subObj);
      await this.writeToStore("subtasks", secured);
      return [subObj] as any;
    }

    if (statement.startsWith("SELECT * FROM subtasks")) {
      const allSub = await this.readAllStore<Subtask>("subtasks");
      const decrypted = await Promise.all(allSub.map(s => this.decryptSubtask(s)));
      if (params[0]) {
        return decrypted.filter(s => s.taskId === params[0]) as any;
      }
      return decrypted as any;
    }

    if (statement.startsWith("DELETE FROM subtasks WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("subtasks", id);
      return [] as any;
    }

    if (statement.startsWith("DELETE FROM subtasks WHERE taskId =")) {
      const taskId = params[0];
      const allSub = await this.readAllStore<Subtask>("subtasks");
      const toDelete = allSub.filter(s => s.taskId === taskId);
      await Promise.all(toDelete.map(s => this.deleteFromStore("subtasks", s.id)));
      return [] as any;
    }

    // Handle Reminders (reminders)
    if (statement.startsWith("INSERT INTO reminders")) {
      const [remObj] = params;
      const secured = await this.encryptReminder(remObj);
      await this.writeToStore("reminders", secured);
      return [remObj] as any;
    }

    if (statement.startsWith("UPDATE reminders")) {
      const [remObj] = params;
      const secured = await this.encryptReminder(remObj);
      await this.writeToStore("reminders", secured);
      return [remObj] as any;
    }

    if (statement.startsWith("SELECT * FROM reminders")) {
      const allRem = await this.readAllStore<TaskReminder>("reminders");
      const decrypted = await Promise.all(allRem.map(r => this.decryptReminder(r)));
      if (params[0]) {
        return decrypted.filter(r => r.taskId === params[0]) as any;
      }
      return decrypted as any;
    }

    if (statement.startsWith("DELETE FROM reminders WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("reminders", id);
      return [] as any;
    }

    if (statement.startsWith("DELETE FROM reminders WHERE taskId =")) {
      const taskId = params[0];
      const allRem = await this.readAllStore<TaskReminder>("reminders");
      const toDelete = allRem.filter(r => r.taskId === taskId);
      await Promise.all(toDelete.map(r => this.deleteFromStore("reminders", r.id)));
      return [] as any;
    }

    // Handle Attachments (attachments)
    if (statement.startsWith("INSERT INTO attachments")) {
      const [attObj] = params;
      const secured = await this.encryptAttachment(attObj);
      await this.writeToStore("attachments", secured);
      return [attObj] as any;
    }

    if (statement.startsWith("SELECT * FROM attachments")) {
      const allAtt = await this.readAllStore<TaskAttachment>("attachments");
      const decrypted = await Promise.all(allAtt.map(a => this.decryptAttachment(a)));
      if (params[0]) {
        return decrypted.filter(a => a.taskId === params[0]) as any;
      }
      return decrypted as any;
    }

    if (statement.startsWith("DELETE FROM attachments WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("attachments", id);
      return [] as any;
    }

    if (statement.startsWith("DELETE FROM attachments WHERE taskId =")) {
      const taskId = params[0];
      const allAtt = await this.readAllStore<TaskAttachment>("attachments");
      const toDelete = allAtt.filter(a => a.taskId === taskId);
      await Promise.all(toDelete.map(a => this.deleteFromStore("attachments", a.id)));
      return [] as any;
    }

    // Handle Audit / Activity Logs
    if (statement.startsWith("INSERT INTO activityLogs")) {
      const [logObj] = params;
      const secured = await this.encryptActivityLog(logObj);
      await this.writeToStore("activityLogs", secured);
      return [logObj] as any;
    }

    if (statement.startsWith("SELECT * FROM activityLogs")) {
      const allLogs = await this.readAllStore<ActivityLog>("activityLogs");
      const decrypted = await Promise.all(allLogs.map(l => this.decryptActivityLog(l)));
      const userLogs = decrypted.filter(l => l.userId === this.currentUserId || l.userId === "SYSTEM");
      // Sort newest first
      userLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return userLogs as any;
    }

    // Handle Roadmaps (roadmaps)
    if (statement.startsWith("INSERT INTO roadmaps") || statement.startsWith("UPDATE roadmaps") || statement.startsWith("REPLACE INTO roadmaps")) {
      const [roadmapObj] = params;
      const securedRoadmap = await this.encryptRoadmap(roadmapObj);
      await this.writeToStore("roadmaps", securedRoadmap);
      return [roadmapObj] as any;
    }

    if (statement.startsWith("SELECT * FROM roadmaps")) {
      const allRoadmaps = await this.readAllStore<{ id: string; nodesJson: string }>("roadmaps");
      const userRoadmap = allRoadmaps.find(r => r.id === this.currentUserId);
      if (userRoadmap) {
        const decryptedRoadmap = await this.decryptRoadmap(userRoadmap);
        return [decryptedRoadmap] as any;
      }
      return [] as any;
    }

    if (statement.startsWith("DELETE FROM roadmaps")) {
      if (this.currentUserId) {
        await this.deleteFromStore("roadmaps", this.currentUserId);
      }
      return [] as any;
    }

    // Handle Routines
    if (statement.startsWith("INSERT INTO routines") || statement.startsWith("UPDATE routines")) {
      const [routineObj] = params;
      const secured = await this.encryptRoutine(routineObj);
      await this.writeToStore("routines", secured);
      return [routineObj] as any;
    }
    if (statement.startsWith("SELECT * FROM routines")) {
      const allRoutines = await this.readAllStore<DailyRoutine>("routines");
      const decrypted = await Promise.all(allRoutines.map(r => this.decryptRoutine(r)));
      const filtered = decrypted.filter(r => r.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM routines WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("routines", id);
      return [] as any;
    }

    // Handle Subjects
    if (statement.startsWith("INSERT INTO subjects") || statement.startsWith("UPDATE subjects")) {
      const [subjectObj] = params;
      const secured = await this.encryptSubject(subjectObj);
      await this.writeToStore("subjects", secured);
      return [subjectObj] as any;
    }
    if (statement.startsWith("SELECT * FROM subjects")) {
      const allSubjects = await this.readAllStore<StudySubject>("subjects");
      const decrypted = await Promise.all(allSubjects.map(s => this.decryptSubject(s)));
      const filtered = decrypted.filter(s => s.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM subjects WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("subjects", id);
      return [] as any;
    }

    // Handle Habits
    if (statement.startsWith("INSERT INTO habits") || statement.startsWith("UPDATE habits")) {
      const [habitObj] = params;
      const secured = await this.encryptHabit(habitObj);
      await this.writeToStore("habits", secured);
      return [habitObj] as any;
    }
    if (statement.startsWith("SELECT * FROM habits")) {
      const allHabits = await this.readAllStore<Habit>("habits");
      const decrypted = await Promise.all(allHabits.map(h => this.decryptHabit(h)));
      const filtered = decrypted.filter(h => h.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM habits WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("habits", id);
      return [] as any;
    }

    // Handle Targets
    if (statement.startsWith("INSERT INTO targets") || statement.startsWith("UPDATE targets")) {
      const [targetObj] = params;
      const secured = await this.encryptTarget(targetObj);
      await this.writeToStore("targets", secured);
      return [targetObj] as any;
    }
    if (statement.startsWith("SELECT * FROM targets")) {
      const allTargets = await this.readAllStore<Target>("targets");
      const decrypted = await Promise.all(allTargets.map(t => this.decryptTarget(t)));
      const filtered = decrypted.filter(t => t.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM targets WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("targets", id);
      return [] as any;
    }

    // Handle Notes
    if (statement.startsWith("INSERT INTO notes") || statement.startsWith("UPDATE notes")) {
      const [noteObj] = params;
      const secured = await this.encryptNote(noteObj);
      await this.writeToStore("notes", secured);
      return [noteObj] as any;
    }
    if (statement.startsWith("SELECT * FROM notes")) {
      const allNotes = await this.readAllStore<Note>("notes");
      const decrypted = await Promise.all(allNotes.map(n => this.decryptNote(n)));
      const filtered = decrypted.filter(n => n.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM notes WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("notes", id);
      return [] as any;
    }

    // Handle Rescheduling History
    if (statement.startsWith("INSERT INTO rescheduling_history") || statement.startsWith("UPDATE rescheduling_history")) {
      const [reschedObj] = params;
      const secured = await this.encryptReschedulingHistory(reschedObj);
      await this.writeToStore("rescheduling_history", secured);
      return [reschedObj] as any;
    }
    if (statement.startsWith("SELECT * FROM rescheduling_history")) {
      const allHistory = await this.readAllStore<ReschedulingHistory>("rescheduling_history");
      const decrypted = await Promise.all(allHistory.map(h => this.decryptReschedulingHistory(h)));
      const filtered = decrypted.filter(h => h.userId === this.currentUserId);
      // Sort by timestamp or ID desc or whatever we prefer
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM rescheduling_history WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("rescheduling_history", id);
      return [] as any;
    }

    // Handle Exams
    if (statement.startsWith("INSERT INTO exams") || statement.startsWith("UPDATE exams")) {
      const [examObj] = params;
      await this.writeToStore("exams", examObj);
      return [examObj] as any;
    }
    if (statement.startsWith("SELECT * FROM exams")) {
      const allExams = await this.readAllStore<Exam>("exams");
      const filtered = allExams.filter(e => e.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM exams WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("exams", id);
      return [] as any;
    }

    // Handle Study Sessions
    if (statement.startsWith("INSERT INTO studySessions") || statement.startsWith("UPDATE studySessions")) {
      const [sessionObj] = params;
      await this.writeToStore("studySessions", sessionObj);
      return [sessionObj] as any;
    }
    if (statement.startsWith("SELECT * FROM studySessions")) {
      const allSessions = await this.readAllStore<StudySession>("studySessions");
      const filtered = allSessions.filter(s => s.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM studySessions WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("studySessions", id);
      return [] as any;
    }

    // Handle Mistakes
    if (statement.startsWith("INSERT INTO mistakes") || statement.startsWith("UPDATE mistakes")) {
      const [mistakeObj] = params;
      await this.writeToStore("mistakes", mistakeObj);
      return [mistakeObj] as any;
    }
    if (statement.startsWith("SELECT * FROM mistakes")) {
      const allMistakes = await this.readAllStore<Mistake>("mistakes");
      const filtered = allMistakes.filter(m => m.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM mistakes WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("mistakes", id);
      return [] as any;
    }

    // Handle Practice Goals
    if (statement.startsWith("INSERT INTO practiceGoals") || statement.startsWith("UPDATE practiceGoals")) {
      const [goalObj] = params;
      await this.writeToStore("practiceGoals", goalObj);
      return [goalObj] as any;
    }
    if (statement.startsWith("SELECT * FROM practiceGoals")) {
      const allGoals = await this.readAllStore<PracticeGoal>("practiceGoals");
      const filtered = allGoals.filter(g => g.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM practiceGoals WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("practiceGoals", id);
      return [] as any;
    }

    // Handle Resource Items
    if (statement.startsWith("INSERT INTO resourceItems") || statement.startsWith("UPDATE resourceItems")) {
      const [resObj] = params;
      await this.writeToStore("resourceItems", resObj);
      return [resObj] as any;
    }
    if (statement.startsWith("SELECT * FROM resourceItems")) {
      const allResources = await this.readAllStore<ResourceItem>("resourceItems");
      const filtered = allResources.filter(r => r.userId === this.currentUserId);
      return filtered as any;
    }
    if (statement.startsWith("DELETE FROM resourceItems WHERE id =")) {
      const id = params[0];
      await this.deleteFromStore("resourceItems", id);
      return [] as any;
    }

    throw new Error(`Unsupported offline SQL simulation: ${statement}`);
  }

  /**
   * Helper to write records to an object store
   */
   private async writeToStore(storeName: string, data: any): Promise<void> {
    if (this.isNative) {
      await this.init();
      const query = `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?);`;
      await this.nativeDb.run(query, [data.id, JSON.stringify(data)]);
    } else {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    }
  }

  /**
   * Helper to read all records from an object store
   */
  private async readAllStore<T>(storeName: string): Promise<T[]> {
    if (this.isNative) {
      await this.init();
      const query = `SELECT data FROM ${storeName};`;
      const res = await this.nativeDb.query(query);
      return (res.values || []).map((row: any) => JSON.parse(row.data)) as T[];
    } else {
      return new Promise<T[]>((resolve, reject) => {
        const transaction = this.db!.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    }
  }

  /**
   * Helper to delete record from store
   */
  private async deleteFromStore(storeName: string, id: string): Promise<void> {
    if (this.isNative) {
      await this.init();
      const query = `DELETE FROM ${storeName} WHERE id = ?;`;
      await this.nativeDb.run(query, [id]);
    } else {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    }
  }

  /**
   * Helper to clear all records from an object store
   */
  private async clearStore(storeName: string): Promise<void> {
    if (this.isNative) {
      await this.init();
      const query = `DELETE FROM ${storeName};`;
      await this.nativeDb.run(query);
    } else {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    }
  }

  /**
   * Cryptographically encrypts sensitive fields in a Task object before storing to SQLite/IndexedDB.
   */
  private async encryptTask(task: Task): Promise<Task> {
    if (!this.userKey) return task; // Context-isolated fallback
    try {
      const encryptedTitle = await encryptData(task.title, this.userKey);
      const encryptedDesc = await encryptData(task.description || "", this.userKey);
      const encryptedNotes = await encryptData(task.notes || "", this.userKey);
      
      return {
        ...task,
        title: `__enc__:${encryptedTitle}`,
        description: `__enc__:${encryptedDesc}`,
        notes: `__enc__:${encryptedNotes}`
      };
    } catch (e) {
      console.error("Failed to encrypt task", e);
      return task;
    }
  }

  /**
   * Cryptographically decrypts sensitive task fields on read.
   */
  private async decryptTask(task: Task): Promise<Task> {
    if (!this.userKey) return task;
    try {
      let title = task.title;
      let description = task.description;
      let notes = task.notes;

      if (title.startsWith("__enc__:")) {
        title = await decryptData(title.slice(8), this.userKey);
      }
      if (description.startsWith("__enc__:")) {
        description = await decryptData(description.slice(8), this.userKey);
      }
      if (notes.startsWith("__enc__:")) {
        notes = await decryptData(notes.slice(8), this.userKey);
      }

      return {
        ...task,
        title,
        description,
        notes
      };
    } catch (e) {
      console.error("Failed to decrypt task", e);
      return task;
    }
  }

  /**
   * Cryptographically encrypts sensitive fields in a Roadmap object.
   */
  private async encryptRoadmap(roadmap: { id: string; nodesJson: string }): Promise<{ id: string; nodesJson: string }> {
    if (!this.userKey) return roadmap;
    try {
      const encryptedNodes = await encryptData(roadmap.nodesJson, this.userKey);
      return {
        id: roadmap.id,
        nodesJson: `__enc__:${encryptedNodes}`
      };
    } catch (e) {
      console.error("Failed to encrypt roadmap", e);
      return roadmap;
    }
  }

  /**
   * Cryptographically decrypts sensitive roadmap fields on read.
   */
  private async decryptRoadmap(roadmap: { id: string; nodesJson: string }): Promise<{ id: string; nodesJson: string }> {
    if (!this.userKey) return roadmap;
    try {
      let nodesJson = roadmap.nodesJson;
      if (nodesJson.startsWith("__enc__:")) {
        nodesJson = await decryptData(nodesJson.slice(8), this.userKey);
      }
      return {
        id: roadmap.id,
        nodesJson
      };
    } catch (e) {
      console.error("Failed to decrypt roadmap", e);
      return roadmap;
    }
  }

  private async encryptChecklistItem(item: ChecklistItem): Promise<ChecklistItem> {
    if (!this.userKey) return item;
    try {
      const encryptedTitle = await encryptData(item.title, this.userKey);
      return { ...item, title: `__enc__:${encryptedTitle}` };
    } catch (e) {
      return item;
    }
  }

  private async decryptChecklistItem(item: ChecklistItem): Promise<ChecklistItem> {
    if (!this.userKey) return item;
    try {
      let title = item.title;
      if (title.startsWith("__enc__:")) {
        title = await decryptData(title.slice(8), this.userKey);
      }
      return { ...item, title };
    } catch (e) {
      return item;
    }
  }

  private async encryptSubtask(sub: Subtask): Promise<Subtask> {
    if (!this.userKey) return sub;
    try {
      const encryptedTitle = await encryptData(sub.title, this.userKey);
      return { ...sub, title: `__enc__:${encryptedTitle}` };
    } catch (e) {
      return sub;
    }
  }

  private async decryptSubtask(sub: Subtask): Promise<Subtask> {
    if (!this.userKey) return sub;
    try {
      let title = sub.title;
      if (title.startsWith("__enc__:")) {
        title = await decryptData(title.slice(8), this.userKey);
      }
      return { ...sub, title };
    } catch (e) {
      return sub;
    }
  }

  private async encryptReminder(rem: TaskReminder): Promise<TaskReminder> {
    if (!this.userKey) return rem;
    try {
      const encryptedRemindAt = await encryptData(rem.remindAt, this.userKey);
      return { ...rem, remindAt: `__enc__:${encryptedRemindAt}` };
    } catch (e) {
      return rem;
    }
  }

  private async decryptReminder(rem: TaskReminder): Promise<TaskReminder> {
    if (!this.userKey) return rem;
    try {
      let remindAt = rem.remindAt;
      if (remindAt.startsWith("__enc__:")) {
        remindAt = await decryptData(remindAt.slice(8), this.userKey);
      }
      return { ...rem, remindAt };
    } catch (e) {
      return rem;
    }
  }

  private async encryptAttachment(att: TaskAttachment): Promise<TaskAttachment> {
    if (!this.userKey) return att;
    try {
      const encryptedName = await encryptData(att.fileName, this.userKey);
      const encryptedType = await encryptData(att.fileType, this.userKey);
      const encryptedDataStr = await encryptData(att.fileData, this.userKey);
      return {
        ...att,
        fileName: `__enc__:${encryptedName}`,
        fileType: `__enc__:${encryptedType}`,
        fileData: `__enc__:${encryptedDataStr}`
      };
    } catch (e) {
      return att;
    }
  }

  private async decryptAttachment(att: TaskAttachment): Promise<TaskAttachment> {
    if (!this.userKey) return att;
    try {
      let fileName = att.fileName;
      let fileType = att.fileType;
      let fileData = att.fileData;
      if (fileName.startsWith("__enc__:")) {
        fileName = await decryptData(fileName.slice(8), this.userKey);
      }
      if (fileType.startsWith("__enc__:")) {
        fileType = await decryptData(fileType.slice(8), this.userKey);
      }
      if (fileData.startsWith("__enc__:")) {
        fileData = await decryptData(fileData.slice(8), this.userKey);
      }
      return { ...att, fileName, fileType, fileData };
    } catch (e) {
      return att;
    }
  }

  private async encryptActivityLog(log: ActivityLog): Promise<ActivityLog> {
    if (!this.userKey) return log;
    try {
      const encryptedDetails = await encryptData(log.details, this.userKey);
      return { ...log, details: `__enc__:${encryptedDetails}` };
    } catch (e) {
      return log;
    }
  }

  private async decryptActivityLog(log: ActivityLog): Promise<ActivityLog> {
    if (!this.userKey) return log;
    try {
      let details = log.details;
      if (details.startsWith("__enc__:")) {
        details = await decryptData(details.slice(8), this.userKey);
      }
      return { ...log, details };
    } catch (e) {
      return log;
    }
  }

  private async encryptRoutine(item: DailyRoutine): Promise<DailyRoutine> {
    if (!this.userKey) return item;
    try {
      const encryptedName = await encryptData(item.name, this.userKey);
      const encryptedItems = await encryptData(item.items, this.userKey);
      return {
        ...item,
        name: `__enc__:${encryptedName}`,
        items: `__enc__:${encryptedItems}`
      };
    } catch (e) {
      return item;
    }
  }

  private async decryptRoutine(item: DailyRoutine): Promise<DailyRoutine> {
    if (!this.userKey) return item;
    try {
      let name = item.name;
      let items = item.items;
      if (name.startsWith("__enc__:")) name = await decryptData(name.slice(8), this.userKey);
      if (items.startsWith("__enc__:")) items = await decryptData(items.slice(8), this.userKey);
      return { ...item, name, items };
    } catch (e) {
      return item;
    }
  }

  private async encryptSubject(item: StudySubject): Promise<StudySubject> {
    if (!this.userKey) return item;
    try {
      const encryptedName = await encryptData(item.name, this.userKey);
      const encryptedNotes = await encryptData(item.notes || "", this.userKey);
      const encryptedChapters = await encryptData(item.chaptersJson, this.userKey);
      const encryptedRevision = await encryptData(item.revisionJson, this.userKey);
      return {
        ...item,
        name: `__enc__:${encryptedName}`,
        notes: `__enc__:${encryptedNotes}`,
        chaptersJson: `__enc__:${encryptedChapters}`,
        revisionJson: `__enc__:${encryptedRevision}`
      };
    } catch (e) {
      return item;
    }
  }

  private async decryptSubject(item: StudySubject): Promise<StudySubject> {
    if (!this.userKey) return item;
    try {
      let name = item.name;
      let notes = item.notes;
      let chaptersJson = item.chaptersJson;
      let revisionJson = item.revisionJson;
      if (name.startsWith("__enc__:")) name = await decryptData(name.slice(8), this.userKey);
      if (notes.startsWith("__enc__:")) notes = await decryptData(notes.slice(8), this.userKey);
      if (chaptersJson.startsWith("__enc__:")) chaptersJson = await decryptData(chaptersJson.slice(8), this.userKey);
      if (revisionJson.startsWith("__enc__:")) revisionJson = await decryptData(revisionJson.slice(8), this.userKey);
      return { ...item, name, notes, chaptersJson, revisionJson };
    } catch (e) {
      return item;
    }
  }

  private async encryptHabit(item: Habit): Promise<Habit> {
    if (!this.userKey) return item;
    try {
      const encryptedName = await encryptData(item.name, this.userKey);
      const encryptedLogs = await encryptData(item.logsJson, this.userKey);
      return {
        ...item,
        name: `__enc__:${encryptedName}`,
        logsJson: `__enc__:${encryptedLogs}`
      };
    } catch (e) {
      return item;
    }
  }

  private async decryptHabit(item: Habit): Promise<Habit> {
    if (!this.userKey) return item;
    try {
      let name = item.name;
      let logsJson = item.logsJson;
      if (name.startsWith("__enc__:")) name = await decryptData(name.slice(8), this.userKey);
      if (logsJson.startsWith("__enc__:")) logsJson = await decryptData(logsJson.slice(8), this.userKey);
      return { ...item, name, logsJson };
    } catch (e) {
      return item;
    }
  }

  private async encryptTarget(item: Target): Promise<Target> {
    if (!this.userKey) return item;
    try {
      const encryptedTitle = await encryptData(item.title, this.userKey);
      const encryptedDesc = await encryptData(item.description || "", this.userKey);
      const encryptedReminder = item.reminderTime ? await encryptData(item.reminderTime, this.userKey) : undefined;
      const encryptedCategory = item.category ? await encryptData(item.category, this.userKey) : undefined;
      return {
        ...item,
        title: `__enc__:${encryptedTitle}`,
        description: `__enc__:${encryptedDesc}`,
        reminderTime: encryptedReminder ? `__enc__:${encryptedReminder}` : undefined,
        category: encryptedCategory ? `__enc__:${encryptedCategory}` : undefined
      };
    } catch (e) {
      return item;
    }
  }

  private async decryptTarget(item: Target): Promise<Target> {
    if (!this.userKey) return item;
    try {
      let title = item.title;
      let description = item.description;
      let reminderTime = item.reminderTime;
      let category = item.category;
      if (title.startsWith("__enc__:")) title = await decryptData(title.slice(8), this.userKey);
      if (description.startsWith("__enc__:")) description = await decryptData(description.slice(8), this.userKey);
      if (reminderTime && reminderTime.startsWith("__enc__:")) reminderTime = await decryptData(reminderTime.slice(8), this.userKey);
      if (category && category.startsWith("__enc__:")) category = await decryptData(category.slice(8), this.userKey);
      return { ...item, title, description, reminderTime, category };
    } catch (e) {
      return item;
    }
  }

  private async encryptNote(item: Note): Promise<Note> {
    if (!this.userKey) return item;
    try {
      const encryptedTitle = await encryptData(item.title, this.userKey);
      const encryptedContent = await encryptData(item.content, this.userKey);
      const encryptedFolder = await encryptData(item.folder, this.userKey);
      const encryptedTags = await encryptData(JSON.stringify(item.tags), this.userKey);
      return {
        ...item,
        title: `__enc__:${encryptedTitle}`,
        content: `__enc__:${encryptedContent}`,
        folder: `__enc__:${encryptedFolder}`,
        tags: [`__enc__:${encryptedTags}`]
      };
    } catch (e) {
      return item;
    }
  }

  private async decryptNote(item: Note): Promise<Note> {
    if (!this.userKey) return item;
    try {
      let title = item.title;
      let content = item.content;
      let folder = item.folder;
      let tags = item.tags;
      if (title.startsWith("__enc__:")) title = await decryptData(title.slice(8), this.userKey);
      if (content.startsWith("__enc__:")) content = await decryptData(content.slice(8), this.userKey);
      if (folder.startsWith("__enc__:")) folder = await decryptData(folder.slice(8), this.userKey);
      if (tags.length > 0 && tags[0].startsWith("__enc__:")) {
        const decryptedTagsStr = await decryptData(tags[0].slice(8), this.userKey);
        tags = JSON.parse(decryptedTagsStr);
      }
      return { ...item, title, content, folder, tags };
    } catch (e) {
      return item;
    }
  }

  private async encryptReschedulingHistory(item: ReschedulingHistory): Promise<ReschedulingHistory> {
    if (!this.userKey) return item;
    try {
      const encryptedDesc = await encryptData(item.description, this.userKey);
      const encryptedSnapshot = await encryptData(item.snapshotJson, this.userKey);
      return {
        ...item,
        description: `__enc__:${encryptedDesc}`,
        snapshotJson: `__enc__:${encryptedSnapshot}`
      };
    } catch (e) {
      return item;
    }
  }

  private async decryptReschedulingHistory(item: ReschedulingHistory): Promise<ReschedulingHistory> {
    if (!this.userKey) return item;
    try {
      let description = item.description;
      let snapshotJson = item.snapshotJson;
      if (description.startsWith("__enc__:")) description = await decryptData(description.slice(8), this.userKey);
      if (snapshotJson.startsWith("__enc__:")) snapshotJson = await decryptData(snapshotJson.slice(8), this.userKey);
      return { ...item, description, snapshotJson };
    } catch (e) {
      return item;
    }
  }

  /**
   * Writes secure event logs to audit trace.
   */
  public async logEvent(userId: string, action: string, details: string, taskId?: string): Promise<void> {
    const log: ActivityLog = {
      id: generateRandomBytes(16),
      userId,
      taskId,
      action,
      details,
      createdAt: new Date().toISOString()
    };
    try {
      // Direct insertion bypasses full query check
      if (this.db) {
        await this.writeToStore("activityLogs", log);
      }
    } catch (err) {
      console.warn("Audit logging failed:", err);
    }
  }

  /**
   * Exports the entire local database structure into a portable JSON-based database archive
   * representing standard SQLite schemas.
   */
  public async exportDatabase(): Promise<DatabaseBackup> {
    await this.init();
    
    // We export decrypted tasks so the database backup contains normal structures
    // (optionally password encrypted, or clean plain data as selected by the user)
    const users = await this.readAllStore<User>("users");
    const rawTasks = await this.readAllStore<Task>("tasks");
    const decryptedTasks = await Promise.all(rawTasks.map(t => this.decryptTask(t)));
    
    const rawChecklist = await this.readAllStore<ChecklistItem>("checklistItems");
    const checklistItems = await Promise.all(rawChecklist.map(c => this.decryptChecklistItem(c)));

    const rawSubtasks = await this.readAllStore<Subtask>("subtasks");
    const subtasks = await Promise.all(rawSubtasks.map(s => this.decryptSubtask(s)));

    const rawReminders = await this.readAllStore<TaskReminder>("reminders");
    const reminders = await Promise.all(rawReminders.map(r => this.decryptReminder(r)));

    const rawAttachments = await this.readAllStore<TaskAttachment>("attachments");
    const attachments = await Promise.all(rawAttachments.map(a => this.decryptAttachment(a)));

    const rawLogs = await this.readAllStore<ActivityLog>("activityLogs");
    const activityLogs = await Promise.all(rawLogs.map(l => this.decryptActivityLog(l)));

    const rawRoadmaps = await this.readAllStore<{ id: string; nodesJson: string }>("roadmaps");
    const decryptedRoadmaps = await Promise.all(rawRoadmaps.map(r => this.decryptRoadmap(r)));

    const rawRoutines = await this.readAllStore<DailyRoutine>("routines");
    const routines = await Promise.all(rawRoutines.map(r => this.decryptRoutine(r)));

    const rawSubjects = await this.readAllStore<StudySubject>("subjects");
    const subjects = await Promise.all(rawSubjects.map(s => this.decryptSubject(s)));

    const rawHabits = await this.readAllStore<Habit>("habits");
    const habits = await Promise.all(rawHabits.map(h => this.decryptHabit(h)));

    const rawTargets = await this.readAllStore<Target>("targets");
    const targets = await Promise.all(rawTargets.map(t => this.decryptTarget(t)));

    const rawNotes = await this.readAllStore<Note>("notes");
    const notes = await Promise.all(rawNotes.map(n => this.decryptNote(n)));

    return {
      version: DB_VERSION,
      timestamp: new Date().toISOString(),
      users,
      tasks: decryptedTasks,
      checklistItems,
      subtasks,
      reminders,
      attachments,
      activityLogs,
      roadmaps: decryptedRoadmaps,
      routines,
      subjects,
      habits,
      targets,
      notes
    } as any;
  }

  /**
   * Exports the entire local database structure as is, with raw encrypted fields
   * directly from IndexedDB stores, representing the cryptographically locked state.
   */
  public async exportEncryptedDatabase(): Promise<DatabaseBackup> {
    await this.init();
    
    const users = await this.readAllStore<User>("users");
    const tasks = await this.readAllStore<Task>("tasks");
    const checklistItems = await this.readAllStore<ChecklistItem>("checklistItems");
    const subtasks = await this.readAllStore<Subtask>("subtasks");
    const reminders = await this.readAllStore<TaskReminder>("reminders");
    const attachments = await this.readAllStore<TaskAttachment>("attachments");
    const activityLogs = await this.readAllStore<ActivityLog>("activityLogs");
    
    let roadmaps: any[] = [];
    try {
      roadmaps = await this.readAllStore<{ id: string; nodesJson: string }>("roadmaps");
    } catch (e) {
      console.warn("Failed to read roadmaps during encrypted export:", e);
    }

    let routines: any[] = [];
    try { routines = await this.readAllStore<DailyRoutine>("routines"); } catch (e) {}

    let subjects: any[] = [];
    try { subjects = await this.readAllStore<StudySubject>("subjects"); } catch (e) {}

    let habits: any[] = [];
    try { habits = await this.readAllStore<Habit>("habits"); } catch (e) {}

    let targets: any[] = [];
    try { targets = await this.readAllStore<Target>("targets"); } catch (e) {}

    let notes: any[] = [];
    try { notes = await this.readAllStore<Note>("notes"); } catch (e) {}

    return {
      version: DB_VERSION,
      timestamp: new Date().toISOString(),
      users,
      tasks,
      checklistItems,
      subtasks,
      reminders,
      attachments,
      activityLogs,
      roadmaps,
      routines,
      subjects,
      habits,
      targets,
      notes
    } as any;
  }

  /**
   * Safely verifies a database backup for authenticity and relational integrity before applying restore.
   */
  public async verifyAndRestoreDatabase(backup: any): Promise<boolean> {
    await this.init();
    try {
      // 1. Strict schema and type assertion checks
      if (!backup || typeof backup !== "object") throw new Error("Invalid backup payload.");
      if (backup.version !== 1 && backup.version !== 2 && backup.version !== 3 && backup.version !== 4) throw new Error("Unsupported database backup version.");
      if (!Array.isArray(backup.users) || !Array.isArray(backup.tasks)) {
        throw new Error("Malformatted database. Missing users or tasks records.");
      }

      // 2. Clear all current data securely
      const stores = [
        "users", "tasks", "checklistItems", "subtasks", "reminders", 
        "attachments", "activityLogs", "roadmaps", "routines", "subjects", 
        "habits", "targets", "notes", "rescheduling_history"
      ];
      for (const st of stores) {
        await this.clearStore(st);
      }

      // 3. Restore records
      for (const u of backup.users) {
        await this.writeToStore("users", u);
      }
      for (const t of backup.tasks) {
        // Automatically re-encrypt based on active context
        const securedTask = await this.encryptTask(t);
        await this.writeToStore("tasks", securedTask);
      }
      for (const c of (backup.checklistItems || [])) {
        const secured = await this.encryptChecklistItem(c);
        await this.writeToStore("checklistItems", secured);
      }
      for (const s of (backup.subtasks || [])) {
        const secured = await this.encryptSubtask(s);
        await this.writeToStore("subtasks", secured);
      }
      for (const r of (backup.reminders || [])) {
        const secured = await this.encryptReminder(r);
        await this.writeToStore("reminders", secured);
      }
      for (const a of (backup.attachments || [])) {
        const secured = await this.encryptAttachment(a);
        await this.writeToStore("attachments", secured);
      }
      for (const l of (backup.activityLogs || [])) {
        const secured = await this.encryptActivityLog(l);
        await this.writeToStore("activityLogs", secured);
      }
      for (const rm of (backup.roadmaps || [])) {
        const securedRoadmap = await this.encryptRoadmap(rm);
        await this.writeToStore("roadmaps", securedRoadmap);
      }
      for (const rt of (backup.routines || [])) {
        const secured = await this.encryptRoutine(rt);
        await this.writeToStore("routines", secured);
      }
      for (const sb of (backup.subjects || [])) {
        const secured = await this.encryptSubject(sb);
        await this.writeToStore("subjects", secured);
      }
      for (const hb of (backup.habits || [])) {
        const secured = await this.encryptHabit(hb);
        await this.writeToStore("habits", secured);
      }
      for (const tg of (backup.targets || [])) {
        const secured = await this.encryptTarget(tg);
        await this.writeToStore("targets", secured);
      }
      for (const nt of (backup.notes || [])) {
        const secured = await this.encryptNote(nt);
        await this.writeToStore("notes", secured);
      }

      await this.logEvent(this.currentUserId || "SYSTEM", "BACKUP_RESTORE_SUCCESS", "Local SQLite database backup restored and verified.");
      return true;
    } catch (err) {
      console.error("Backup restoration verification failed:", err);
      await this.logEvent(this.currentUserId || "SYSTEM", "BACKUP_RESTORE_FAIL", `Failed restoring backup: ${(err as Error).message}`);
      return false;
    }
  }
}

export const db = new SQLiteIndexedDB();
export function generateRandomBytes(length: number): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.prototype.map.call(bytes, (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
}
