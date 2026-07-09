/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tracker, LogEntry } from '../types';

/**
 * Standard RFC 4180-compliant CSV parser with quote and escape support.
 */
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r' || char === '\n') {
        row.push(currentVal.trim());
        currentVal = '';
        if (row.length > 0 && row.some(cell => cell !== '')) {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip LF if CRLF
        }
      } else {
        currentVal += char;
      }
    }
  }

  // Handle the last element/row if there's no trailing newline
  if (currentVal !== '' || row.length > 0) {
    row.push(currentVal.trim());
    if (row.some(cell => cell !== '')) {
      result.push(row);
    }
  }

  return result;
}

export interface ColumnMapping {
  dateIdx: number;
  nameIdx: number;
  valIdx: number;
  catIdx?: number;
  unitIdx?: number;
  goalIdx?: number;
  notesIdx?: number;
  timestampIdx?: number;
}

/**
 * Parses and maps CSV row elements into structured trackers and log entries.
 */
export function importLogsFromCSV(
  csvText: string,
  existingTrackers: Tracker[],
  mapping?: ColumnMapping
): { trackers: Tracker[]; logs: LogEntry[]; importedCount: number } | null {
  const parsed = parseCSV(csvText);
  if (parsed.length < 2) return null; // Needs at least header and 1 data row

  const headerRow = parsed[0];
  
  // Find column indices
  let dateIdx = mapping ? mapping.dateIdx : -1;
  let nameIdx = mapping ? mapping.nameIdx : -1;
  let catIdx = mapping ? (mapping.catIdx ?? -1) : -1;
  let valIdx = mapping ? mapping.valIdx : -1;
  let unitIdx = mapping ? (mapping.unitIdx ?? -1) : -1;
  let goalIdx = mapping ? (mapping.goalIdx ?? -1) : -1;
  let notesIdx = mapping ? (mapping.notesIdx ?? -1) : -1;
  let timestampIdx = mapping ? (mapping.timestampIdx ?? -1) : -1;

  if (!mapping) {
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i].toLowerCase().trim();
      if (/date|day/i.test(h) && dateIdx === -1) dateIdx = i;
      else if (/tracker\s*name|tracker/i.test(h) && nameIdx === -1) nameIdx = i;
      else if (/category|cat/i.test(h) && catIdx === -1) catIdx = i;
      else if (/value|amount|qty|count/i.test(h) && valIdx === -1) valIdx = i;
      else if (/unit|measure/i.test(h) && unitIdx === -1) unitIdx = i;
      else if (/goal|target/i.test(h) && goalIdx === -1) goalIdx = i;
      else if (/notes|note|comment/i.test(h) && notesIdx === -1) notesIdx = i;
      else if (/logged\s*at|timestamp|time/i.test(h) && timestampIdx === -1) timestampIdx = i;
    }
  }

  // Require Date, Tracker Name, and Value to form a valid log entry
  if (dateIdx === -1 || nameIdx === -1 || valIdx === -1) {
    if (!mapping) {
      // Try positional fallback mapping if headers aren't explicitly matched
      if (headerRow.length >= 3) {
        dateIdx = 0;
        nameIdx = 1;
        valIdx = 2;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  const trackersMap = new Map<string, Tracker>();
  existingTrackers.forEach(t => {
    trackersMap.set(t.name.toLowerCase().trim(), t);
  });

  const newTrackers: Tracker[] = [...existingTrackers];
  const newLogs: LogEntry[] = [];
  let importedCount = 0;

  const colors = ['emerald', 'blue', 'indigo', 'violet', 'amber', 'rose', 'orange'];
  
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < Math.max(dateIdx, nameIdx, valIdx) + 1) continue;

    const dateStr = row[dateIdx]?.trim();
    const nameStr = row[nameIdx]?.trim();
    const valStr = row[valIdx]?.trim();

    if (!dateStr || !nameStr || !valStr) continue;

    // Parse date (support formats like YYYY-MM-DD or MM/DD/YYYY or MM-DD-YYYY or DD/MM/YYYY)
    let parsedDate = dateStr;
    const dateParts = dateStr.split(/[-/]/);
    if (dateParts.length === 3) {
      if (dateParts[2].length === 4 && dateParts[0].length <= 2) {
        // MM/DD/YYYY or DD/MM/YYYY - default to system's built-in parser fallback for security
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      } else if (dateParts[0].length === 4) {
        const yyyy = dateParts[0];
        const mm = dateParts[1].padStart(2, '0');
        const dd = dateParts[2].padStart(2, '0');
        parsedDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    // Strict regex validation for ISO YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        parsedDate = d.toISOString().split('T')[0];
      } else {
        continue; // skip if unparseable
      }
    }

    // Clean numeric value
    const cleanedVal = valStr.replace(/[^\d.-]/g, '');
    const value = parseFloat(cleanedVal);
    if (isNaN(value)) continue;

    // Match tracker case-insensitively
    const normalizedName = nameStr.toLowerCase().trim();
    let tracker = trackersMap.get(normalizedName);

    if (!tracker) {
      const trackerId = 'tr_' + Math.random().toString(36).substring(2, 9);
      const category = (catIdx !== -1 && row[catIdx]?.trim().toLowerCase()) || 'custom';
      const unit = (unitIdx !== -1 && row[unitIdx]?.trim()) || '';
      const goalStr = (goalIdx !== -1 && row[goalIdx]?.trim()) || '';
      const targetValue = goalStr ? parseFloat(goalStr.replace(/[^\d.-]/g, '')) : undefined;
      
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      tracker = {
        id: trackerId,
        name: nameStr,
        category: ['health', 'fitness', 'productivity', 'mind', 'finance', 'custom'].includes(category) ? category : 'custom',
        type: 'numeric',
        unit,
        color: randomColor,
        icon: 'Activity',
        targetValue: isNaN(targetValue as any) ? undefined : targetValue,
        createdAt: new Date().toISOString()
      };

      trackersMap.set(normalizedName, tracker);
      newTrackers.push(tracker);
    }

    const note = notesIdx !== -1 ? row[notesIdx]?.trim() : '';
    const timestamp = (timestampIdx !== -1 && row[timestampIdx]?.trim()) || new Date().toISOString();

    const logEntry: LogEntry = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      trackerId: tracker.id,
      value,
      date: parsedDate,
      note: note || undefined,
      timestamp
    };

    newLogs.push(logEntry);
    importedCount++;
  }

  return {
    trackers: newTrackers,
    logs: newLogs,
    importedCount
  };
}
