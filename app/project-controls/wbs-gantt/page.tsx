'use client';

/**
 * @fileoverview WBS & Gantt Chart Page for PPC V3 Project Controls.
 * 
 * Main project scheduling visualization with:
 * - Work Breakdown Structure (WBS) hierarchy table
 * - Gantt chart with task bars and dependencies
 * - Critical Path Method (CPM) analysis
 * - Task progress and efficiency tracking
 * - Expandable/collapsible hierarchy navigation
 * - Resource assignment display
 * 
 * Integrates with CPMEngine for schedule calculations.
 * 
 * @module app/project-controls/wbs-gantt/page
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '@/lib/data-context';
import { CPMEngine, CPMTask, CPMResult } from '@/lib/cpm-engine';
import { WBSTableRow } from '@/types/wbs';
import { formatCurrency } from '@/lib/wbs-utils';
import type { Employee } from '@/types/data';
import { supabase } from '@/lib/supabase';
import EnhancedTooltip from '@/components/ui/EnhancedTooltip';
import SearchableDropdown from '@/components/ui/SearchableDropdown';

const WBS_COLORS = {
  portfolio: '#40E0D0',
  customer: '#CDDC39',
  site: '#E91E63',
  project: '#FF9800',
  unit: '#7C4DFF',
  sub_project: '#1A9B8F',
  phase: '#1A9B8F',
  task: '#9E9D24',
  sub_task: '#AD1457',
  milestone: '#FFD700', // Gold for milestones
  critical: '#DC2626'
};

type GanttInterval = 'week' | 'month' | 'quarter' | 'year';

const FolderIcon = () => (
  <svg className="w-4 h-4 text-indigo-400 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
  </svg>
);

const CheckmarkIcon = () => (
  <svg className="w-4 h-4 text-emerald-500 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
);

export default function WBSGanttPage() {
  const { filteredData, updateData, data: fullData, setHierarchyFilter } = useData();
  const fixedColsWidth = 1240;
  const data = filteredData;
  const employees = fullData.employees;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['wbs-1', 'wbs-2', 'wbs-1.1', 'wbs-2.1', 'wbs-1.1.1', 'wbs-2.1.1', 'wbs-1.1.1.1', 'wbs-2.1.1.1']));
  const [cpmResult, setCpmResult] = useState<CPMResult | null>(null);
  const [cpmLogs, setCpmLogs] = useState<string[]>([]);
  const [ganttInterval, setGanttInterval] = useState<GanttInterval>('week');
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const projectOptions = useMemo(() => {
    return (fullData.projects || []).map((p: any) => ({
      id: p.id || p.projectId,
      name: p.name,
      secondary: p.projectId
    }));
  }, [fullData.projects]);

  // Use actual current date
  const today = useMemo(() => new Date(), []);

  // Calculate date range from data with 5 column buffer
  const { projectStart, projectEnd } = useMemo(() => {
    const allStartDates: number[] = [];
    const allEndDates: number[] = [];

    const collectDates = (items: any[]) => {
      items.forEach(item => {
        if (item.startDate) allStartDates.push(new Date(item.startDate).getTime());
        if (item.endDate) allEndDates.push(new Date(item.endDate).getTime());
        if (item.children) collectDates(item.children);
      });
    };

    if (data.wbsData?.items) collectDates(data.wbsData.items);

    // Default to today if no dates found, ensuring today is always included
    const todayTime = new Date().getTime();
    if (allStartDates.length === 0) allStartDates.push(todayTime);
    if (allEndDates.length === 0) allEndDates.push(todayTime);

    // Force range to include today
    // checking vs todayTime ensures strict inclusion
    const minTime = Math.min(...allStartDates, todayTime);
    const maxTime = Math.max(...allEndDates, todayTime);

    return {
      projectStart: new Date(minTime),
      projectEnd: new Date(maxTime)
    };
  }, [data.wbsData?.items]);

  // Generate Date Columns based on interval with 5 column buffer
  const dateColumns = useMemo(() => {
    const columns: { start: Date; end: Date; label: string }[] = [];

    // Add buffer columns before start
    const bufferStart = new Date(projectStart);
    const bufferEnd = new Date(projectEnd);

    let current = new Date(bufferStart);

    // Calculate buffer based on interval (5 columns)
    const bufferPeriods = 5;

    switch (ganttInterval) {
      case 'week': {
        // Move start back 5 weeks
        bufferStart.setDate(bufferStart.getDate() - (7 * bufferPeriods));
        // Move end forward 5 weeks
        bufferEnd.setDate(bufferEnd.getDate() + (7 * bufferPeriods));

        // Start on Monday
        const day = current.getDay();
        const diff = current.getDate() - day + (day === 0 ? -6 : 1);
        current = new Date(current.setDate(diff));
        current.setDate(current.getDate() - (7 * bufferPeriods));

        while (current <= bufferEnd) {
          const end = new Date(current);
          end.setDate(end.getDate() + 6);
          columns.push({
            start: new Date(current),
            end,
            label: `${current.getMonth() + 1}/${current.getDate()}`
          });
          current.setDate(current.getDate() + 7);
        }
        break;
      }
      case 'month': {
        // Move start back 5 months
        bufferStart.setMonth(bufferStart.getMonth() - bufferPeriods);
        // Move end forward 5 months
        bufferEnd.setMonth(bufferEnd.getMonth() + bufferPeriods);

        current = new Date(bufferStart.getFullYear(), bufferStart.getMonth(), 1);
        while (current <= bufferEnd) {
          const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
          columns.push({
            start: new Date(current),
            end,
            label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          });
          current.setMonth(current.getMonth() + 1);
        }
        break;
      }
      case 'quarter': {
        // Move start back 5 quarters
        bufferStart.setMonth(bufferStart.getMonth() - (3 * bufferPeriods));
        // Move end forward 5 quarters
        bufferEnd.setMonth(bufferEnd.getMonth() + (3 * bufferPeriods));

        const startQuarter = Math.floor(bufferStart.getMonth() / 3);
        current = new Date(bufferStart.getFullYear(), startQuarter * 3, 1);
        while (current <= bufferEnd) {
          const quarterNum = Math.floor(current.getMonth() / 3) + 1;
          const end = new Date(current.getFullYear(), current.getMonth() + 3, 0);
          columns.push({
            start: new Date(current),
            end,
            label: `Q${quarterNum} ${current.getFullYear().toString().slice(-2)}`
          });
          current.setMonth(current.getMonth() + 3);
        }
        break;
      }
      case 'year': {
        // Move start back 5 years
        bufferStart.setFullYear(bufferStart.getFullYear() - bufferPeriods);
        // Move end forward 5 years
        bufferEnd.setFullYear(bufferEnd.getFullYear() + bufferPeriods);

        current = new Date(bufferStart.getFullYear(), 0, 1);
        while (current <= bufferEnd) {
          const end = new Date(current.getFullYear(), 11, 31);
          columns.push({
            start: new Date(current),
            end,
            label: current.getFullYear().toString()
          });
          current.setFullYear(current.getFullYear() + 1);
        }
        break;
      }
    }
    return columns;
  }, [ganttInterval, projectStart, projectEnd]);

  // Get column width based on interval
  const columnWidth = useMemo(() => {
    switch (ganttInterval) {
      case 'week': return 40;
      case 'month': return 80;
      case 'quarter': return 120;
      case 'year': return 200;
      default: return 40;
    }
  }, [ganttInterval]);

  // Find the "today" column index
  const todayColumnIndex = useMemo(() => {
    return dateColumns.findIndex(col => today >= col.start && today <= col.end);
  }, [dateColumns, today]);

  // Scroll to today - centers today column in the view
  const scrollToToday = () => {
    if (!containerRef.current || todayColumnIndex < 0) {
      console.warn('Today button: Column not found or container missing', { todayColumnIndex });
      return;
    }

    const stickyColsWidth = 300; // WBS Code + Name that stay sticky
    const viewportWidth = containerRef.current.clientWidth;

    // Calculate the x position of today column relative to the start of date columns
    const todayPositionInGantt = todayColumnIndex * columnWidth;

    // Scroll to center today column (account for sticky columns taking up space)
    // The date columns start at exactly fixedColsWidth px from table left 0
    const targetScrollX = fixedColsWidth - stickyColsWidth + todayPositionInGantt - (viewportWidth - stickyColsWidth) / 2 + columnWidth / 2;

    console.log('Today button scroll:', {
      todayColumnIndex,
      columnWidth,
      todayPositionInGantt,
      fixedColsWidth,
      stickyColsWidth,
      viewportWidth,
      targetScrollX
    });

    containerRef.current.scrollTo({
      left: Math.max(0, targetScrollX),
      behavior: 'smooth'
    });
  };

  // Expand All - collect all IDs with children
  const expandAll = () => {
    const allIds = new Set<string>();

    const collectIds = (items: any[]) => {
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          allIds.add(item.id);
          collectIds(item.children);
        }
      });
    };

    if (data.wbsData?.items) collectIds(data.wbsData.items);
    setExpandedIds(allIds);
  };

  // Collapse All
  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Flatten WBS for table
  const flatRows = useMemo(() => {
    const rows: WBSTableRow[] = [];
    let rowIndex = 0;

    const processItem = (item: any, level: number) => {
      const isExpanded = expandedIds.has(item.id);
      const hasChildren = item.children && item.children.length > 0;
      const itemType = item.itemType || item.type || 'task';

      rows.push({
        ...item,
        itemType,
        level,
        indentLevel: item._outlineLevel ? item._outlineLevel - 1 : level - 1,
        hasChildren: hasChildren || false,
        isExpanded: isExpanded || false,
        rowIndex: rowIndex++,
        isVisible: true
      });

      if (hasChildren && isExpanded) {
        item.children.forEach((child: any) => processItem(child, level + 1));
      }
    };

    if (data.wbsData?.items) {
      data.wbsData.items.forEach(item => processItem(item, 1));
    }
    return rows;
  }, [data.wbsData?.items, expandedIds]);

  // Run CPM Analysis
  const runCPM = () => {
    const engine = new CPMEngine();
    const tasks: Partial<CPMTask>[] = [];

    const collectTasks = (items: any[]) => {
      items.forEach(item => {
        if (!item.children || item.children.length === 0) {
          tasks.push({
            id: item.id,
            name: item.name,
            wbsCode: item.wbsCode,
            daysRequired: (item.is_milestone || item.isMilestone) ? 0 : (item.daysRequired || 1),
            predecessors: item.predecessors || []
          });
        } else {
          collectTasks(item.children);
        }
      });
    };

    if (data.wbsData?.items) {
      collectTasks(data.wbsData.items);
    }

    engine.loadTasks(tasks as any);
    const result = engine.calculate();
    setCpmResult(result);

    // Update global state with CPM results
    const updateItems = (items: any[]): any[] => {
      return items.map(item => {
        const cpmTask = result.tasks.find(t => t.id === item.id);
        const newItem = { ...item };
        if (cpmTask) {
          newItem.isCritical = cpmTask.isCritical;
          newItem.earlyStart = cpmTask.earlyStart;
          newItem.earlyFinish = cpmTask.earlyFinish;
          newItem.lateStart = cpmTask.lateStart;
          newItem.lateFinish = cpmTask.lateFinish;
          newItem.totalFloat = cpmTask.totalFloat;
        }

        if (newItem.children) {
          newItem.children = updateItems(newItem.children);
          // Rollup: Summary is critical if any child is critical
          newItem.isCritical = newItem.children.some((c: any) => c.isCritical);
          // Rollup: Summary float is min of children
          newItem.totalFloat = Math.min(...newItem.children.map((c: any) => c.totalFloat ?? Infinity));
          if (newItem.totalFloat === Infinity) newItem.totalFloat = 0;
        }
        return newItem;
      });
    };

    if (data.wbsData?.items) {
      const logs: string[] = [];
      const startTime = performance.now();

      logs.push(`[${new Date().toLocaleTimeString()}] Engine Initialized`);
      logs.push(`> Loading ${tasks.length} tasks...`);
      const tasksWithPreds = tasks.filter(t => t.predecessors && t.predecessors.length > 0).length;
      logs.push(`> ${tasksWithPreds} tasks have predecessor links`);

      const updated = updateItems(data.wbsData.items);
      updateData({ wbsData: { ...data.wbsData, items: updated } });

      const endTime = performance.now();
      logs.push(`> Calculation took ${(endTime - startTime).toFixed(2)}ms`);

      logs.push(`----------------------------------------`);

      // Fallback Duration Logic
      let displayDuration = result.projectDuration;
      let durationSource = 'Logic';

      if (result.projectDuration <= 1 && tasksWithPreds === 0) {
        // Fallback to Dates
        const start = projectStart.getTime();
        const end = projectEnd.getTime();
        if (start && end && end > start) {
          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          displayDuration = diffDays;
          durationSource = 'Dates (No Logic)';
          logs.push(`! NOTE: Using project dates for duration (no logic links active)`);

          // Update result for display
          result.projectDuration = displayDuration;
        }
      }

      logs.push(`RESULTS SUMMARY:`);
      logs.push(`• Duration: ${displayDuration} days (${durationSource})`);
      logs.push(`• Critical Path: ${result.stats.criticalTasksCount} tasks identified`);

      if (result.stats.danglingTasks && result.stats.danglingTasks.length > 0) {
        logs.push(`! WARNING: ${result.stats.danglingTasks.length} tasks have open ends (dangling logic)`);
        // List first 3 dangling
        result.stats.danglingTasks.slice(0, 3).forEach(id => {
          const tName = tasks.find(t => t.id === id)?.name || id;
          logs.push(`  - Unlinked: ${tName}`);
        });
      }

      logs.push(`• Average Float: ${result.stats.averageFloat.toFixed(1)} days`);
      setCpmLogs(logs);

      // Save logs to database asynchronously
      (async () => {
        try {
          // Get current user for the log (optional if auth enabled)
          const { data: { session } } = await supabase.auth.getSession();

          await supabase.from('engine_logs').insert({
            execution_time_ms: endTime - startTime,
            project_duration_days: displayDuration,
            critical_path_count: result.stats.criticalTasksCount,
            logs: logs,
            user_id: session?.user?.id
          });
        } catch (err) {
          console.error('Failed to save engine logs:', err);
        }
      })();
    }
  };

  // Draw Predecessor Arrows using Math (No DOM access)
  useEffect(() => {
    const drawArrows = () => {
      if (!svgRef.current || flatRows.length === 0 || dateColumns.length === 0) return;

      const svg = svgRef.current;
      const timelineStart = dateColumns[0].start.getTime();
      const timelineEnd = dateColumns[dateColumns.length - 1].end.getTime();
      const totalDuration = timelineEnd - timelineStart;
      const timelinePixelWidth = dateColumns.length * columnWidth;

      // Map taskId to Row Index for fast Y lookup
      const taskRowIndex = new Map(flatRows.map((r, i) => [r.id, i]));

      // Clear existing paths
      const children = Array.from(svg.children);
      children.forEach(child => {
        if (child.nodeName !== 'defs') svg.removeChild(child);
      });

      // Set SVG Size
      svg.style.width = `${fixedColsWidth + timelinePixelWidth}px`;
      svg.style.height = `${flatRows.length * 30}px`;

      // Only draw arrows for visible rows or rows connected to visible rows? 
      // For simplicity and correctness, drawing all is safer as long as calculation is fast.
      // Math calculation for 2000 rows is instant.

      flatRows.forEach((item, index) => {
        if (!item.predecessors || item.predecessors.length === 0) return;
        if (!item.startDate) return;

        const targetRowIndex = index;
        const targetY = 36 + (targetRowIndex * 30) + (30 / 2);

        // Target X (Start of task bar)
        const targetStart = new Date(item.startDate).getTime();
        if (targetStart < timelineStart) return; // Optimization: Don't draw if target starts before timeline? Actually maybe we should.

        const targetHeadOffset = Math.max(0, targetStart - timelineStart);
        const targetLeftPct = targetHeadOffset / totalDuration;
        const targetX = fixedColsWidth + (targetLeftPct * timelinePixelWidth);

        item.predecessors.forEach((pred: any) => {
          const sourceRowIndex = taskRowIndex.get(pred.taskId);
          if (sourceRowIndex === undefined) return; // Source not in visible hierarchy

          const sourceItem = flatRows[sourceRowIndex];
          if (!sourceItem.endDate) return;

          const sourceY = 36 + (sourceRowIndex * 30) + (30 / 2);

          // Source X (End of task bar)
          const sourceEnd = new Date(sourceItem.endDate).getTime();
          const sourceTailOffset = Math.max(0, Math.min(timelineEnd, sourceEnd) - timelineStart);
          const sourceRightPct = sourceTailOffset / totalDuration;
          const sourceX = fixedColsWidth + (sourceRightPct * timelinePixelWidth);

          // Don't draw if completely off-screen (both outside viewport)? 
          // We'll trust browser clipping, but we can optimize.
          // Let's just draw.

          // Path Logic
          const dist = Math.abs(targetX - sourceX);
          const cpOffset = Math.max(dist * 0.5, 20);

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

          // Simple Bezier
          // Start at Source Right, End at Target Left
          const d = `M${sourceX},${sourceY} C${sourceX + cpOffset},${sourceY} ${targetX - cpOffset},${targetY} ${targetX},${targetY}`;

          path.setAttribute('d', d);
          path.setAttribute('stroke', item.isCritical ? '#DC2626' : '#40E0D0');
          path.setAttribute('stroke-width', item.isCritical ? '1.5' : '1');
          path.setAttribute('fill', 'none');
          path.setAttribute('marker-end', 'url(#arrowhead)');
          path.setAttribute('opacity', '0.5');

          svg.appendChild(path);
        });
      });
    };

    // Draw immediately and on resize/data change
    requestAnimationFrame(drawArrows);

  }, [flatRows, dateColumns, columnWidth, fixedColsWidth]); // Depend on totalRowsHeight/flatRows to redraw

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  return (
    <div className="page-panel full-height-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">WBS & Gantt Chart</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Interval Selector */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '2px' }}>
            {(['week', 'month', 'quarter', 'year'] as GanttInterval[]).map(interval => (
              <button
                key={interval}
                onClick={() => setGanttInterval(interval)}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background: ganttInterval === interval ? 'var(--pinnacle-teal)' : 'transparent',
                  color: ganttInterval === interval ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize'
                }}
              >
                {interval}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={scrollToToday}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12,6 12,12 16,14"></polyline>
            </svg>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={collapseAll}>Collapse All</button>
          <button className="btn btn-secondary btn-sm" onClick={expandAll}>Expand All</button>
          <div style={{ width: '200px' }}>
            <SearchableDropdown
              options={projectOptions}
              placeholder="Select Project for CPM..."
              disabled={false}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={runCPM}>Run CPM Analysis</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0 1.5rem 0.5rem', fontSize: '0.7rem', color: '#888' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }}></div> 0-25%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#f97316', borderRadius: 2 }}></div> 25-50%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#eab308', borderRadius: 2 }}></div> 50-75%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#22c55e', borderRadius: 2 }}></div> 75-100%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '1rem' }}><div style={{ width: 12, height: 12, border: '2px solid #ef4444' }}></div> Critical Path</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 2, height: 12, background: '#ef4444', borderLeft: '1px dashed #ef4444' }}></div> Milestone</div>
      </div>

      {cpmResult && (
        <div style={{
          position: 'relative',
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          alignItems: 'stretch',
          width: 'calc(100% - 3rem)',
          margin: '0 1.5rem 1rem',
          background: 'rgba(20, 20, 25, 0.95)',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          height: '110px' // Fixed height
        }}>
          <button
            onClick={() => { setCpmResult(null); setCpmLogs([]); }}
            className="btn-icon"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              color: '#fff',
              cursor: 'pointer',
              zIndex: 20,
              padding: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%',
              border: 'none',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close Analysis"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <div className="metrics-row-compact" style={{ margin: 0, gap: '1rem', display: 'flex', flex: '0 0 auto', alignItems: 'center' }}>
            <div className="metric-card" style={{ width: '140px', padding: '10px 16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#111' }}>
              <div className="metric-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Duration</div>
              <div className="metric-value" style={{ fontSize: '1.4rem', lineHeight: 1 }}>{cpmResult.projectDuration} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>d</span></div>
            </div>
            <div className="metric-card accent-pink" style={{ width: '140px', padding: '10px 16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#111' }}>
              <div className="metric-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Critical Tasks</div>
              <div className="metric-value" style={{ fontSize: '1.4rem', lineHeight: 1 }}>{cpmResult.stats.criticalTasksCount}</div>
            </div>
            <div className="metric-card accent-lime" style={{ width: '140px', padding: '10px 16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#111' }}>
              <div className="metric-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Avg Float</div>
              <div className="metric-value" style={{ fontSize: '1.4rem', lineHeight: 1 }}>{cpmResult.stats.averageFloat.toFixed(1)} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>d</span></div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.7rem',
              color: '#aaa',
              lineHeight: '1.6',
              padding: '12px'
            }}>
              {cpmLogs.length === 0 ? <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Ready to analyze...</span> : cpmLogs.map((log, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '2px', marginBottom: '2px' }}>
                  {log.startsWith('>') ? <span style={{ color: '#40E0D0' }}>{log.substring(0, 2)}</span> : null}
                  {log.startsWith('>') ? log.substring(2) : log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="chart-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          className="chart-card-body no-padding"
          style={{ flex: 1, overflow: 'auto', position: 'relative' }}
          ref={containerRef}
        >
          {/* SVG Overlay for Arrows */}
          <svg
            ref={svgRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '10000px',
              height: '10000px',
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
              </marker>
            </defs>
          </svg>

          <div className="wbs-table" ref={tableRef} style={{ overflowY: 'auto', position: 'relative' }}>
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2 text-slate-400 font-medium">ID</th>
                  <th className="px-3 py-2 text-slate-400 font-medium w-full">Task Name</th>
                  <th className="px-3 py-2 text-slate-400 font-medium text-right">%</th>
                  <th className="px-3 py-2 text-slate-400 font-medium text-right">Dur (h)</th>
                  <th className="px-3 py-2 text-slate-400 font-medium">Start</th>
                  <th className="px-3 py-2 text-slate-400 font-medium">Finish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {flatRows.map((item, index) => {
                  const indent = item.depth * 20;
                  const rowClass = item.isSummary ? 'bg-slate-800/30 font-semibold text-slate-200' : 'text-slate-400 hover:bg-slate-800/50';
                  const startDate = item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '';
                  const endDate = item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '';
                  const duration = item.projectedHours ? Math.round(item.projectedHours) : '-';
                  const percentComplete = item.percentComplete ? Math.round(item.percentComplete) + '%' : '0%';

                  return (
                    <tr key={item.id} className={`${rowClass} border-b border-slate-800 transition-colors`}>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{item.id}</td>
                      <td className="px-3 py-2">
                        <div style={{ paddingLeft: `${indent}px` }} className="flex items-center">
                          {item.isSummary ? <FolderIcon /> : <CheckmarkIcon />}
                          <span className="truncate">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">{percentComplete}</td>
                      <td className="px-3 py-2 text-right text-xs font-mono">{duration}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{startDate}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{endDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
