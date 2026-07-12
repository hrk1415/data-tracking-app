/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ArrowRight, HelpCircle, Sliders, Star, Trash2 } from 'lucide-react';
import { ColumnMapping, parseCSV } from '../utils/csvParser';

interface FormatPreset {
  id: string;
  name: string;
  description: string;
  rules: {
    date: RegExp[];
    name: RegExp[];
    val: RegExp[];
    cat?: RegExp[];
    unit?: RegExp[];
    goal?: RegExp[];
    notes?: RegExp[];
    timestamp?: RegExp[];
  };
}

const PRESETS: FormatPreset[] = [
  {
    id: 'auto',
    name: 'Auto-Detect (Smart scan)',
    description: 'Scans for headers matching common calendar and tracking terms.',
    rules: {
      date: [/date/i, /day/i],
      name: [/tracker\s*name/i, /tracker/i],
      val: [/value/i, /amount/i, /qty/i, /count/i],
      cat: [/category/i, /cat/i],
      unit: [/unit/i, /measure/i],
      goal: [/goal/i, /target/i],
      notes: [/notes/i, /note/i, /comment/i],
      timestamp: [/logged\s*at/i, /timestamp/i, /time/i]
    }
  },
  {
    id: 'apple_health',
    name: 'Apple Health Export',
    description: 'Pre-maps standard Apple Health CSV headers (startDate, type, value, unit).',
    rules: {
      date: [/startDate/i, /creationDate/i, /date/i],
      name: [/type/i, /name/i, /recordtype/i],
      val: [/value/i, /quantity/i, /amount/i],
      unit: [/unit/i],
      timestamp: [/endDate/i, /time/i]
    }
  },
  {
    id: 'google_fit',
    name: 'Google Fit Export',
    description: 'Pre-maps standard Google Fit export headers (start time, activity, value).',
    rules: {
      date: [/start\s*time/i, /date/i, /day/i],
      name: [/activity/i, /type/i, /name/i],
      val: [/value/i, /steps/i, /calories/i, /count/i],
      unit: [/unit/i]
    }
  },
  {
    id: 'habitica',
    name: 'Habitica Export',
    description: 'Pre-maps Habitica task, habit, and completion history columns.',
    rules: {
      date: [/completed/i, /date/i, /time/i],
      name: [/habit/i, /title/i, /task/i],
      val: [/value/i, /count/i, /qty/i]
    }
  },
  {
    id: 'standard',
    name: 'Standard Tracker Format',
    description: 'Uses exact matching for strict App data formats.',
    rules: {
      date: [/^date$/i],
      name: [/^tracker\s*name$/i],
      val: [/^value$/i],
      cat: [/^category$/i],
      unit: [/^unit$/i],
      goal: [/^goal$/i],
      notes: [/^notes$/i],
      timestamp: [/^timestamp$/i]
    }
  },
  {
    id: 'manual',
    name: 'Custom / Manual mapping',
    description: 'Allows fully manual customization of columns.',
    rules: {
      date: [],
      name: [],
      val: []
    }
  }
];

interface SavedPreset {
  id: string;
  name: string;
  dateHeader?: string;
  nameHeader?: string;
  valHeader?: string;
  catHeader?: string;
  unitHeader?: string;
  goalHeader?: string;
  notesHeader?: string;
  timestampHeader?: string;
  useSmartFormatting: boolean;
}

interface CSVMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  csvText: string;
  onConfirm: (mapping: ColumnMapping, useSmartFormatting: boolean) => void;
  onMappingChange?: (mappedCount: number) => void;
}

export function CSVMappingModal({ isOpen, onClose, headers, csvText, onConfirm, onMappingChange }: CSVMappingModalProps) {
  const [dateIdx, setDateIdx] = useState<number>(-1);
  const [nameIdx, setNameIdx] = useState<number>(-1);
  const [valIdx, setValIdx] = useState<number>(-1);
  
  const [catIdx, setCatIdx] = useState<number>(-1);
  const [unitIdx, setUnitIdx] = useState<number>(-1);
  const [goalIdx, setGoalIdx] = useState<number>(-1);
  const [notesIdx, setNotesIdx] = useState<number>(-1);
  const [timestampIdx, setTimestampIdx] = useState<number>(-1);

  const [selectedPreset, setSelectedPreset] = useState<string>('auto');
  const [useSmartFormatting, setUseSmartFormatting] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [step, setStep] = useState<'preview' | 'mapping'>('preview');

  // Custom favorite mapping configurations state
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [isSavingPreset, setIsSavingPreset] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const parsedData = React.useMemo(() => {
    return parseCSV(csvText);
  }, [csvText]);

  const previewRows = React.useMemo(() => {
    return parsedData.slice(1, 6);
  }, [parsedData]);

  const applyPreset = (presetId: string, currentSavedPresets: SavedPreset[] = savedPresets) => {
    if (presetId.startsWith('custom_')) {
      const pId = presetId.substring(7);
      const saved = currentSavedPresets.find(p => p.id === pId);
      if (saved) {
        const findIndexByHeader = (headerName?: string) => {
          if (!headerName) return -1;
          return headers.findIndex(h => h.trim() === headerName.trim());
        };

        setDateIdx(findIndexByHeader(saved.dateHeader));
        setNameIdx(findIndexByHeader(saved.nameHeader));
        setValIdx(findIndexByHeader(saved.valHeader));
        setCatIdx(findIndexByHeader(saved.catHeader));
        setUnitIdx(findIndexByHeader(saved.unitHeader));
        setGoalIdx(findIndexByHeader(saved.goalHeader));
        setNotesIdx(findIndexByHeader(saved.notesHeader));
        setTimestampIdx(findIndexByHeader(saved.timestampHeader));
        setUseSmartFormatting(saved.useSmartFormatting);
      }
      return;
    }

    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset || presetId === 'manual') return;

    let dIdx = -1;
    let nIdx = -1;
    let vIdx = -1;
    let cIdx = -1;
    let uIdx = -1;
    let gIdx = -1;
    let noIdx = -1;
    let tIdx = -1;

    const findIndex = (regexes: RegExp[] | undefined) => {
      if (!regexes) return -1;
      for (const regex of regexes) {
        for (let i = 0; i < headers.length; i++) {
          if (regex.test(headers[i].trim())) {
            return i;
          }
        }
      }
      return -1;
    };

    dIdx = findIndex(preset.rules.date);
    nIdx = findIndex(preset.rules.name);
    vIdx = findIndex(preset.rules.val);
    cIdx = findIndex(preset.rules.cat);
    uIdx = findIndex(preset.rules.unit);
    gIdx = findIndex(preset.rules.goal);
    noIdx = findIndex(preset.rules.notes);
    tIdx = findIndex(preset.rules.timestamp);

    // Dynamic Positional fallbacks for required fields if still not found and custom/auto is used
    if (presetId === 'auto' || presetId === 'standard') {
      if (dIdx === -1 && headers.length >= 1) dIdx = 0;
      if (nIdx === -1 && headers.length >= 2) nIdx = 1;
      if (vIdx === -1 && headers.length >= 3) vIdx = 2;
    }

    setDateIdx(dIdx);
    setNameIdx(nIdx);
    setValIdx(vIdx);
    setCatIdx(cIdx);
    setUnitIdx(uIdx);
    setGoalIdx(gIdx);
    setNotesIdx(noIdx);
    setTimestampIdx(tIdx);
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!newPresetName.trim()) {
      setSaveError('Please enter a name for the preset.');
      return;
    }

    if (dateIdx === -1 || nameIdx === -1 || valIdx === -1) {
      setSaveError('You must map the required fields (Date, Tracker Name, and Value) before saving.');
      return;
    }

    const newPreset: SavedPreset = {
      id: Math.random().toString(36).substring(2, 9),
      name: newPresetName.trim(),
      dateHeader: headers[dateIdx] || undefined,
      nameHeader: headers[nameIdx] || undefined,
      valHeader: headers[valIdx] || undefined,
      catHeader: catIdx !== -1 ? headers[catIdx] : undefined,
      unitHeader: unitIdx !== -1 ? headers[unitIdx] : undefined,
      goalHeader: goalIdx !== -1 ? headers[goalIdx] : undefined,
      notesHeader: notesIdx !== -1 ? headers[notesIdx] : undefined,
      timestampHeader: timestampIdx !== -1 ? headers[timestampIdx] : undefined,
      useSmartFormatting,
    };

    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem('csv_custom_mapping_presets', JSON.stringify(updated));
    setSelectedPreset(`custom_${newPreset.id}`);
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem('csv_custom_mapping_presets', JSON.stringify(updated));
    if (selectedPreset === `custom_${id}`) {
      setSelectedPreset('auto');
      applyPreset('auto', updated);
    }
  };

  // Reset and auto-detect when modal opens or headers change
  useEffect(() => {
    if (isOpen && headers.length > 0) {
      const stored = localStorage.getItem('csv_custom_mapping_presets');
      let currentPresets: SavedPreset[] = [];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSavedPresets(parsed);
          currentPresets = parsed;
        } catch (err) {
          console.error('Failed to parse saved presets:', err);
        }
      }
      setSelectedPreset('auto');
      applyPreset('auto', currentPresets);
      setStep('preview');
      setIsSavingPreset(false);
      setNewPresetName('');
      setSaveError(null);
    }
  }, [isOpen, headers]);

  // Synchronize column mapping count to parent uploader dashboard
  useEffect(() => {
    if (isOpen && onMappingChange) {
      let count = 0;
      if (dateIdx !== -1) count++;
      if (nameIdx !== -1) count++;
      if (valIdx !== -1) count++;
      onMappingChange(count);
    }
  }, [dateIdx, nameIdx, valIdx, isOpen, onMappingChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (dateIdx === -1 || nameIdx === -1 || valIdx === -1) {
      setValidationError('Please select columns for all required fields (Date, Tracker Name, and Value).');
      return;
    }

    if (dateIdx === nameIdx || dateIdx === valIdx || nameIdx === valIdx) {
      setValidationError('Each required field must be mapped to a unique column.');
      return;
    }

    const mapping: ColumnMapping = {
      dateIdx,
      nameIdx,
      valIdx,
      catIdx: catIdx !== -1 ? catIdx : undefined,
      unitIdx: unitIdx !== -1 ? unitIdx : undefined,
      goalIdx: goalIdx !== -1 ? goalIdx : undefined,
      notesIdx: notesIdx !== -1 ? notesIdx : undefined,
      timestampIdx: timestampIdx !== -1 ? timestampIdx : undefined,
    };

    onConfirm(mapping, useSmartFormatting);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-editorial-dark/65 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-none bg-editorial-bg border border-editorial-dark/15 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-editorial-dark/15 px-6 py-4 bg-editorial-accent-light/10">
              <div className="flex flex-col">
                <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
                  <Sliders className="text-editorial-orange" size={18} />
                  Map CSV Columns
                </h3>
                <p className="text-[11px] text-editorial-dark/60 font-sans mt-0.5">
                  Confirm how your CSV headers map to the required log data fields.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-none p-1 text-editorial-dark/40 hover:bg-editorial-accent-light/40 hover:text-editorial-dark transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper progress indicator */}
            <div className="flex items-center justify-center border-b border-editorial-dark/10 bg-editorial-accent-light/5 py-3 px-6 gap-6">
              <button
                type="button"
                onClick={() => setStep('preview')}
                className={`flex items-center gap-2 text-xs font-mono tracking-wider uppercase transition-colors ${
                  step === 'preview'
                    ? 'text-editorial-orange font-bold border-b border-editorial-orange pb-0.5'
                    : 'text-editorial-dark/50 hover:text-editorial-dark'
                }`}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-editorial-orange text-white text-[10px] font-bold">1</span>
                <span>Preview Layout</span>
              </button>
              <ArrowRight size={12} className="text-editorial-dark/30" />
              <button
                type="button"
                onClick={() => {
                  setStep('mapping');
                }}
                className={`flex items-center gap-2 text-xs font-mono tracking-wider uppercase transition-colors ${
                  step === 'mapping'
                    ? 'text-editorial-orange font-bold border-b border-editorial-orange pb-0.5'
                    : 'text-editorial-dark/50 hover:text-editorial-dark'
                }`}
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  step === 'mapping' ? 'bg-editorial-orange text-white' : 'bg-editorial-dark/10 text-editorial-dark/60'
                }`}>2</span>
                <span>Map Columns</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {validationError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 text-xs p-3 font-sans italic flex items-center gap-1.5">
                  <span className="font-bold">⚠️</span> {validationError}
                </div>
              )}

              {step === 'preview' ? (
                /* Step 1: Preview Layout */
                <div className="space-y-6">
                  <div className="bg-editorial-accent-light/20 border border-editorial-dark/10 p-4 text-xs text-editorial-dark/80 font-sans leading-relaxed">
                    <p className="font-serif font-semibold text-editorial-dark mb-1">Step 1: Data Layout Preview</p>
                    Confirm that your CSV file headers and data rows were parsed correctly. You can inspect the first 5 records of your file below before proceeding.
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-mono text-editorial-accent tracking-widest uppercase font-semibold">
                      Parsed CSV Rows (First 5 Rows)
                    </h4>
                    <div className="border border-editorial-dark/15 overflow-x-auto bg-white">
                      <table className="min-w-full divide-y divide-editorial-dark/15 font-mono text-[10px]">
                        <thead className="bg-editorial-dark/[0.03]">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-center text-editorial-dark/55 font-bold uppercase tracking-wider border-r border-editorial-dark/10 bg-editorial-dark/[0.05] w-12 select-none">
                              #
                            </th>
                            {headers.map((h, idx) => (
                              <th key={idx} scope="col" className="px-3 py-2 text-left text-editorial-dark font-semibold uppercase tracking-wider border-r border-editorial-dark/10 last:border-r-0 whitespace-nowrap bg-editorial-dark/[0.05]">
                                {h || `Column ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-editorial-dark/10 bg-white">
                          {previewRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-editorial-orange-light/5 transition-colors">
                              <td className="px-3 py-2 text-center text-editorial-dark/50 bg-editorial-dark/[0.01] border-r border-editorial-dark/10 select-none">
                                {rowIdx + 1}
                              </td>
                              {headers.map((_, colIdx) => (
                                <td key={colIdx} className="px-3 py-2 text-editorial-dark/85 border-r border-editorial-dark/10 last:border-r-0 whitespace-nowrap max-w-[200px] truncate" title={row[colIdx] || ''}>
                                  {row[colIdx] !== undefined ? row[colIdx] : <span className="text-editorial-dark/30 italic">empty</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {previewRows.length === 0 && (
                            <tr>
                              <td colSpan={headers.length + 1} className="px-3 py-8 text-center text-editorial-dark/50 italic font-serif">
                                No data rows found in this file besides the header.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-editorial-dark/55 font-sans">
                      <span>Showing {previewRows.length} of {parsedData.length - 1} data rows</span>
                      {parsedData.length - 1 > 5 && (
                        <span>Only the first 5 records are previewed.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Mapping Configuration */
                <div className="space-y-6">
                  {/* Info text */}
                  <div className="bg-editorial-orange-light/10 border border-editorial-orange/15 p-3.5 text-xs text-editorial-dark/80 font-sans leading-relaxed">
                    We detected the following columns in your file. For successful importing, map them to the corresponding tracker variables.
                  </div>

                  {/* Format Preset Selector */}
                  <div className="bg-editorial-accent-light/20 border border-editorial-dark/10 p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-mono font-medium text-editorial-dark/60 uppercase tracking-wider">
                          Common CSV Formats Preset:
                        </label>
                        {savedPresets.length > 0 && (
                          <span className="text-[10px] font-mono text-editorial-accent font-semibold flex items-center gap-1">
                            ⭐ {savedPresets.length} saved configuration{savedPresets.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <select
                          value={selectedPreset}
                          onChange={(e) => {
                            const nextPreset = e.target.value;
                            setSelectedPreset(nextPreset);
                            applyPreset(nextPreset);
                          }}
                          className="flex-1 rounded-none border border-editorial-dark/20 px-3 py-2.5 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all cursor-pointer font-serif font-medium"
                        >
                          <optgroup label="Standard Presets">
                            {PRESETS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                          {savedPresets.length > 0 && (
                            <optgroup label="⭐ Saved Favorites">
                              {savedPresets.map((p) => (
                                <option key={p.id} value={`custom_${p.id}`}>
                                  {p.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>

                        {/* Save Current button */}
                        <button
                          type="button"
                          disabled={dateIdx === -1 || nameIdx === -1 || valIdx === -1}
                          onClick={() => {
                            setSaveError(null);
                            setIsSavingPreset(!isSavingPreset);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-wider transition-all border ${
                            dateIdx === -1 || nameIdx === -1 || valIdx === -1
                              ? 'opacity-40 cursor-not-allowed bg-editorial-bg text-editorial-dark/40 border-editorial-dark/10'
                              : isSavingPreset
                              ? 'bg-editorial-orange text-white border-editorial-orange'
                              : 'bg-white hover:bg-editorial-accent-light/30 text-editorial-dark border-editorial-dark/20 hover:border-editorial-dark/40 cursor-pointer'
                          }`}
                          title={
                            dateIdx === -1 || nameIdx === -1 || valIdx === -1
                              ? 'Configure required fields first to save mapping'
                              : 'Save current columns mapping configuration'
                          }
                        >
                          <Star size={13} className={isSavingPreset ? 'fill-white' : ''} />
                          <span>Save Preset</span>
                        </button>
                      </div>

                      {/* Active preset description / custom header review */}
                      {(() => {
                        if (selectedPreset.startsWith('custom_')) {
                          const pId = selectedPreset.substring(7);
                          const saved = savedPresets.find(p => p.id === pId);
                          if (saved) {
                            return (
                              <div className="bg-white/60 border border-editorial-dark/5 p-2 rounded-none space-y-1">
                                <p className="text-[10px] text-editorial-dark/70 font-sans">
                                  <strong>Active Saved Favorite:</strong> Maps columns based on column headers:
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 font-mono text-[9px] text-editorial-dark/65">
                                  {saved.dateHeader && <div>📅 Date: <span className="text-editorial-orange font-semibold">{saved.dateHeader}</span></div>}
                                  {saved.nameHeader && <div>🏷️ Tracker: <span className="text-editorial-orange font-semibold">{saved.nameHeader}</span></div>}
                                  {saved.valHeader && <div>🔢 Value: <span className="text-editorial-orange font-semibold">{saved.valHeader}</span></div>}
                                  {saved.catHeader && <div>📂 Category: <span className="text-editorial-dark/50">{saved.catHeader}</span></div>}
                                  {saved.unitHeader && <div>⚖️ Unit: <span className="text-editorial-dark/50">{saved.unitHeader}</span></div>}
                                  {saved.goalHeader && <div>🎯 Goal: <span className="text-editorial-dark/50">{saved.goalHeader}</span></div>}
                                  {saved.notesHeader && <div>📝 Notes: <span className="text-editorial-dark/50">{saved.notesHeader}</span></div>}
                                  {saved.timestampHeader && <div>⏰ Time: <span className="text-editorial-dark/50">{saved.timestampHeader}</span></div>}
                                </div>
                              </div>
                            );
                          }
                        }
                        return (
                          <p className="text-[10px] text-editorial-dark/60 font-sans leading-tight">
                            {PRESETS.find((p) => p.id === selectedPreset)?.description}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Inline Preset Creator Form */}
                    <AnimatePresence>
                      {isSavingPreset && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="bg-white border border-editorial-dark/15 p-3.5 space-y-3 overflow-hidden"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-serif font-semibold text-editorial-dark">
                            <Star size={13} className="text-editorial-orange fill-editorial-orange" />
                            <span>Save Current Column Mapping Configuration</span>
                          </div>
                          
                          <p className="text-[10px] text-editorial-dark/60 leading-relaxed">
                            Give your configuration a memorable name. We will save the column header names (<strong>{headers[dateIdx]}</strong>, <strong>{headers[nameIdx]}</strong>, etc.) so we can automatically align future spreadsheets even if they are in a different order.
                          </p>

                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-mono uppercase tracking-wider text-editorial-dark/50">
                              Preset Name
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="e.g., Weekly Sleep Tracker, Fitbit Export"
                                className="flex-1 rounded-none border border-editorial-dark/20 px-2.5 py-1.5 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleSavePreset}
                                className="bg-editorial-dark text-editorial-bg hover:bg-editorial-orange hover:text-white px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer font-bold"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSavingPreset(false);
                                  setNewPresetName('');
                                  setSaveError(null);
                                }}
                                className="border border-editorial-dark/20 hover:bg-editorial-accent-light/20 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                            {saveError && (
                              <p className="text-[10px] text-rose-600 font-sans italic">
                                ⚠️ {saveError}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Manage Saved Favorites */}
                    {savedPresets.length > 0 && (
                      <div className="pt-3 border-t border-editorial-dark/10 space-y-2">
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-editorial-dark/50">
                          Your Favorite Presets ({savedPresets.length}):
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                          {savedPresets.map((preset) => {
                            const isSelected = selectedPreset === `custom_${preset.id}`;
                            return (
                              <div
                                key={preset.id}
                                className={`flex items-center justify-between p-2 transition-all border ${
                                  isSelected
                                    ? 'bg-editorial-orange-light/10 border-editorial-orange'
                                    : 'bg-white/40 hover:bg-white border-editorial-dark/10 hover:border-editorial-dark/20'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPreset(`custom_${preset.id}`);
                                    applyPreset(`custom_${preset.id}`);
                                  }}
                                  className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                                >
                                  <div className="font-serif font-semibold text-xs text-editorial-dark truncate flex items-center gap-1">
                                    <Star size={10} className={`shrink-0 ${isSelected ? 'text-editorial-orange fill-editorial-orange' : 'text-editorial-dark/40'}`} />
                                    <span className="truncate">{preset.name}</span>
                                  </div>
                                  <p className="text-[8px] font-mono text-editorial-dark/40 truncate">
                                    {preset.dateHeader} • {preset.nameHeader} • {preset.valHeader}
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePreset(preset.id, e)}
                                  className="text-editorial-dark/40 hover:text-rose-600 p-1 hover:bg-rose-500/5 transition-colors cursor-pointer"
                                  title="Delete saved preset"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Smart Formatting Toggle */}
                    <div className="pt-3 border-t border-editorial-dark/10 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="smart-formatting-toggle"
                        checked={useSmartFormatting}
                        onChange={(e) => setUseSmartFormatting(e.target.checked)}
                        className="mt-0.5 rounded-none border-editorial-dark/20 text-editorial-orange focus:ring-editorial-orange h-4 w-4 cursor-pointer accent-editorial-orange"
                      />
                      <div className="flex flex-col">
                        <label
                          htmlFor="smart-formatting-toggle"
                          className="text-xs font-serif font-semibold text-editorial-dark cursor-pointer flex items-center gap-1.5"
                        >
                          Enable Smart Formatting
                          <span className="bg-editorial-orange/10 text-editorial-orange text-[9px] font-mono px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                            Recommended
                          </span>
                        </label>
                        <p className="text-[10px] text-editorial-dark/60 font-sans leading-relaxed mt-0.5">
                          Automatically trims whitespace/zero-width chars and corrects date formatting inconsistencies (e.g. converting <strong>MM/DD/YYYY</strong> or timestamped entries to standard <strong>YYYY-MM-DD</strong>).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Required Columns Section */}
                  <div>
                    <span className="block text-[10px] font-mono font-medium text-editorial-dark/40 uppercase tracking-widest mb-3 border-b border-editorial-dark/10 pb-1">
                      Required Fields
                    </span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Date Column */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif font-semibold text-editorial-dark flex items-center justify-between">
                          <span>Date *</span>
                          <span className="text-[9px] font-mono font-normal text-editorial-orange/80">YYYY-MM-DD</span>
                        </label>
                        <select
                          value={dateIdx}
                          onChange={(e) => {
                            setDateIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">-- Select Column --</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tracker Name Column */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif font-semibold text-editorial-dark">
                          Tracker Name *
                        </label>
                        <select
                          value={nameIdx}
                          onChange={(e) => {
                            setNameIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">-- Select Column --</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Value Column */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif font-semibold text-editorial-dark">
                          Value *
                        </label>
                        <select
                          value={valIdx}
                          onChange={(e) => {
                            setValIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">-- Select Column --</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Optional Fields Section */}
                  <div>
                    <span className="block text-[10px] font-mono font-medium text-editorial-dark/40 uppercase tracking-widest mb-3 border-b border-editorial-dark/10 pb-1">
                      Optional Fields (Highly Recommended)
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Category */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif text-editorial-dark">
                          Category
                        </label>
                        <select
                          value={catIdx}
                          onChange={(e) => {
                            setCatIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">None / Ignore</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Unit */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif text-editorial-dark">
                          Measurement Unit
                        </label>
                        <select
                          value={unitIdx}
                          onChange={(e) => {
                            setUnitIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">None / Ignore</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Goal */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif text-editorial-dark">
                          Daily Goal Target
                        </label>
                        <select
                          value={goalIdx}
                          onChange={(e) => {
                            setGoalIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">None / Ignore</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Notes */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-serif text-editorial-dark">
                          Notes / Comments
                        </label>
                        <select
                          value={notesIdx}
                          onChange={(e) => {
                            setNotesIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">None / Ignore</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Timestamp */}
                      <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-1 md:col-span-1">
                        <label className="text-xs font-serif text-editorial-dark">
                          Log Timestamp
                        </label>
                        <select
                          value={timestampIdx}
                          onChange={(e) => {
                            setTimestampIdx(Number(e.target.value));
                            setSelectedPreset('manual');
                          }}
                          className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-xs bg-editorial-bg text-editorial-dark focus:border-editorial-orange outline-none transition-all"
                        >
                          <option value="-1">None / Ignore</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Footer Actions */}
            <div className="border-t border-editorial-dark/15 px-6 py-4 bg-editorial-accent-light/30 flex items-center justify-between">
              <span className="text-[10px] font-mono text-editorial-dark/50 leading-tight">
                {step === 'preview' ? 'Step 1 of 2: Verify CSV Structure' : '* Indicates a mandatory field.'}
              </span>
              <div className="flex items-center gap-3">
                {step === 'preview' ? (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-dark hover:bg-editorial-accent-light/40 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('mapping')}
                      className="rounded-none bg-editorial-dark px-5 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-bg hover:bg-editorial-orange hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      Proceed to Mapping
                      <ArrowRight size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('preview')}
                      className="rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-dark hover:bg-editorial-accent-light/40 transition-colors cursor-pointer"
                    >
                      Back to Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="rounded-none bg-editorial-dark px-5 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-bg hover:bg-editorial-orange hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      Confirm Import
                      <ArrowRight size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
