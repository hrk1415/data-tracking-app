import { jsPDF } from 'jspdf';
import { Tracker, LogEntry, DailyReflection, MILESTONE_CATEGORIES } from '../types';

/**
 * Formats a raw YYYY-MM-DD date string into a classic editorial date.
 * e.g., "2026-07-13" -> "Monday, July 13, 2026"
 */
const getFormattedDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('default', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

/**
 * Renders the top header, decorative elements, background color, and page numbers
 * to maintain a consistent editorial design across all pages of the document.
 */
function initPage(doc: jsPDF, pageNum: number, dateStr: string) {
  // Page background: warm, elegant cream color
  doc.setFillColor(249, 246, 240);
  doc.rect(0, 0, 210, 297, 'F');
  
  // Decorative top border strip: rich terracotta accent color
  doc.setFillColor(212, 93, 67); 
  doc.rect(15, 12, 180, 2, 'F');
  
  // Top running header
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("DAILY PROGRESS RECORD", 15, 9);
  
  const formattedHeaderDate = getFormattedDate(dateStr).toUpperCase();
  doc.text(formattedHeaderDate, 195, 9, { align: 'right' });

  // Running footer details
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("CONFIDENTIAL & PERSONAL LEDGER", 15, 285);
  doc.text(`Page ${pageNum}`, 195, 285, { align: 'right' });
}

export function exportDailyReport(
  date: string,
  trackers: Tracker[],
  logs: LogEntry[],
  reflections: DailyReflection[],
  dailyStats: {
    completedGoals: number;
    withGoals: number;
    completionRate: number;
  },
  goalStreaks: {
    currentStreak: number;
    longestStreak: number;
  },
  totalLogsCount: number,
  selectedDateLogVolume: number
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let pageNum = 1;
  initPage(doc, pageNum, date);

  let y = 25;

  // 1. Document Title
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(28, 28, 28);
  doc.text("The Daily Progress Ledger", 15, y);
  y += 6;

  // Subtitle / slogan text
  doc.setFont('times', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(100, 100, 100);
  doc.text("A comprehensive summary of tracked goals, active streaks, reflections, and key milestones.", 15, y);
  y += 10;

  // 2. Bento Stats Grid (4 Boxes)
  const boxWidth = 42;
  const boxGap = 4;
  const boxHeight = 22;
  const xStart = 15;

  const statsData = [
    {
      title: "GOALS MET",
      val: `${dailyStats.completedGoals} / ${dailyStats.withGoals}`,
      desc: "habits completed today"
    },
    {
      title: "ACHIEVEMENT RATE",
      val: `${dailyStats.completionRate}%`,
      desc: "overall goal fulfillment"
    },
    {
      title: "GOAL STREAK",
      val: `${goalStreaks.currentStreak} Days`,
      desc: `personal record: ${goalStreaks.longestStreak}d`
    },
    {
      title: "LOGS RECORDED",
      val: `${selectedDateLogVolume} Logs`,
      desc: `total history entries: ${totalLogsCount}`
    }
  ];

  statsData.forEach((stat, idx) => {
    const bx = xStart + idx * (boxWidth + boxGap);
    
    // Draw outer box border & background fill
    doc.setFillColor(241, 237, 228); 
    doc.setDrawColor(230, 223, 213); 
    doc.setLineWidth(0.3);
    doc.rect(bx, y, boxWidth, boxHeight, 'FD');
    
    // Draw Box header label
    doc.setFont('courier', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(stat.title, bx + 3.5, y + 5);
    
    // Draw main statistic text value
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(28, 28, 28);
    doc.text(stat.val, bx + 3.5, y + 12);
    
    // Draw helper description text
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(110, 110, 110);
    doc.text(stat.desc, bx + 3.5, y + 18.5);
  });

  // Render visual progress bar under Box 2: Achievement Rate
  const barX = 15 + 42 + 4 + 3.5;
  const barY = y + 13.5;
  const barWidth = 35;
  const barHeight = 1.2;
  doc.setFillColor(225, 218, 208); 
  doc.rect(barX, barY, barWidth, barHeight, 'F');
  doc.setFillColor(212, 93, 67); // Terracotta filled rate indicator
  doc.rect(barX, barY, barWidth * (Math.min(100, dailyStats.completionRate) / 100), barHeight, 'F');

  y += boxHeight + 11;

  // 3. Goals & Metrics Section
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(212, 93, 67); 
  doc.text("I. DAILY HABITS & METRICS TRACKING", 15, y);
  y += 5;

  // Thick accent separator line
  doc.setDrawColor(212, 93, 67);
  doc.setLineWidth(0.4);
  doc.line(15, y, 195, y);
  y += 4;

  // Draw Table header row
  doc.setFillColor(230, 223, 213);
  doc.rect(15, y, 180, 6, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text("HABIT / METRIC", 17, y + 4.2);
  doc.text("VALUE LOGGED", 65, y + 4.2);
  doc.text("DAILY GOAL", 90, y + 4.2);
  doc.text("STATUS", 112, y + 4.2);
  doc.text("CONTEXT / OBSERVATIONS", 132, y + 4.2);
  y += 6;

  // Fetch optional context notes from active day reflection
  const activeReflection = reflections.find(r => r.date === date);
  const goalNotes = activeReflection?.goalNotes || {};

  // Render rows
  trackers.forEach(t => {
    // Collect and aggregate logged metrics
    const tLogs = logs.filter(l => l.trackerId === t.id && l.date === date);
    const totalVal = t.type === 'counter'
      ? tLogs.reduce((sum, l) => sum + l.value, 0)
      : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

    const targetVal = t.targetValue;
    const isGoal = targetVal !== undefined && targetVal > 0;
    const isMet = isGoal ? totalVal >= (targetVal || 0) : false;
    
    const noteText = goalNotes[t.id] || "";
    
    // Value string building
    let valStr = "";
    if (tLogs.length === 0) {
      valStr = "—";
    } else if (t.type === 'boolean') {
      valStr = totalVal > 0 ? "Completed" : "Incomplete";
    } else if (t.type === 'rating') {
      valStr = `${totalVal} / 5 Stars`;
    } else {
      valStr = `${totalVal} ${t.unit || ""}`;
    }

    const goalStr = isGoal ? `${targetVal} ${t.unit || ""}` : "None";

    // Text wrapping configuration
    const noteLines = noteText ? doc.splitTextToSize(noteText, 61) : [];
    const nameLines = doc.splitTextToSize(`${t.name} (${t.category.toUpperCase()})`, 44);
    
    const rowHeight = Math.max(6, Math.max(nameLines.length * 4, noteLines.length * 4)) + 4;

    // Check for height page-break
    if (y + rowHeight > 265) {
      pageNum++;
      doc.addPage();
      initPage(doc, pageNum, date);
      y = 25;
      
      // Reprint Table header
      doc.setFillColor(230, 223, 213);
      doc.rect(15, y, 180, 6, 'F');
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      doc.text("HABIT / METRIC", 17, y + 4.2);
      doc.text("VALUE LOGGED", 65, y + 4.2);
      doc.text("DAILY GOAL", 90, y + 4.2);
      doc.text("STATUS", 112, y + 4.2);
      doc.text("CONTEXT / OBSERVATIONS", 132, y + 4.2);
      y += 6;
    }

    // Row zebra background color
    doc.setFillColor(245, 241, 234);
    doc.rect(15, y, 180, rowHeight, 'F');
    
    // Bottom spacer border line
    doc.setDrawColor(230, 223, 213);
    doc.setLineWidth(0.18);
    doc.line(15, y + rowHeight, 195, y + rowHeight);

    // Render Metric Title details
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(28, 28, 28);
    nameLines.forEach((line: string, index: number) => {
      doc.text(line, 17, y + 3.8 + index * 4);
    });

    // Render actual value
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(valStr, 65, y + 4);

    // Render target requirement
    doc.text(goalStr, 90, y + 4);

    // Render Goal Met status badges
    if (isGoal) {
      if (isMet) {
        doc.setFillColor(62, 142, 117); // Emerald success indicator
        doc.rect(112, y + 1.8, 14, 4, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text("MET", 119, y + 4.7, { align: 'center' });
      } else {
        doc.setFillColor(212, 93, 67); // Terracotta unmet indicator
        doc.rect(112, y + 1.8, 14, 4, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text("UNMET", 119, y + 4.7, { align: 'center' });
      }
    } else {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("—", 119, y + 4, { align: 'center' });
    }

    // Render Context observations note column
    if (noteLines.length > 0) {
      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      noteLines.forEach((line: string, index: number) => {
        doc.text(line, 132, y + 3.8 + index * 4);
      });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 180, 180);
      doc.text("No specific notes entered.", 132, y + 4);
    }

    y += rowHeight;
  });

  // 4. Daily Reflection Journal block
  const reflectionText = activeReflection?.text || "";
  y += 7;

  if (reflectionText.trim() !== "") {
    const wrappedReflection = doc.splitTextToSize(reflectionText, 168);
    const boxHeightComputed = wrappedReflection.length * 4.5 + 9;

    // Check page space limit
    if (y + boxHeightComputed + 16 > 265) {
      pageNum++;
      doc.addPage();
      initPage(doc, pageNum, date);
      y = 25;
    }

    // Header of Section
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(212, 93, 67);
    doc.text("II. DAILY JOURNAL REFLECTION", 15, y);
    y += 5;

    doc.setDrawColor(212, 93, 67);
    doc.setLineWidth(0.4);
    doc.line(15, y, 195, y);
    y += 4;

    // Quotation block background card
    doc.setFillColor(245, 241, 234);
    doc.rect(15, y, 180, boxHeightComputed, 'F');

    // Accent left highlight column line
    doc.setFillColor(212, 93, 67);
    doc.rect(15, y, 1.5, boxHeightComputed, 'F');

    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 28, 28);
    
    wrappedReflection.forEach((line: string, index: number) => {
      doc.text(line, 22, y + 6.2 + index * 4.5);
    });

    y += boxHeightComputed + 4;
  } else {
    // Empty journal state card
    if (y + 19 > 265) {
      pageNum++;
      doc.addPage();
      initPage(doc, pageNum, date);
      y = 25;
    }
    
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(212, 93, 67);
    doc.text("II. DAILY JOURNAL REFLECTION", 15, y);
    y += 5;

    doc.setDrawColor(212, 93, 67);
    doc.setLineWidth(0.4);
    doc.line(15, y, 195, y);
    y += 4;

    doc.setFillColor(245, 241, 234);
    doc.rect(15, y, 180, 10, 'F');
    
    doc.setFillColor(180, 180, 180);
    doc.rect(15, y, 1.5, 10, 'F');

    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No reflection entries logged for this day.", 22, y + 6.2);
    y += 14;
  }

  // 5. Time-Stamped Milestones Section
  const milestones = activeReflection?.milestones || [];
  y += 3;

  if (y + 16 > 265) {
    pageNum++;
    doc.addPage();
    initPage(doc, pageNum, date);
    y = 25;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(212, 93, 67);
  doc.text("III. CHRONOLOGICAL MILESTONE TIMELINE", 15, y);
  y += 5;

  doc.setDrawColor(212, 93, 67);
  doc.setLineWidth(0.4);
  doc.line(15, y, 195, y);
  y += 6;

  if (milestones.length > 0) {
    const sortedMilestones = [...milestones].sort((a, b) => a.time.localeCompare(b.time));

    sortedMilestones.forEach((ms) => {
      const textLines = doc.splitTextToSize(ms.text, 135);
      const noteLines = ms.notes ? doc.splitTextToSize(ms.notes, 130) : [];
      
      const blockHeight = textLines.length * 4.5 + (noteLines.length > 0 ? noteLines.length * 4 + 3 : 0) + 5;

      // Handle timeline page split
      if (y + blockHeight > 265) {
        pageNum++;
        doc.addPage();
        initPage(doc, pageNum, date);
        y = 25;
        
        doc.setDrawColor(212, 93, 67);
        doc.setLineWidth(0.3);
        doc.line(15, y, 195, y);
        y += 6;
      }

      // Draw vertical alignment bar for timeline connection
      doc.setFillColor(230, 223, 213);
      doc.rect(34.4, y - 6, 1.2, blockHeight + 6, 'F');

      // Customize dot indicator color by importance level
      let dotColor = [212, 93, 67]; 
      if (ms.importance === 'high') dotColor = [220, 38, 38]; 
      else if (ms.importance === 'medium') dotColor = [245, 158, 11]; 
      else if (ms.importance === 'low') dotColor = [59, 130, 246]; 

      doc.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
      doc.ellipse(35, y + 2.2, 1.8, 1.8, 'F');

      // Print timestamp
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(28, 28, 28);
      doc.text(ms.time, 15, y + 3);

      // Print key event text description
      doc.setFont('times', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(28, 28, 28);
      textLines.forEach((line: string, lIdx: number) => {
        doc.text(line, 42, y + 3 + lIdx * 4.5);
      });

      let currentOffset = y + 3 + (textLines.length - 1) * 4.5 + 4;

      // Draw importance priority badge
      if (ms.importance) {
        doc.setFont('courier', 'bold');
        doc.setFontSize(6);
        doc.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
        doc.rect(42, currentOffset - 2.5, 14, 3.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(ms.importance.toUpperCase(), 49, currentOffset, { align: 'center' });
        currentOffset += 4.5;
      }

      // Draw category label tag
      if (ms.category) {
        const catObj = MILESTONE_CATEGORIES.find(c => c.id === ms.category);
        const catName = catObj ? catObj.name : ms.category;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(`[Category: ${catName.toUpperCase()}]`, ms.importance ? 59 : 42, ms.importance ? currentOffset - 4.5 : currentOffset);
      }

      // Draw optional detail notes block
      if (noteLines.length > 0) {
        doc.setDrawColor(230, 223, 213);
        doc.setLineWidth(0.15);
        doc.line(42, currentOffset, 175, currentOffset);
        currentOffset += 3.5;

        doc.setFont('times', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 80);
        noteLines.forEach((nLine: string, nIdx: number) => {
          doc.text(nLine, 44, currentOffset + nIdx * 4);
        });
      }

      y += blockHeight;
    });
  } else {
    // Render timeline fallback empty list card
    doc.setFillColor(245, 241, 234);
    doc.rect(15, y, 180, 10, 'F');

    doc.setFillColor(180, 180, 180);
    doc.rect(15, y, 1.5, 10, 'F');

    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No chronological milestones recorded for this day.", 22, y + 6.2);
    y += 14;
  }

  // 6. Signature section
  y += 8;
  if (y + 16 > 265) {
    pageNum++;
    doc.addPage();
    initPage(doc, pageNum, date);
    y = 25;
  }

  // Center alignment signature layout
  doc.setDrawColor(212, 93, 67);
  doc.setLineWidth(0.3);
  doc.line(80, y, 130, y);
  y += 5;

  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Every recorded metric paints a stroke on the daily canvas. Consistent journaling charts the course of progress.", 105, y, { align: 'center' });

  // Save/Download Action triggers
  doc.save(`daily_progress_report_${date}.pdf`);
}
