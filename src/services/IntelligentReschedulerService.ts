/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, TaskPriority, TaskStatus } from "../types";

export interface ReschedulerSettings {
  workStart: string;
  workEnd: string;
  sleepStart: string;
  sleepEnd: string;
  breakStart: string;
  breakEnd: string;
  quietStart: string;
  quietEnd: string;
}

export interface SchedulingConflict {
  taskA: Task;
  taskB: Task;
  reason: string;
}

export interface SuggestedSlot {
  date: string;
  time: string;
  score: number;
  reason: string;
}

/**
 * Convert HH:MM to numerical minutes past midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convert numerical minutes past midnight to time string HH:MM.
 */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Checks if a specific date and time span overlaps with blocked sleep, break, or quiet hours.
 */
export function isTimeBlocked(
  date: string,
  startMins: number,
  endMins: number,
  settings: ReschedulerSettings
): { blocked: boolean; reason: string } {
  const sleepS = timeToMinutes(settings.sleepEnd);
  const sleepE = timeToMinutes(settings.sleepStart);
  
  // Handles sleep periods spanning midnight
  const isInSleep = (m: number) => {
    if (sleepE > sleepS) {
      return m >= sleepE || m < sleepS;
    } else {
      return m >= sleepE && m < sleepS;
    }
  };

  const bS = timeToMinutes(settings.breakStart);
  const bE = timeToMinutes(settings.breakEnd);
  const qS = timeToMinutes(settings.quietStart);
  const qE = timeToMinutes(settings.quietEnd);

  for (let m = startMins; m < endMins; m++) {
    const actualMin = m % 1440;
    if (isInSleep(actualMin)) {
      return { blocked: true, reason: "Overlaps with Sleep Hours" };
    }
    if (actualMin >= bS && actualMin < bE) {
      return { blocked: true, reason: "Quiet Break hour" };
    }
    if (actualMin >= qS && actualMin < qE) {
      return { blocked: true, reason: "Quiet focus window" };
    }
  }

  return { blocked: false, reason: "" };
}

/**
 * Detects active overdue backlog tasks.
 */
export function detectOverdueTasks(activeTasks: Task[]): Task[] {
  const todayStr = new Date().toISOString().split("T")[0];
  const nowTimeMins = timeToMinutes(new Date().toTimeString().slice(0, 5));

  return activeTasks.filter(t => {
    if (!t.dueDate) return false;
    if (t.dueDate < todayStr) return true;
    if (t.dueDate === todayStr && t.dueTime && timeToMinutes(t.dueTime) < nowTimeMins) return true;
    return false;
  });
}

/**
 * Detects conflicts (overlaps on same day) and prerequisite dependency violations.
 */
export function detectConflicts(
  activeTasks: Task[],
  durations: Record<string, number>,
  dependencies: Record<string, string>
): SchedulingConflict[] {
  const conflicts: SchedulingConflict[] = [];
  
  // 1. Same-day overlap detection
  const tasksByDay: Record<string, Task[]> = {};
  activeTasks.forEach(t => {
    if (!t.dueDate) return;
    if (!tasksByDay[t.dueDate]) tasksByDay[t.dueDate] = [];
    tasksByDay[t.dueDate].push(t);
  });

  Object.keys(tasksByDay).forEach(date => {
    const dayTasks = tasksByDay[date];
    for (let i = 0; i < dayTasks.length; i++) {
      const taskA = dayTasks[i];
      const startA = timeToMinutes(taskA.dueTime || "09:00");
      const durationA = durations[taskA.id] || 60;
      const endA = startA + durationA;

      for (let j = i + 1; j < dayTasks.length; j++) {
        const taskB = dayTasks[j];
        const startB = timeToMinutes(taskB.dueTime || "09:00");
        const durationB = durations[taskB.id] || 60;
        const endB = startB + durationB;

        if (startA < endB && startB < endA) {
          conflicts.push({
            taskA,
            taskB,
            reason: `Overlap on ${date} between ${taskA.dueTime || "09:00"} and ${taskB.dueTime || "09:00"}`
          });
        }
      }
    }
  });

  // 2. Dependency sequence violation checks
  activeTasks.forEach(t => {
    const prereqId = dependencies[t.id];
    if (prereqId) {
      const prereq = activeTasks.find(p => p.id === prereqId);
      if (prereq) {
        const isPrereqLater = (prereq.dueDate > t.dueDate) || 
          (prereq.dueDate === t.dueDate && timeToMinutes(prereq.dueTime || "09:00") >= timeToMinutes(t.dueTime || "09:00"));
        
        if (isPrereqLater) {
          conflicts.push({
            taskA: prereq,
            taskB: t,
            reason: `Dependency Violation: Prerequisite '${prereq.title}' is scheduled after dependent '${t.title}'`
          });
        }
      }
    }
  });

  return conflicts;
}

/**
 * Generates optimal alternative slots using heuristic scoring and energy level mapping.
 */
export function getSuggestedSlots(
  task: Task,
  activeTasks: Task[],
  durations: Record<string, number>,
  dependencies: Record<string, string>,
  settings: ReschedulerSettings,
  limit = 4
): SuggestedSlot[] {
  const suggestions: SuggestedSlot[] = [];
  const today = new Date();
  const isHighPriority = task.priority === TaskPriority.CRITICAL || task.priority === TaskPriority.HIGH;
  const duration = durations[task.id] || 60;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + dayOffset);
    const dateStr = checkDate.toISOString().split("T")[0];

    const startWorkMins = timeToMinutes(settings.workStart);
    const endWorkMins = timeToMinutes(settings.workEnd);

    for (let mins = startWorkMins; mins <= endWorkMins - duration; mins += 30) {
      const timeStr = minutesToTime(mins);
      
      const blockStatus = isTimeBlocked(dateStr, mins, mins + duration, settings);
      if (blockStatus.blocked) continue;

      const hasOverlap = activeTasks.some(other => {
        if (other.id === task.id || other.dueDate !== dateStr) return false;
        const otherStart = timeToMinutes(other.dueTime || "09:00");
        const otherDur = durations[other.id] || 60;
        return mins < otherStart + otherDur && otherStart < mins + duration;
      });
      if (hasOverlap) continue;

      const prereqId = dependencies[task.id];
      if (prereqId) {
        const prereq = activeTasks.find(p => p.id === prereqId);
        if (prereq) {
          const isTooEarly = (prereq.dueDate > dateStr) || 
            (prereq.dueDate === dateStr && timeToMinutes(prereq.dueTime || "09:00") + (durations[prereq.id] || 60) > mins);
          if (isTooEarly) continue;
        }
      }

      let score = 80;
      let reason = "Clean available slot";

      const isMorning = mins >= 540 && mins <= 720; // 09:00 - 12:00
      const isEvening = mins >= 1080; // after 18:00

      if (isHighPriority) {
        if (isMorning) {
          score += 20;
          reason = "Peak morning energy window";
        } else if (isEvening) {
          score -= 30;
          reason = "Evening low-energy window (Avoid for critical work)";
        } else {
          score += 5;
          reason = "Optimal working hour";
        }
      } else {
        if (isMorning) {
          score -= 10;
          reason = "Saves morning for critical goals";
        } else if (mins >= 840 && mins <= 1020) { // 14:00 - 17:00
          score += 15;
          reason = "Perfect afternoon low-stress window";
        }
      }

      score -= dayOffset * 8;

      suggestions.push({
        date: dateStr,
        time: timeStr,
        score: Math.max(10, Math.min(100, score)),
        reason
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}
