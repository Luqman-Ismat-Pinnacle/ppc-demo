-- Simple version for Supabase SQL Editor - Units, Phases, Projects
-- Run each section separately or all at once

-- UNITS TABLE
ALTER TABLE units ADD COLUMN IF NOT EXISTS outline_level INTEGER DEFAULT 1;
ALTER TABLE units ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS is_summary BOOLEAN DEFAULT FALSE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS projectedHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS remainingHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS totalSlack DECIMAL(10,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS assignedResource TEXT;

-- PHASES TABLE  
ALTER TABLE phases ADD COLUMN IF NOT EXISTS outline_level INTEGER DEFAULT 1;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS is_summary BOOLEAN DEFAULT FALSE;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS projectedHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS remainingHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS totalSlack DECIMAL(10,2) DEFAULT 0;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE phases ADD COLUMN IF NOT EXISTS assignedResource TEXT;

-- PROJECTS TABLE
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outline_level INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_summary BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS projectedHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS remainingHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS totalSlack DECIMAL(10,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assignedResource TEXT;

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_units_outline_level ON units(outline_level);
CREATE INDEX IF NOT EXISTS idx_units_parent_id ON units(parent_id);
CREATE INDEX IF NOT EXISTS idx_units_is_summary ON units(is_summary);

CREATE INDEX IF NOT EXISTS idx_phases_outline_level ON phases(outline_level);
CREATE INDEX IF NOT EXISTS idx_phases_parent_id ON phases(parent_id);
CREATE INDEX IF NOT EXISTS idx_phases_is_summary ON phases(is_summary);

CREATE INDEX IF NOT EXISTS idx_projects_outline_level ON projects(outline_level);
CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects(parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_summary ON projects(is_summary);
