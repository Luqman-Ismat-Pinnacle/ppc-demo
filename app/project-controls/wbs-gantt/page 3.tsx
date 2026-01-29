'use client';

/**
 * @fileoverview WBS & Gantt Chart Page for PPC V3 Project Controls.
 * 
 * Rewritten to match MPP parser UI exactly - uses flat list approach with direct indentation
 * based on outline_level from MPP parser.
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

    // Recursive function to flatten hierarchy while preserving outline_level
    const flattenItems = (items: any[], parentLevel = 0) => {
      items.forEach(item => {
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
          percentComplete: item.percentComplete || 0,
          assignedResource: item.assignedResourceId ? getEmployeeName(item.assignedResourceId, employees) : '',
          isCritical: item.isCritical || false,
          wbsCode: item.wbsCode || ''
        };

        tasks.push(flatTask);

        // Recursively process children
        if (item.children && item.children.length > 0) {
          flattenItems(item.children, outlineLevel);
        }
      });
    };

    flattenItems(data.wbsData.items);
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

    return (
      <div
        style={{
          position: 'absolute',
          left: `${left}px`,
          width: `${width}px`,
          height: '20px',
          backgroundColor: isCritical ? '#DC2626' : isSummary ? '#40E0D0' : '#1A9B8F',
          borderRadius: '2px',
          border: isCritical ? '2px solid #EF4444' : '1px solid rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: '#fff',
          fontWeight: 'bold',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        {percentComplete > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${percentComplete}%`,
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: '2px'
            }}
          />
        )}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {percentComplete > 0 ? `${Math.round(percentComplete)}%` : ''}
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

    const stickyColsWidth = 300;
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

      {/* WBS Table - Parser UI Style */}
      <div className="card">
        <div className="card-header">
          <h3>Work Breakdown Structure</h3>
        </div>
        <div className="card-body">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th style={{ width: '300px' }}>Task Name</th>
                  <th style={{ width: '80px' }}>Complete</th>
                  <th style={{ width: '80px' }}>Hours</th>
                  <th style={{ width: '100px' }}>Start Date</th>
                  <th style={{ width: '100px' }}>End Date</th>
                  <th style={{ width: '120px' }}>Resource</th>
                </tr>
              </thead>
              <tbody>
                {flatTasks.map((task) => {
                  // CRITICAL: Use exact same indentation logic as parser UI
                  const level = task.outline_level || 1;
                  const indent = (level - 1) * 20; // 20px per level - exactly like parser
                  const isSummary = task.is_summary;
                  const nameStyle = `padding-left: ${indent}px;`;

                  // Format dates
                  const start = task.startDate ? task.startDate.split('T')[0] : '';
                  const end = task.endDate ? task.endDate.split('T')[0] : '';
                  const dur = task.projectedHours ? Math.round(task.projectedHours) : '-';
                  const pct = task.percentComplete ? Math.round(task.percentComplete) + '%' : '0%';

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
                    <tr key={task.id} className="border-b border-slate-800 transition-colors">
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">{task.id}</td>
                      <td className="px-3 py-2">
                        <div style={nameStyle} className="flex items-center">
                          {icon}
                          <span className="truncate">{task.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs">{pct}</td>
                      <td className="px-3 py-2 text-right text-xs font-mono">{dur}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{start}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{end}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{task.assignedResource}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3>Gantt Chart</h3>
        </div>
        <div className="card-body">
          <div ref={containerRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
            <table style={{ minWidth: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
                <tr>
                  <th style={{ width: '300px', padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Task</th>
                  {dateColumns.map((col, index) => (
                    <th 
                      key={index} 
                      style={{ 
                        width: `${columnWidth}px`, 
                        padding: '8px', 
                        textAlign: 'center', 
                        borderBottom: '1px solid var(--border-color)',
                        borderLeft: '1px solid var(--border-color)',
                        fontSize: '10px',
                        backgroundColor: todayColumnIndex === index ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flatTasks.map((task) => (
                  <tr key={task.id}>
                    <td style={{ 
                      padding: '8px', 
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '12px',
                      backgroundColor: task.isCritical ? '#1a1010' : 'transparent'
                    }}>
                      <div style={{ 
                        paddingLeft: `${((task.outline_level || 1) - 1) * 20}px`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ 
                          color: task.isCritical ? '#ef4444' : 'inherit', 
                          fontSize: '0.65rem', 
                          fontWeight: task.isCritical ? 700 : 400 
                        }}>
                          {task.wbsCode}
                        </span>
                        <span className="truncate">{task.name}</span>
                      </div>
                    </td>
                    <td colSpan={dateColumns.length} style={{ padding: 0, borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ position: 'relative', height: '36px' }}>
                        {renderTaskBar(task)}
                      </div>
                    </td>
                  </tr>
                ))}
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
