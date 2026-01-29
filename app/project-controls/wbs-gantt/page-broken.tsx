'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '@/lib/data-context';

export default function WBSGanttPage() {
  const { data, loading, error } = useData();
  const [flatTasks, setFlatTasks] = useState<any[]>([]);
  const [dateColumns, setDateColumns] = useState<any[]>([]);
  const [columnWidth] = useState(30);
  const [today] = useState(new Date());

  useEffect(() => {
    if (data?.wbsData?.items?.length > 0) {
      // Flatten the hierarchy exactly like parser UI
      const flattenTasks = (items: any[]): any[] => {
        const result: any[] = [];
        
        const processItem = (item: any) => {
          // Add the current item
          result.push({
            id: item.id,
            name: item.name,
            outline_level: item._outlineLevel || 1,
            is_summary: item.isSummary || false,
            percentComplete: item.percentComplete || 0,
            projectedHours: item.projectedHours || 0,
            startDate: item.startDate,
            endDate: item.endDate,
            isCritical: item.isCritical || false,
            taskEfficiency: item.taskEfficiency || 0
          });
          
          // Process children if they exist
          if (item.children && item.children.length > 0) {
            item.children.forEach(processItem);
          }
        };
        
        items.forEach(processItem);
        return result;
      };

      const flattened = flattenTasks(data.wbsData.items);
      setFlatTasks(flattened);

      // Generate date columns for gantt chart
      if (flattened.length > 0) {
        const allDates = flattened
          .filter(task => task.startDate || task.endDate)
          .flatMap(task => [
            task.startDate ? new Date(task.startDate) : null,
            task.endDate ? new Date(task.endDate) : null
          ])
          .filter(date => date !== null) as Date[];

        if (allDates.length > 0) {
          const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
          
          // Add padding
          minDate.setDate(minDate.getDate() - 7);
          maxDate.setDate(maxDate.getDate() + 7);
          
          const columns = [];
          const currentDate = new Date(minDate);
          
          while (currentDate <= maxDate) {
            columns.push({
              start: new Date(currentDate),
              end: new Date(currentDate),
              label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          setDateColumns(columns);
        }
      }
    }
  }, [data]);

  if (loading) return <div className="p-6">Loading WBS data...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!data?.wbsData?.items?.length) return <div className="p-6">No WBS data available</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">WBS Gantt - MPP Parser Style</h1>
      </div>

      {/* WBS Table Section - MPP Parser UI Style */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">WBS Hierarchy (MPP Parser Style)</h3>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
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
                {flatTasks.map((task, index) => {
                  // EXACT MPP Parser UI Logic
                  const level = task.outline_level || 1;
                  const indent = (level - 1) * 20; // 20px per level
                  const isSummary = task.is_summary;
                  const rowClass = isSummary ? 'bg-slate-800/30 font-semibold text-slate-200' : 'text-slate-400 hover:bg-slate-800/50';
                  const nameStyle = `padding-left: ${indent}px;`;

                  // Truncate dates to YYYY-MM-DD
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
                    <tr key={index} className={`${rowClass} border-b border-slate-800 transition-colors`}>
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

      {/* Gantt Chart Section - From commit dbb83c5e3f680e40c8f8d1c6fa219c9cc31e2688 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Gantt Chart Timeline</h3>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2 text-slate-400 font-medium w-full">Task Name</th>
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
                  const indent = (level - 1) * 20; // 20px per level - EXACTLY like parser UI
                  const isSummary = task.is_summary;

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
                    <tr key={index} className="border-b border-slate-800">
                      <td className="px-3 py-2">
                        <div style={{ paddingLeft: `${indent}px` }} className="flex items-center">
                          {icon}
                          <span className="truncate">{task.name}</span>
                        </div>
                      </td>
                      {/* Gantt Timeline Cells */}
                      {dateColumns.map((col, i) => {
                        const taskStart = task.startDate ? new Date(task.startDate) : null;
                        const taskEnd = task.endDate ? new Date(task.endDate) : null;
                        const isInRange = taskStart && taskEnd && col.start <= taskEnd && col.end >= taskStart;
                        const isStart = taskStart && col.start <= taskStart && col.end >= taskStart;
                        const isEnd = taskEnd && col.start <= taskEnd && col.end >= taskEnd;
                        
                        let cellStyle = {
                          borderLeft: '1px solid #333',
                          backgroundColor: 'transparent'
                        };
                        
                        if (isInRange) {
                          if (isStart && isEnd) {
                            cellStyle.backgroundColor = itemColor;
                          } else if (isStart) {
                            cellStyle.background = `linear-gradient(to right, ${itemColor} 50%, transparent 50%)`;
                          } else if (isEnd) {
                            cellStyle.background = `linear-gradient(to right, transparent 50%, ${itemColor} 50%)`;
                          } else {
                            cellStyle.backgroundColor = itemColor;
                          }
                        }
                        
                        return (
                          <td key={i} style={cellStyle}></td>
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
    </div>
  );
}
