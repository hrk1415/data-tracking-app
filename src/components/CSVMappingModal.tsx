/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ArrowRight, HelpCircle } from 'lucide-react';
import { ColumnMapping } from '../utils/csvParser';

interface CSVMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  csvText: string;
  onConfirm: (mapping: ColumnMapping) => void;
}

export function CSVMappingModal({ isOpen, onClose, headers, csvText, onConfirm }: CSVMappingModalProps) {
  const [dateIdx, setDateIdx] = useState<number>(-1);
  const [nameIdx, setNameIdx] = useState<number>(-1);
  const [valIdx, setValIdx] = useState<number>(-1);
  
  const [catIdx, setCatIdx] = useState<number>(-1);
  const [unitIdx, setUnitIdx] = useState<number>(-1);
  const [goalIdx, setGoalIdx] = useState<number>(-1);
  const [notesIdx, setNotesIdx] = useState<number>(-1);
  const [timestampIdx, setTimestampIdx] = useState<number>(-1);

  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-detect columns on mount or when headers change
  useEffect(() => {
    if (headers.length > 0) {
      let dIdx = -1;
      let nIdx = -1;
      let vIdx = -1;
      let cIdx = -1;
      let uIdx = -1;
      let gIdx = -1;
      let noIdx = -1;
      let tIdx = -1;

      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().trim();
        if (/date|day/i.test(h) && dIdx === -1) dIdx = i;
        else if (/tracker\s*name|tracker/i.test(h) && nIdx === -1) nIdx = i;
        else if (/category|cat/i.test(h) && cIdx === -1) cIdx = i;
        else if (/value|amount|qty|count/i.test(h) && vIdx === -1) vIdx = i;
        else if (/unit|measure/i.test(h) && uIdx === -1) uIdx = i;
        else if (/goal|target/i.test(h) && gIdx === -1) gIdx = i;
        else if (/notes|note|comment/i.test(h) && noIdx === -1) noIdx = i;
        else if (/logged\s*at|timestamp|time/i.test(h) && tIdx === -1) tIdx = i;
      }

      // If missing, apply basic positional fallback (0: Date, 1: Name, 2: Value)
      if (dIdx === -1 && headers.length >= 1) dIdx = 0;
      if (nIdx === -1 && headers.length >= 2) nIdx = 1;
      if (vIdx === -1 && headers.length >= 3) vIdx = 2;

      setDateIdx(dIdx);
      setNameIdx(nIdx);
      setValIdx(vIdx);
      setCatIdx(cIdx);
      setUnitIdx(uIdx);
      setGoalIdx(gIdx);
      setNotesIdx(noIdx);
      setTimestampIdx(tIdx);
    }
  }, [headers]);

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

    onConfirm(mapping);
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
            className="relative w-full max-w-xl overflow-hidden rounded-none bg-editorial-bg border border-editorial-dark/15 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-editorial-dark/15 px-6 py-4 bg-editorial-accent-light/10">
              <div className="flex flex-col">
                <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
                  <HelpCircle className="text-editorial-orange" size={18} />
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Info text */}
              <div className="bg-editorial-orange-light/10 border border-editorial-orange/15 p-3.5 text-xs text-editorial-dark/80 font-sans leading-relaxed">
                We detected the following columns in your file. For successful importing, map them to the corresponding tracker variables.
              </div>

              {validationError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 text-xs p-3 font-sans italic flex items-center gap-1.5">
                  <span className="font-bold">⚠️</span> {validationError}
                </div>
              )}

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
                      onChange={(e) => setDateIdx(Number(e.target.value))}
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
                      onChange={(e) => setNameIdx(Number(e.target.value))}
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
                      onChange={(e) => setValIdx(Number(e.target.value))}
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
                      onChange={(e) => setCatIdx(Number(e.target.value))}
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
                      onChange={(e) => setUnitIdx(Number(e.target.value))}
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
                      onChange={(e) => setGoalIdx(Number(e.target.value))}
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
                      onChange={(e) => setNotesIdx(Number(e.target.value))}
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
                      onChange={(e) => setTimestampIdx(Number(e.target.value))}
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
            </form>

            {/* Footer Actions */}
            <div className="border-t border-editorial-dark/15 px-6 py-4 bg-editorial-accent-light/30 flex items-center justify-between">
              <span className="text-[10px] font-mono text-editorial-dark/50 leading-tight">
                * Indicates a mandatory field.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-dark hover:bg-editorial-accent-light/40 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-none bg-editorial-dark px-5 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-bg hover:bg-editorial-orange hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                >
                  Confirm Import
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
