/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tracker, LogEntry } from '../types';
import { getInitialTrackers, getInitialLogs } from './initialData';

const TRACKERS_KEY = 'data_tracker_trackers';
const LOGS_KEY = 'data_tracker_logs';

export interface StorageData {
  trackers: Tracker[];
  logs: LogEntry[];
}

export function loadData(): StorageData {
  try {
    const trackersJson = localStorage.getItem(TRACKERS_KEY);
    const logsJson = localStorage.getItem(LOGS_KEY);

    let trackers: Tracker[] = [];
    let logs: LogEntry[] = [];

    if (trackersJson) {
      trackers = JSON.parse(trackersJson);
    } else {
      trackers = getInitialTrackers();
      localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
    }

    if (logsJson) {
      logs = JSON.parse(logsJson);
    } else {
      logs = getInitialLogs();
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }

    return { trackers, logs };
  } catch (error) {
    console.error('Failed to load data from localStorage', error);
    return {
      trackers: getInitialTrackers(),
      logs: getInitialLogs(),
    };
  }
}

export function saveTrackers(trackers: Tracker[]): void {
  try {
    localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
  } catch (error) {
    console.error('Failed to save trackers', error);
  }
}

export function saveLogs(logs: LogEntry[]): void {
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save logs', error);
  }
}

export function exportDataAsJson(trackers: Tracker[], logs: LogEntry[]): string {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    trackers,
    logs,
  };
  return JSON.stringify(data, null, 2);
}

export function importDataFromJson(jsonString: string): { trackers: Tracker[]; logs: LogEntry[] } | null {
  try {
    const data = JSON.parse(jsonString);
    if (data && Array.isArray(data.trackers) && Array.isArray(data.logs)) {
      // Basic validation of fields
      const trackersValid = data.trackers.every((t: any) => t.id && t.name && t.type && t.color && t.icon);
      const logsValid = data.logs.every((l: any) => l.id && l.trackerId && l.value !== undefined && l.date);

      if (trackersValid && logsValid) {
        localStorage.setItem(TRACKERS_KEY, JSON.stringify(data.trackers));
        localStorage.setItem(LOGS_KEY, JSON.stringify(data.logs));
        return { trackers: data.trackers, logs: data.logs };
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to import JSON data', error);
    return null;
  }
}
