/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tracker, LogEntry, DailyReflection } from '../types';
import { getInitialTrackers, getInitialLogs } from './initialData';

const TRACKERS_KEY = 'data_tracker_trackers';
const LOGS_KEY = 'data_tracker_logs';
const REFLECTIONS_KEY = 'data_tracker_reflections';

export interface StorageData {
  trackers: Tracker[];
  logs: LogEntry[];
  reflections: DailyReflection[];
}

export function loadData(): StorageData {
  try {
    const trackersJson = localStorage.getItem(TRACKERS_KEY);
    const logsJson = localStorage.getItem(LOGS_KEY);
    const reflectionsJson = localStorage.getItem(REFLECTIONS_KEY);

    let trackers: Tracker[] = [];
    let logs: LogEntry[] = [];
    let reflections: DailyReflection[] = [];

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

    if (reflectionsJson) {
      reflections = JSON.parse(reflectionsJson);
    } else {
      reflections = [];
      localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));
    }

    return { trackers, logs, reflections };
  } catch (error) {
    console.error('Failed to load data from localStorage', error);
    return {
      trackers: getInitialTrackers(),
      logs: getInitialLogs(),
      reflections: [],
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

export function saveReflections(reflections: DailyReflection[]): void {
  try {
    localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));
  } catch (error) {
    console.error('Failed to save reflections', error);
  }
}

export function exportDataAsJson(trackers: Tracker[], logs: LogEntry[], reflections: DailyReflection[]): string {
  const data = {
    version: '1.1',
    exportedAt: new Date().toISOString(),
    trackers,
    logs,
    reflections,
  };
  return JSON.stringify(data, null, 2);
}

export function importDataFromJson(jsonString: string): { trackers: Tracker[]; logs: LogEntry[]; reflections: DailyReflection[] } | null {
  try {
    const data = JSON.parse(jsonString);
    if (data && Array.isArray(data.trackers) && Array.isArray(data.logs)) {
      // Basic validation of fields
      const trackersValid = data.trackers.every((t: any) => t.id && t.name && t.type && t.color && t.icon);
      const logsValid = data.logs.every((l: any) => l.id && l.trackerId && l.value !== undefined && l.date);

      if (trackersValid && logsValid) {
        localStorage.setItem(TRACKERS_KEY, JSON.stringify(data.trackers));
        localStorage.setItem(LOGS_KEY, JSON.stringify(data.logs));

        let reflections: DailyReflection[] = [];
        if (Array.isArray(data.reflections)) {
          const reflectionsValid = data.reflections.every((r: any) => r.date && r.text !== undefined);
          if (reflectionsValid) {
            reflections = data.reflections;
          }
        }
        localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));

        return { trackers: data.trackers, logs: data.logs, reflections };
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to import JSON data', error);
    return null;
  }
}

