import { Tracker, LogEntry } from '../types';

export interface TrendAlertResult {
  isAlert: boolean;
  percentChange: number; // e.g., +50 or -30
  average: number;
  currentValue: number;
  direction: 'increase' | 'decrease' | 'stable';
  loggedDaysCount: number;
}

/**
 * Calculates the current value of a tracker on a given date.
 */
export function getTrackerValueOnDate(tracker: Tracker, logs: LogEntry[], dateStr: string): { value: number; hasLogs: boolean } {
  const dayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);
  
  let value = 0;
  if (tracker.type === 'counter') {
    value = dayLogs.reduce((sum, log) => sum + log.value, 0);
  } else {
    value = dayLogs.length > 0 ? dayLogs[dayLogs.length - 1].value : 0;
  }

  return {
    value,
    hasLogs: dayLogs.length > 0
  };
}

/**
 * Analyzes trend data and detects if today's value deviates by > 20% from the 7-day rolling average.
 */
export function calculateTrendAlert(
  tracker: Tracker,
  logs: LogEntry[],
  selectedDate: string
): TrendAlertResult {
  // 1. Calculate current value today
  const { value: currentValue } = getTrackerValueOnDate(tracker, logs, selectedDate);

  // 2. Calculate values for the preceding 7 days (D-1 to D-7)
  const refDate = new Date(selectedDate + 'T12:00:00');
  let sum = 0;
  let loggedDaysCount = 0;

  for (let i = 1; i <= 7; i++) {
    const d = new Date(refDate.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const { value, hasLogs } = getTrackerValueOnDate(tracker, logs, dateStr);
    
    if (hasLogs) {
      loggedDaysCount++;
    }
    sum += value;
  }

  const average = sum / 7;

  // 3. Evaluate Trend Alert
  if (average > 0) {
    const percentChange = (currentValue - average) / average;
    const isAlert = Math.abs(percentChange) >= 0.20;
    return {
      isAlert,
      percentChange: Math.round(percentChange * 100),
      average,
      currentValue,
      direction: percentChange > 0 ? 'increase' : percentChange < 0 ? 'decrease' : 'stable',
      loggedDaysCount
    };
  } else if (average === 0 && currentValue > 0 && loggedDaysCount > 0) {
    // Average was 0, but there were logs in preceding 7 days, and today has a positive value (100% increase)
    return {
      isAlert: true,
      percentChange: 100,
      average,
      currentValue,
      direction: 'increase',
      loggedDaysCount
    };
  }

  return {
    isAlert: false,
    percentChange: 0,
    average,
    currentValue,
    direction: 'stable',
    loggedDaysCount
  };
}
