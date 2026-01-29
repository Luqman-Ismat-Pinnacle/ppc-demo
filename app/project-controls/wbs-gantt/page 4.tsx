'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/lib/data-context';

export default function WBSGanttPage() {
  const { filteredData } = useData();
  const data = filteredData;

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
  }, [data.wbsData]);

  return (
    <div className="page-panel">
      <div className="page-header">
        <div>
          <h1 className="page-title">WBS Gantt Chart</h1>
          <p className="page-description">Work Breakdown Structure with Gantt visualization</p>
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
