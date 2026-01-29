/**
 * Helper function to find column index by trying multiple possible column names
 * Handles various formats: exact match, case-insensitive, with/without spaces/underscores
 */
export function findColumnIndex(headers: string[], possibleNames: string[]): number {
  // Normalize header for comparison
  const normalize = (str: string): string => {
    return str.trim().toLowerCase()
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/'/g, '')     // Remove apostrophes
      .replace(/-/g, '_');   // Replace hyphens with underscores
  };

  for (const name of possibleNames) {
    const normalizedName = normalize(name);
    const index = headers.findIndex(h => {
      const normalizedHeader = normalize(h);
      return normalizedHeader === normalizedName ||
        normalizedHeader === name.toLowerCase() ||
        h.trim().toLowerCase() === name.toLowerCase();
    });
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * Parse CSV string into 2D array
 */
export function parseCSVString(csvString: string): string[][] {
  const lines = csvString.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Detect data type from CSV headers
 */
export function detectCSVDataType(headers: string[]): 'employees' | 'timecards' | 'tasks' | 'unknown' {
  const lowercaseHeaders = headers.map(h => h.toLowerCase().trim());

  // Check for Workday employee export
  const hasEmployeeId = lowercaseHeaders.some(h =>
    h.includes('employee_id') ||
    h.includes('employeeid') ||
    h === 'employee_id'
  );

  const hasWorkerOrName = lowercaseHeaders.some(h =>
    h.includes('worker') ||
    h.includes('firstname') ||
    h.includes('lastname') ||
    h === 'worker'
  );

  if (hasEmployeeId && hasWorkerOrName) {
    return 'employees';
  }

  // Check for Workday task export
  const hasTaskRefId = lowercaseHeaders.some(h => h.includes('basic_data_task_reference_id') || h === 'task_id');
  const hasTaskDates = lowercaseHeaders.some(h => h.includes('start_date') || h.includes('end_date'));
  if (hasTaskRefId && hasTaskDates) {
    return 'tasks';
  }

  // Check for timecard data
  if (
    lowercaseHeaders.some(h => h.includes('hours') || h.includes('time')) &&
    lowercaseHeaders.some(h => h.includes('date'))
  ) {
    return 'timecards';
  }

  return 'unknown';
}
