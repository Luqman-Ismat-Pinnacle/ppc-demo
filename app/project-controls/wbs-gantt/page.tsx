'use client';

/**
 * @fileoverview WBS & Gantt Chart Page for PPC V3 Project Controls.
 * 
 * Rewritten from scratch combining:
 * - Working flat list hierarchy from commit 694c6bf
 * - Best features from original commit dbb83c5e
 * - Exact MPP parser UI hierarchy matching
 * 
 * @module app/project-controls/wbs-gantt/page
 */

import React, { useState, useMemo, useRef } from 'react';
import { useData } from '@/lib/data-context';
import { CPMEngine, CPMTask, CPMResult } from '@/lib/cpm-engine';

// Helper to get employee name from ID
const getEmployeeName = (resourceId: string | undefined, employees: any[]): string => {
  if (!resourceId) return '-';
  const employee = employees.find(e => e.employeeId === resourceId);
  return employee?.name?.split(' ')[0] || resourceId;
};

// Helper to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

type GanttInterval = 'week' | 'month' | 'quarter' | 'year';

export default function WBSGanttPage() {
  const { filteredData, data: fullData } = useData();
  const data = filteredData;
  const employees = fullData.employees;
  const [cpmResult, setCpmResult] = useState<CPMResult | null>(null);
  const [cpmLogs, setCpmLogs] = useState<string[]>([]);
  const [ganttInterval, setGanttInterval] = useState<GanttInterval>('week');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const projectOptions = useMemo(() => {
    return (fullData.projects || []).map((p: any) => ({
      id: p.id || p.projectId,
      name: p.name,
      secondary: p.projectId
    }));
  }, [fullData.projects]);

  // Use actual current date
  const today = useMemo(() => new Date(), []);

  // Calculate date range from data
  const { projectStart, projectEnd } = useMemo(() => {
    const allStartDates: number[] = [];
    const allEndDates: number[] = [];

    // Collect dates from all tasks
    if (data.wbsData?.items) {
      const collectDates = (items: any[]) => {
        items.forEach(item => {
          if (item.startDate) allStartDates.push(new Date(item.startDate).getTime());
          if (item.endDate) allEndDates.push(new Date(item.endDate).getTime());
          if (item.children) collectDates(item.children);
        });
      };
      collectDates(data.wbsData.items);
    }

    const earliest = allStartDates.length > 0 ? new Date(Math.min(...allStartDates)) : new Date();
    const latest = allEndDates.length > 0 ? new Date(Math.max(...allEndDates)) : new Date();

    // Add buffer
    const bufferedStart = new Date(earliest);
    bufferedStart.setDate(bufferedStart.getDate() - 14);
    const bufferedEnd = new Date(latest);
    bufferedEnd.setDate(bufferedEnd.getDate() + 30);

    return {
      projectStart: bufferedStart,
      projectEnd: bufferedEnd
    };
  }, [data.wbsData]);

  // Generate date columns based on interval
  const dateColumns = useMemo(() => {
    const columns = [];
    const current = new Date(projectStart);

    while (current <= projectEnd) {
      const columnStart = new Date(current);
      let columnEnd: Date;

      switch (ganttInterval) {
        case 'week':
          columnEnd = new Date(current);
          columnEnd.setDate(columnEnd.getDate() + 6);
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          columnEnd = new Date(current);
          columnEnd.setMonth(columnEnd.getMonth() + 1);
          columnEnd.setDate(columnEnd.getDate() - 1);
          current.setMonth(current.getMonth() + 1);
          current.setDate(1);
          break;
        case 'quarter':
          columnEnd = new Date(current);
          columnEnd.setMonth(columnEnd.getMonth() + 3);
          columnEnd.setDate(columnEnd.getDate() - 1);
          current.setMonth(current.getMonth() + 3);
          current.setDate(1);
          break;
        case 'year':
          columnEnd = new Date(current);
          columnEnd.setFullYear(columnEnd.getFullYear() + 1);
          columnEnd.setDate(columnEnd.getDate() - 1);
          current.setFullYear(current.getFullYear() + 1);
          current.setDate(1);
          break;
        default:
          columnEnd = new Date(current);
          columnEnd.setDate(columnEnd.getDate() + 6);
          current.setDate(current.getDate() + 7);
      }

      columns.push({
        start: columnStart,
        end: columnEnd,
        label: columnStart.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          ...(ganttInterval === 'month' || ganttInterval === 'quarter' || ganttInterval === 'year' ? { year: 'numeric' } : {})
        })
      });
    }

    return columns;
  }, [projectStart, projectEnd, ganttInterval]);

  // Column width for Gantt chart
  const columnWidth = ganttInterval === 'week' ? 40 : ganttInterval === 'month' ? 60 : ganttInterval === 'quarter' ? 80 : 100;

  // CRITICAL: Flatten WBS data exactly like parser UI - simple flat list with outline_level
  const flatTasks = useMemo(() => {
    if (!data.wbsData?.items) return [];

    const tasks: any[] = [];

    // DEBUG: Let's see what we're actually getting
    console.log('=== WBS DATA DEBUG ===');
    console.log('WBS Data Items:', data.wbsData.items);
    if (data.wbsData.items.length > 0) {
      console.log('First item structure:', data.wbsData.items[0]);
      console.log('First item outline levels:', {
        _outlineLevel: data.wbsData.items[0]._outlineLevel,
        outline_level: data.wbsData.items[0].outline_level,
        outlineLevel: data.wbsData.items[0].outlineLevel
      });
    }

    // Recursive function to flatten hierarchy while preserving outline_level
    const flattenItems = (items: any[], parentLevel = 0) => {
      items.forEach(item => {
        // DEBUG: Log each item
        console.log('Processing item:', {
          id: item.id,
          name: item.name,
          _outlineLevel: item._outlineLevel,
          outline_level: item.outline_level,
          outlineLevel: item.outlineLevel,
          isSummary: item.isSummary,
          is_summary: item.is_summary
        });

        // Use outline_level from MPP parser, or calculate from hierarchy
        const outlineLevel = item._outlineLevel || item.outline_level || item.outlineLevel || parentLevel + 1;
        
        // Create flat task item exactly like parser UI
        const flatTask = {
          id: item.id,
          name: item.name,
          outline_level: outlineLevel, // CRITICAL: Use exact outline_level from parser
          is_summary: item.isSummary || item.is_summary || false,
          startDate: item.startDate,
          endDate: item.endDate,
          projectedHours: item.baselineHours || item.projectedHours || 0,
          actualHours: item.actualHours || 0,
          baselineCost: item.baselineCost || 0,
          actualCost: item.actualCost || 0,
          percentComplete: item.percentComplete || 0,
          assignedResource: item.assignedResourceId ? getEmployeeName(item.assignedResourceId, employees) : '',
          isCritical: item.isCritical || false,
          wbsCode: item.wbsCode || '',
          daysRequired: item.daysRequired || 1,
          taskEfficiency: item.taskEfficiency || 0,
          predecessors: item.predecessors || [],
          totalFloat: item.totalFloat || 0
        };

        // DEBUG: Log the flat task
        console.log('Flat task created:', {
          id: flatTask.id,
          name: flatTask.name,
          outline_level: flatTask.outline_level,
          indent: (flatTask.outline_level - 1) * 12
        });

        tasks.push(flatTask);

        // Recursively process children
        if (item.children && item.children.length > 0) {
          flattenItems(item.children, outlineLevel);
        }
      });
    };

    flattenItems(data.wbsData.items);
    
    // DEBUG: Log final result
    console.log('Final flatTasks count:', tasks.length);
    console.log('Sample flatTasks:', tasks.slice(0, 3));
    console.log('=== END DEBUG ===');
    
    return tasks;
  }, [data.wbsData, employees]);

  // Run CPM analysis
  const runCPM = () => {
    if (!flatTasks.length) return;

    try {
      // Convert flat tasks to CPM format
      const cpmTasks: CPMTask[] = flatTasks.map(task => ({
        id: task.id,
        name: task.name,
        duration: Math.max(1, Math.round((task.projectedHours || 0) / 8)), // Convert hours to days
        earlyStart: 0,
        earlyFinish: 0,
        lateStart: 0,
        lateFinish: 0,
        slack: 0,
        isCritical: false,
        predecessors: []
      }));

      const engine = new CPMEngine();
      const result = engine.calculateCriticalPath(cpmTasks);
      setCpmResult(result);
      setCpmLogs(engine.getLogs());

    } catch (error) {
      console.error('CPM calculation failed:', error);
      setCpmLogs(['CPM calculation failed: ' + (error as Error).message]);
    }
  };

  // Calculate task position in Gantt chart
  const getTaskPosition = (task: any) => {
    if (!task.startDate || !task.endDate) return { left: 0, width: 0 };

    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    
    // Calculate position relative to project start
    const daysFromStart = Math.max(0, (taskStart.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
    const taskDuration = Math.max(1, (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));

    // Convert to pixels based on interval
    let left = 0;
    let width = 0;

    if (ganttInterval === 'week') {
      left = (daysFromStart / 7) * columnWidth;
      width = (taskDuration / 7) * columnWidth;
    } else if (ganttInterval === 'month') {
      left = (daysFromStart / 30) * columnWidth;
      width = (taskDuration / 30) * columnWidth;
    } else if (ganttInterval === 'quarter') {
      left = (daysFromStart / 90) * columnWidth;
      width = (taskDuration / 90) * columnWidth;
    } else {
      left = (daysFromStart / 365) * columnWidth;
      width = (taskDuration / 365) * columnWidth;
    }

    return { left: Math.max(0, left), width: Math.max(2, width) };
  };

  // Render task bar
  const renderTaskBar = (task: any) => {
    const { left, width } = getTaskPosition(task);
    const isCritical = task.isCritical;
    const isSummary = task.is_summary;
    const percentComplete = task.percentComplete || 0;

    // Progress color based on percentage
    const getProgressColor = (pct: number) => {
      if (pct >= 100) return '#22c55e';
      if (pct >= 75) return '#22c55e';
      if (pct >= 50) return '#eab308';
      if (pct >= 25) return '#f97316';
      return '#ef4444';
    };

    const progressColor = getProgressColor(percentComplete);

    return (
      <div
        style={{
          position: 'absolute',
          left: `${left}px`,
          width: `${width}px`,
          height: '18px',
          top: '6px',
          background: isSummary ? 'transparent' : '#333',
          borderRadius: '3px',
          zIndex: 5,
          border: isCritical ? '2px solid #ef4444' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          pointerEvents: 'auto'
        }}
        title={`${task.name}${isSummary ? ' (Summary)' : ''}\n${task.startDate} - ${task.endDate}\nProgress: ${percentComplete}%\nTotal Float: ${task.totalFloat || '-'} days${task.taskEfficiency ? `\nEfficiency: ${Math.round(task.taskEfficiency)}%` : ''}`}
      >
        {/* Progress Fill */}
        {!isSummary && (
          <div style={{
            width: `${percentComplete}%`,
            height: '100%',
            background: progressColor,
            borderRadius: '3px',
            transition: 'width 0.3s'
          }} />
        )}

        {/* Milestone Marker */}
        {isSummary && (
          <div style={{
            width: '4px',
            height: '100%',
            background: '#ef4444',
            borderRadius: '0',
            marginLeft: '-2px'
          }} />
        )}

        {/* Label */}
        <span style={{
          marginLeft: isSummary ? '8px' : 'calc(100% + 8px)',
          whiteSpace: 'nowrap',
          fontSize: '0.65rem',
          color: '#aaa',
          position: 'absolute',
          left: isSummary ? '0' : '0'
        }}>
          {task.name}
        </span>
      </div>
    );
  };

  // Find today column for scrolling
  const todayColumnIndex = useMemo(() => {
    return dateColumns.findIndex(col => today >= col.start && today <= col.end);
  }, [dateColumns, today]);

  // Scroll to today
  const scrollToToday = () => {
    if (!containerRef.current || todayColumnIndex < 0) return;

    const stickyColsWidth = 1240; // Fixed columns width
    const viewportWidth = containerRef.current.clientWidth;
    const todayPositionInGantt = todayColumnIndex * columnWidth;
    const targetScrollX = stickyColsWidth + todayPositionInGantt - (viewportWidth - stickyColsWidth) / 2 + columnWidth / 2;

    containerRef.current.scrollTo({
      left: Math.max(0, targetScrollX),
      behavior: 'smooth'
    });
  };

  return (
    <div className="page-panel">
      <div className="page-header">
        <div>
          <h1 className="page-title">WBS Gantt Chart</h1>
          <p className="page-description">Work Breakdown Structure with Gantt visualization</p>
        </div>
        <div className="header-actions">
          <select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="form-select"
            style={{ width: '200px' }}
          >
            <option value="">All Projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={ganttInterval}
            onChange={(e) => setGanttInterval(e.target.value as GanttInterval)}
            className="form-select"
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
          <button onClick={runCPM} className="btn btn-primary">
            Run CPM Analysis
          </button>
          <button onClick={scrollToToday} className="btn btn-secondary">
            Today
          </button>
        </div>
      </div>

      {/* DEBUG INFO - Display on page */}
      <div className="card" style={{ marginBottom: '1rem', backgroundColor: '#f8f8f8' }}>
        <div className="card-header">
          <h3>Debug Information</h3>
        </div>
        <div className="card-body" style={{ maxHeight: '600px', overflow: 'auto' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', color: '#000' }}>
            <strong>WBS Data Items Count:</strong> {data.wbsData?.items?.length || 0}
            <br />
            <strong>Flat Tasks Count:</strong> {flatTasks.length}
            <br />
            <strong>Sample Tasks:</strong>
            <br />
            {flatTasks.slice(0, 5).map((task, index) => (
              <div key={index} style={{ marginLeft: '20px', color: '#000' }}>
                Task {index + 1}: {task.name} (Level: {task.outline_level}, Indent: {(task.outline_level - 1) * 24}px)
              </div>
            ))}
            <br />
            <strong>MPP Parser Raw Data:</strong>
            <br />
            <div style={{ marginLeft: '20px', fontSize: '10px', color: '#000' }}>
              {(() => {
                // Try to get raw MPP data from the data context
                const rawTasks = fullData.tasks || [];
                const projectTasks = rawTasks.filter((task: any) => 
                  task.projectId === 'PRJ_MPP_1769645081486' || 
                  task.projectId === (data.wbsData?.items?.[0]?.id?.replace('wbs-project-', ''))
                );
                
                if (projectTasks.length === 0) {
                  return 'No raw MPP data available in context';
                }
                
                const summaryTasks = projectTasks.filter((t: any) => t.isSummary || t.is_summary);
                
                return (
                  <div>
                    <div style={{ marginBottom: '10px', color: '#000' }}>
                      <strong>Total Tasks:</strong> {projectTasks.length}
                      <br />
                      <strong>Summary Tasks Count:</strong> {summaryTasks.length}
                    </div>
                    <div style={{ marginBottom: '10px', color: '#000' }}>
                      <strong>Summary Tasks:</strong>
                      <br />
                      {summaryTasks.length === 0 ? (
                        <span style={{ color: '#d00' }}>No summary tasks found - this is the hierarchy issue!</span>
                      ) : (
                        summaryTasks.slice(0, 10).map((task: any, index: number) => (
                          <div key={index} style={{ marginLeft: '20px', color: '#000' }}>
                            {task.name} (Level: {task.outlineLevel || task.outline_level || 0})
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ color: '#000' }}>
                      <strong>Sample Raw Tasks (first 10):</strong>
                      <br />
                      {JSON.stringify(projectTasks.slice(0, 10).map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        outlineLevel: t.outlineLevel,
                        outline_level: t.outline_level,
                        parentTaskId: t.parentTaskId,
                        parent_id: t.parent_id,
                        isSummary: t.isSummary,
                        is_summary: t.is_summary
                      })), null, 2)}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0 1.5rem 0.5rem', fontSize: '0.7rem', color: '#888' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }}></div> 0-25%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#f97316', borderRadius: 2 }}></div> 25-50%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#eab308', borderRadius: 2 }}></div> 50-75%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 12, background: '#22c55e', borderRadius: 2 }}></div> 75-100%</div>
      </div>

      {/* WBS Table */}
      <div className="card">
        <div className="card-header">
          <h3>Work Breakdown Structure</h3>
        </div>
        <div className="card-body">
          <div style={{ overflowX: 'auto' }}>
            <table className="wbs-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ height: '36px' }}>
                  <th style={{ width: '100px', position: 'sticky', left: 0, top: 0, zIndex: 40, background: 'var(--bg-secondary)', borderRight: '1px solid #444', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    WBS Code
                  </th>
                  <th style={{ width: '300px', position: 'sticky', left: '100px', top: 0, zIndex: 40, background: 'var(--bg-secondary)', borderRight: '1px solid #444', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Name
                  </th>
                  <th style={{ width: '80px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Type
                  </th>
                  <th style={{ width: '100px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Resource
                  </th>
                  <th style={{ width: '80px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Start
                  </th>
                  <th style={{ width: '80px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    End
                  </th>
                  <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Days Required - Estimated working days to complete." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>Days</span>
                  </th>
                  <th style={{ width: '50px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Baseline Hours - Original budgeted hours." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>BL Hrs</span>
                  </th>
                  <th style={{ width: '50px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Actual Hours - Hours logged to date." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>Act Hrs</span>
                  </th>
                  <th style={{ width: '55px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, color: 'var(--pinnacle-teal)', whiteSpace: 'nowrap' }} className="number">
                    <span title="Remaining Hours - Hours left to complete (Baseline - Actual)." style={{ cursor: 'help', borderBottom: '1px dotted var(--pinnacle-teal)' }}>Rem Hrs</span>
                  </th>
                  <th style={{ width: '70px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Baseline Cost - Original budgeted cost (Baseline Hours × Rate)." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>BL Cost</span>
                  </th>
                  <th style={{ width: '70px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Actual Cost - Cost incurred to date (Actual Hours × Rate)." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>Act Cost</span>
                  </th>
                  <th style={{ width: '75px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, color: 'var(--pinnacle-teal)', whiteSpace: 'nowrap' }} className="number">
                    <span title="Remaining Cost - Projected cost to finish (Remaining Hours × Rate)." style={{ cursor: 'help', borderBottom: '1px dotted var(--pinnacle-teal)' }}>Rem Cost</span>
                  </th>
                  <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Efficiency % - Work rate efficiency (Earned / Spent)." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>Eff%</span>
                  </th>
                  <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }} className="number">
                    <span title="Progress - Percentage complete." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>Prog</span>
                  </th>
                  <th style={{ width: '80px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span title="Predecessors - Tasks that must finish before this one starts." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>Pred</span>
                  </th>
                  <th style={{ width: '40px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderRight: '1px solid #444', borderBottom: '1px solid #333', fontWeight: 600, color: '#ff6b6b', whiteSpace: 'nowrap' }} className="number">
                    <span title="Total Float - Days task can delay without delaying project." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>TF</span>
                  </th>
                  <th style={{ width: '30px', position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-secondary)', borderBottom: '1px solid #333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span title="Critical Path - Tasks driving the project end date." style={{ cursor: 'help', borderBottom: '1px dotted #666' }}>CP</span>
                  </th>
                  {/* Gantt Timeline Headers */}
                  {dateColumns.map((col, i) => {
                    const isCurrentPeriod = today >= col.start && today <= col.end;
                    return (
                      <th key={i} style={{
                        width: `${columnWidth}px`,
                        textAlign: 'center',
                        fontSize: '0.6rem',
                        borderLeft: '1px solid #333',
                        backgroundColor: isCurrentPeriod ? 'rgba(64, 224, 208, 0.05)' : 'transparent'
                      }}>
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {flatTasks.map((task, index) => {
                  const isCritical = task.isCritical;
                  const efficiency = task.taskEfficiency || 0;
                  const effColor = efficiency >= 100 ? '#40E0D0' : efficiency >= 90 ? '#CDDC39' : '#F59E0B';
                  const itemColor = isCritical ? '#DC2626' : (task.is_summary ? '#40E0D0' : effColor);

                  // CRITICAL: Use exact same indentation logic as parser UI
                  const level = task.outline_level || 1;
                  const indent = (level - 1) * 24; // Increased to 24px per level for better visibility
                  const isSummary = task.is_summary;

                  // Format dates and values
                  const start = task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-';
                  const end = task.endDate ? new Date(task.endDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-';
                  const projected = task.projectedHours ? Number(task.projectedHours).toFixed(2) : '-';
                  const actual = task.actualHours ? Number(task.actualHours).toFixed(2) : '-';
                  const remHrs = (task.projectedHours && task.actualHours) ? Math.max(0, (task.projectedHours - task.actualHours)).toFixed(2) : '-';
                  const baselineCost = formatCurrency(task.baselineCost || 0);
                  const actualCost = formatCurrency(task.actualCost || 0);
                  const remCost = formatCurrency(Math.max(0, (task.baselineCost || 0) - (task.actualCost || 0)));
                  const pct = task.percentComplete ? Math.round(task.percentComplete) + '%' : '0%';
                  const eff = task.taskEfficiency ? `${Math.round(task.taskEfficiency)}%` : '-';
                  const pred = task.predecessors?.map((p: any) => p.taskId).join(', ') || '-';
                  const tf = task.totalFloat !== undefined && task.totalFloat <= 0 ? 'CP' : '';

                  // Icons exactly like parser UI
                  const icon = isSummary ? (
                    <svg className="w-4 h-4 text-indigo-400 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-emerald-500 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  );

                  return (
                    <tr key={task.id} style={{
                      height: '30px',
                      background: isCritical ? 'rgba(220, 38, 38, 0.05)' : 'var(--bg-primary)'
                    }}>
                      <td style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: isCritical ? '#1a1010' : 'var(--bg-primary)',
                        borderRight: '1px solid #444',
                        boxShadow: isCritical ? 'inset 2px 0 0 #ef4444' : 'none'
                      }}>
                        <div style={{ paddingLeft: `${indent}px`, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: isCritical ? '#ef4444' : 'inherit', fontSize: '0.65rem', fontWeight: isCritical ? 700 : 400 }}>{task.wbsCode}</span>
                        </div>
                      </td>
                      <td style={{
                        position: 'sticky',
                        left: '100px',
                        zIndex: 10,
                        background: isCritical ? '#1a1010' : 'var(--bg-primary)',
                        borderRight: '1px solid #444',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        <span title={task.name || ''} style={{ fontWeight: isSummary || isCritical ? 700 : 400, fontSize: '0.7rem', color: isCritical ? '#ef4444' : 'inherit', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {icon}
                          {task.name}
                        </span>
                      </td>
                      <td><span className={`type-badge ${task.is_summary ? 'summary' : 'task'}`} style={{ fontSize: '0.5rem' }}>{isSummary ? 'Summary' : 'Task'}</span></td>
                      <td style={{ fontSize: '0.65rem' }}>{task.assignedResource}</td>
                      <td style={{ fontSize: '0.65rem' }}>{start}</td>
                      <td style={{ fontSize: '0.65rem' }}>{end}</td>
                      <td className="number" style={{ fontSize: '0.65rem' }}>{task.daysRequired !== undefined && task.daysRequired !== null ? Number(task.daysRequired).toFixed(2) : '-'}</td>
                      <td className="number" style={{ fontSize: '0.65rem' }}>{projected}</td>
                      <td className="number" style={{ fontSize: '0.65rem' }}>{actual}</td>
                      <td className="number" style={{ fontSize: '0.65rem', color: 'var(--pinnacle-teal)' }}>{remHrs}</td>
                      <td className="number" style={{ fontSize: '0.65rem' }}>{baselineCost}</td>
                      <td className="number" style={{ fontSize: '0.65rem' }}>{actualCost}</td>
                      <td className="number" style={{ fontSize: '0.65rem', color: 'var(--pinnacle-teal)' }}>{remCost}</td>
                      <td className="number" style={{ fontSize: '0.65rem' }}>{eff}</td>
                      <td>
                        <div className="progress-bar" style={{ width: '25px', height: '6px' }}>
                          <div className="progress-bar-fill" style={{ width: `${task.percentComplete || 0}%`, background: itemColor }}></div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.55rem' }} title={pred || ''}>{pred}</td>
                      <td style={{ textAlign: 'center' }}>
                        {tf && <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.65rem' }}>{tf}</span>}
                      </td>

                      {/* Gantt Timeline Cells */}
                      {dateColumns.map((col, i) => {
                        const isCurrentPeriod = today >= col.start && today <= col.end;
                        const cellBg = isCurrentPeriod ? 'rgba(64, 224, 208, 0.05)' : 'transparent';
                        
                        // Render the continuous bar container ONLY in the first cell
                        const content = (() => {
                          if (i === 0 && task.startDate && task.endDate) {
                            return renderTaskBar(task);
                          }
                          return null;
                        })();

                        return (
                          <td key={i} style={{ borderLeft: '1px solid #222', background: cellBg, position: 'relative', padding: 0, overflow: i === 0 ? 'visible' : 'hidden' }}>
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CPM Results */}
      {cpmResult && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3>Critical Path Analysis Results</h3>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '1rem' }}>
              <strong>Project Duration:</strong> {cpmResult.projectDuration} days<br />
              <strong>Critical Tasks:</strong> {cpmResult.criticalTasks.length}<br />
              <strong>Total Float:</strong> {cpmResult.totalFloat} days
            </div>
            
            {cpmLogs.length > 0 && (
              <details>
                <summary>CPM Engine Logs</summary>
                <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                  {cpmLogs.join('\n')}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
