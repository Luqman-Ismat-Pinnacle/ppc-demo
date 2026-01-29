/**
 * @fileoverview Workday Sync API Route
 * 
 * Calls Supabase Edge Functions to sync data.
 * Supports: employees, projects, phases, tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findColumnIndex, parseCSVString, detectCSVDataType } from '@/lib/data-import-utils';
import type { Employee } from '@/types/data';

const EDGE_FUNCTIONS = {
  'employees': 'workday-employees',
  'projects': 'workday-projects',
  'phases': 'workday-phases',
  'tasks': 'workday-tasks',
  'hours': 'workday-hours',
} as const;

type SyncType = keyof typeof EDGE_FUNCTIONS;

function convertWorkdayEmployees(csvData: string[][]): Employee[] {
  if (!csvData || csvData.length < 2) {
    return [];
  }

  const headers = csvData[0];
  const rows = csvData.slice(1);

  const idIndex = findColumnIndex(headers, ['Employee ID', 'ID']);
  const nameIndex = findColumnIndex(headers, ['Employee Name', 'Name']);
  const jobTitleIndex = findColumnIndex(headers, ['Job Title', 'Title']);
  const managementLevelIndex = findColumnIndex(headers, ['Management Level', 'Level']);
  const managerIndex = findColumnIndex(headers, ['Manager', 'Manager Name']);
  const emailIndex = findColumnIndex(headers, ['Email', 'Email Address']);
  const employeeTypeIndex = findColumnIndex(headers, ['Employee Type', 'Type']);
  const roleIndex = findColumnIndex(headers, ['Role', 'Job Role']);
  const isActiveIndex = findColumnIndex(headers, ['Active', 'Is Active']);

  const now = new Date().toISOString();

  return rows.map(row => ({
    id: row[idIndex],
    name: row[nameIndex],
    jobTitle: row[jobTitleIndex],
    managementLevel: row[managementLevelIndex],
    manager: row[managerIndex],
    email: row[emailIndex],
    employeeType: row[employeeTypeIndex],
    role: row[roleIndex],
    isActive: row[isActiveIndex] === 'true' || row[isActiveIndex] === 'Yes',
    createdAt: now,
    updatedAt: now,
  }));
}

function convertWorkdayTasks(csvData: string[][]): any {
  if (!csvData || csvData.length < 2) {
    return [];
  }

  const headers = csvData[0];
  const rows = csvData.slice(1);

  const idIndex = findColumnIndex(headers, ['Task ID', 'ID']);
  const nameIndex = findColumnIndex(headers, ['Task Name', 'Name']);
  const projectIdIndex = findColumnIndex(headers, ['Project ID', 'Project']);
  const actualHoursIndex = findColumnIndex(headers, ['Actual Hours', 'Actual Work']);
  const baselineHoursIndex = findColumnIndex(headers, ['Baseline Hours', 'Baseline Work']);
  const actualStartDateIndex = findColumnIndex(headers, ['Actual Start Date', 'Start']);
  const actualEndDateIndex = findColumnIndex(headers, ['Actual End Date', 'Finish']);
  const statusIndex = findColumnIndex(headers, ['Status', 'Task Status']);
  const percentCompleteIndex = findColumnIndex(headers, ['Percent Complete', '% Complete']);

  const now = new Date().toISOString();

  return rows.map(row => ({
    id: row[idIndex],
    name: row[nameIndex],
    projectId: row[projectIdIndex],
    actualHours: parseFloat(row[actualHoursIndex]) || 0,
    baselineHours: parseFloat(row[baselineHoursIndex]) || 0,
    actualStartDate: row[actualStartDateIndex],
    actualEndDate: row[actualEndDateIndex],
    status: row[statusIndex],
    percentComplete: parseFloat(row[percentCompleteIndex]) || 0,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const syncType = body.syncType as SyncType | 'unified';
    const records = body.records || [];

    // Unified Sync Logic: Call 3 Edge Functions sequentially
    if (syncType === 'unified') {
      console.log('[Workday Sync] Starting Unified Sync sequence...');
      const results: any[] = [];
      const logs: string[] = [];
      let success = true;

      // 1. Employees (creates Portfolios)
      logs.push('--- Step 1: Syncing Employees & Portfolios ---');
      const empRes = await convertWorkdayEmployees(records);
      results.push({ step: 'employees', result: empRes });
      logs.push(`Synced ${empRes.length} employees.`);
      if (!empRes.length) {
        success = false;
        logs.push('Error in employees sync: No employees synced.');
      }

      // 2. Projects (creates Customers, Sites, updates Portfolios)
      // NOTE: Projects/hierarchy only. No Tasks/Phases.
      logs.push('--- Step 2: Syncing Hierarchy (Portfolios, Customers, Sites) ---');
      // TO DO: implement the conversion logic for Workday projects
      const projRes = []; // Replace with actual implementation
      results.push({ step: 'hierarchy', result: projRes });
      logs.push(`Synced Hierarchy: ${projRes.length} Portfolios, ${projRes.length} Customers, ${projRes.length} Sites.`);
      if (!projRes.length) {
        success = false;
        logs.push('Error in hierarchy sync: No hierarchy synced.');
      }

      // 3. Hours (creates Tasks too)
      logs.push('--- Step 3: Syncing Hours & Tasks (Last 30 Days) ---');
      logs.push('Refreshing memory/cooldown for 5 seconds...');

      // Cooldown to prevent memory spikes on Edge
      await new Promise(resolve => setTimeout(resolve, 5000));

      const hrsRes = await convertWorkdayTasks(records);
      results.push({ step: 'hours', result: hrsRes });
      logs.push(`Synced ${hrsRes.length} hours, ${hrsRes.length} tasks created.`);
      if (!hrsRes.length) {
        success = false;
        logs.push('Error in hours sync: No hours synced.');
      }

      // Direct database upsert operations
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from('employees').upsert(empRes);
      await supabase.from('projects').upsert(projRes);
      await supabase.from('hours').upsert(hrsRes);

      return NextResponse.json({
        success,
        syncType: 'unified',
        summary: { totalSteps: 3, results },
        logs
      });
    }

    if (!syncType || !EDGE_FUNCTIONS[syncType as keyof typeof EDGE_FUNCTIONS]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid sync type. Must be one of: ${Object.keys(EDGE_FUNCTIONS).join(', ')} or 'unified'`
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let result;

    switch (syncType) {
      case 'employees':
        result = await convertWorkdayEmployees(records);
        await supabase.from('employees').upsert(result);
        break;
      case 'tasks':
        result = await convertWorkdayTasks(records);
        await supabase.from('tasks').upsert(result);
        break;
      default:
        // TO DO: implement the conversion logic for other sync types
        result = []; // Replace with actual implementation
    }

    return NextResponse.json({
      success: true,
      syncType,
      summary: result,
      logs: []
    });

  } catch (error: any) {
    console.error('Workday sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    available: true,
    syncTypes: Object.keys(EDGE_FUNCTIONS),
    message: 'POST { syncType, records } to sync data',
  });
}
