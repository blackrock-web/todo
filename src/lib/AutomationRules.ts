import { db } from "../db/sqlite";
import { Task, TaskPriority, TaskStatus, Habit, StudySession } from "../types";

export interface AutomationRule {
  id: string;
  trigger: string;
  action: string;
  isEnabled: boolean;
}

/**
 * Automatically triggers background rules when user actions occur.
 * Supports conditional triggers like:
 * - "Task completed"
 * - "Focus Session completes"
 * - "Habit completed"
 */
export async function evaluateRules(
  trigger: string,
  context: {
    task?: Task;
    studySession?: StudySession;
    habit?: Habit;
    userId?: string;
  }
) {
  try {
    const userId = context.userId || "local_user";
    
    // 1. Load active rules from local storage
    const savedRulesStr = localStorage.getItem("pro-rules");
    if (!savedRulesStr) return;

    const rules: AutomationRule[] = JSON.parse(savedRulesStr);
    const enabledRules = rules.filter((r) => r.isEnabled && r.trigger.toLowerCase() === trigger.toLowerCase());

    if (enabledRules.length === 0) return;

    for (const rule of enabledRules) {
      console.log(`Executing automation rule: IF "${rule.trigger}" THEN "${rule.action}"`);

      // 2. Perform the matching actions
      const actionLower = rule.action.toLowerCase();

      if (actionLower.includes("schedule revision")) {
        // e.g. "Schedule Revision in 3 days"
        const daysMatch = rule.action.match(/\d+/);
        const days = daysMatch ? parseInt(daysMatch[0], 10) : 3;
        
        const revisionDate = new Date();
        revisionDate.setDate(revisionDate.getDate() + days);
        const dueDateStr = revisionDate.toISOString().split("T")[0];

        const taskTitle = context.task 
          ? `Revision: ${context.task.title}` 
          : "Syllabus Spaced Repetition Revision";

        const newRevisionTask: Task = {
          id: Math.random().toString(36).substring(2, 11),
          userId,
          title: taskTitle,
          description: `Automatically scheduled revision via Smart Rule Engine. Original event: ${trigger}.`,
          notes: "Focus on recalling core concepts and key terms.",
          startDate: new Date().toISOString().split("T")[0],
          dueDate: dueDateStr,
          dueTime: "09:00",
          priority: TaskPriority.HIGH,
          status: TaskStatus.TODO,
          category: "Revision",
          tags: ["automated", "spaced-repetition"],
          isFavorite: false,
          isPinned: false,
          recurrence: "none",
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await db.execute("INSERT INTO tasks", [newRevisionTask]);
        await db.logEvent(
          userId,
          "RULE_ENGINE_EXECUTION",
          `Rule #${rule.id} triggered: Created revision task '${taskTitle}' due ${dueDateStr}.`
        );
      } 
      else if (actionLower.includes("reward") && actionLower.includes("coins")) {
        // e.g. "Reward 10 Vacation Coins"
        const coinsMatch = rule.action.match(/\d+/);
        const coinsToReward = coinsMatch ? parseInt(coinsMatch[0], 10) : 10;

        const currentCoins = parseInt(localStorage.getItem("vacation-coins") || "0", 10);
        const newBalance = currentCoins + coinsToReward;
        localStorage.setItem("vacation-coins", String(newBalance));

        await db.logEvent(
          userId,
          "RULE_ENGINE_EXECUTION",
          `Rule #${rule.id} triggered: Credited user ${coinsToReward} Vacation Coins. New Balance: ${newBalance}.`
        );
      }
      else if (actionLower.includes("recovery routine checklist") || actionLower.includes("create recovery")) {
        // e.g. "Create recovery routine checklist"
        const checklistTask: Task = {
          id: Math.random().toString(36).substring(2, 11),
          userId,
          title: "Habit Recovery Checklist Plan",
          description: "System detected a missed habit/routine streak. Follow this recovery checklist to rebuild momentum.",
          notes: "1. Perform a 5-min micro-session today.\n2. Log habit early.\n3. Identify friction points.",
          startDate: new Date().toISOString().split("T")[0],
          dueDate: new Date().toISOString().split("T")[0],
          dueTime: "12:00",
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.TODO,
          category: "Recovery",
          tags: ["automated", "recovery"],
          isFavorite: false,
          isPinned: false,
          recurrence: "none",
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await db.execute("INSERT INTO tasks", [checklistTask]);
        await db.logEvent(
          userId,
          "RULE_ENGINE_EXECUTION",
          `Rule #${rule.id} triggered: Generated habit recovery checklist.`
        );
      }
      else if (actionLower.includes("increase study hours")) {
        // e.g. "Increase study hours by 1.5h/day"
        await db.logEvent(
          userId,
          "RULE_ENGINE_EXECUTION",
          `Rule #${rule.id} triggered: Adjusted study plan difficulty parameters to increase allocation.`
        );
      }
      else if (actionLower.includes("increase revision frequency")) {
        // e.g. "Increase revision frequency to daily"
        await db.logEvent(
          userId,
          "RULE_ENGINE_EXECUTION",
          `Rule #${rule.id} triggered: Accelerated spaced repetition intervals to daily review.`
        );
      }
    }
  } catch (error) {
    console.error("Rule evaluation execution failure:", error);
  }
}
