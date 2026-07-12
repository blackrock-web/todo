/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subtask } from "../types";

/**
 * Service layer to compute and aggregate time-tracked subtask progress.
 * Interpolates active subtask running timers to provide live, fluid updates.
 */
export interface ProgressMetrics {
  totalSubtasks: number;
  completedSubtasks: number;
  totalDurationSeconds: number;
  completedDurationSeconds: number;
  percentage: number;
}

export function aggregateSubtaskProgress(subtasks: Subtask[]): ProgressMetrics {
  const totalSubtasks = subtasks.length;
  if (totalSubtasks === 0) {
    return {
      totalSubtasks: 0,
      completedSubtasks: 0,
      totalDurationSeconds: 0,
      completedDurationSeconds: 0,
      percentage: 0
    };
  }

  let completedSubtasks = 0;
  let totalDurationSeconds = 0;
  let completedDurationSeconds = 0;

  subtasks.forEach((sub) => {
    if (sub.isCompleted) {
      completedSubtasks++;
    }

    // Calculate duration, incorporating active running timers
    let duration = sub.timerDuration || 0;
    if (sub.timerStartedAt) {
      const start = new Date(sub.timerStartedAt).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      duration += Math.max(0, elapsed);
    }

    totalDurationSeconds += duration;
    if (sub.isCompleted) {
      completedDurationSeconds += duration;
    }
  });

  // If there is tracked time, calculate progress based on time spent
  // Otherwise, fall back to subtask completion count percentage
  let percentage = 0;
  if (totalDurationSeconds > 0) {
    percentage = Math.round((completedDurationSeconds / totalDurationSeconds) * 100);
  } else {
    percentage = Math.round((completedSubtasks / totalSubtasks) * 100);
  }

  return {
    totalSubtasks,
    completedSubtasks,
    totalDurationSeconds,
    completedDurationSeconds,
    percentage: Math.min(100, Math.max(0, percentage))
  };
}
