// MPP Parser Fields for Units, Phases, and Projects
// These need to be added to the respective sections in data-management/page.tsx

// UNITS SECTION - Add these fields to the units section (around line 966)
const unitsMppFields = [
  // MPP Parser Fields - for hierarchy and WBS structure
  { key: 'outline_level', header: 'Outline Level (MPP)', type: 'number', editable: true, tooltip: 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)' },
  { key: 'parent_id', header: 'Parent ID (MPP)', type: 'text', editable: true, tooltip: 'Parent task ID from MPP parser for hierarchy structure' },
  { key: 'is_summary', header: 'Is Summary (MPP)', type: 'boolean', editable: true, tooltip: 'Whether this is a summary task (phase/unit) from MPP parser' },
  { key: 'projectedHours', header: 'Projected Hours (MPP)', type: 'number', editable: true, tooltip: 'Calculated projected hours from MPP parser' },
  { key: 'totalSlack', header: 'Total Slack (MPP)', type: 'number', editable: true, tooltip: 'Total slack/float from MPP parser' },
  { key: 'assignedResource', header: 'Assigned Resource (MPP)', type: 'text', editable: true, tooltip: 'Assigned resource name from MPP parser' },
];

// Add to units defaultNewRow (around line 995)
const unitsMppDefaults = {
  // MPP Parser Fields
  outline_level: 0,
  parent_id: null,
  is_summary: false,
  projectedHours: 0,
  totalSlack: 0,
  assignedResource: '',
};

// PHASES SECTION - Add these fields to the phases section (around line 1034)
const phasesMppFields = [
  // MPP Parser Fields - for hierarchy and WBS structure
  { key: 'outline_level', header: 'Outline Level (MPP)', type: 'number', editable: true, tooltip: 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)' },
  { key: 'parent_id', header: 'Parent ID (MPP)', type: 'text', editable: true, tooltip: 'Parent task ID from MPP parser for hierarchy structure' },
  { key: 'is_summary', header: 'Is Summary (MPP)', type: 'boolean', editable: true, tooltip: 'Whether this is a summary task (phase/unit) from MPP parser' },
  { key: 'projectedHours', header: 'Projected Hours (MPP)', type: 'number', editable: true, tooltip: 'Calculated projected hours from MPP parser' },
  { key: 'totalSlack', header: 'Total Slack (MPP)', type: 'number', editable: true, tooltip: 'Total slack/float from MPP parser' },
  { key: 'assignedResource', header: 'Assigned Resource (MPP)', type: 'text', editable: true, tooltip: 'Assigned resource name from MPP parser' },
];

// Add to phases defaultNewRow (around line 1064)
const phasesMppDefaults = {
  // MPP Parser Fields
  outline_level: 0,
  parent_id: null,
  is_summary: false,
  projectedHours: 0,
  totalSlack: 0,
  assignedResource: '',
};

// PROJECTS SECTION - Add these fields to the projects section (around line 905)
const projectsMppFields = [
  // MPP Parser Fields - for hierarchy and WBS structure
  { key: 'outline_level', header: 'Outline Level (MPP)', type: 'number', editable: true, tooltip: 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)' },
  { key: 'parent_id', header: 'Parent ID (MPP)', type: 'text', editable: true, tooltip: 'Parent task ID from MPP parser for hierarchy structure' },
  { key: 'is_summary', header: 'Is Summary (MPP)', type: 'boolean', editable: true, tooltip: 'Whether this is a summary task (phase/unit) from MPP parser' },
  { key: 'projectedHours', header: 'Projected Hours (MPP)', type: 'number', editable: true, tooltip: 'Calculated projected hours from MPP parser' },
  { key: 'totalSlack', header: 'Total Slack (MPP)', type: 'number', editable: true, tooltip: 'Total slack/float from MPP parser' },
  { key: 'assignedResource', header: 'Assigned Resource (MPP)', type: 'text', editable: true, tooltip: 'Assigned resource name from MPP parser' },
];

// Add to projects defaultNewRow (around line 937)
const projectsMppDefaults = {
  // MPP Parser Fields
  outline_level: 0,
  parent_id: null,
  is_summary: false,
  projectedHours: 0,
  totalSlack: 0,
  assignedResource: '',
};

export { unitsMppFields, unitsMppDefaults, phasesMppFields, phasesMppDefaults, projectsMppFields, projectsMppDefaults };
