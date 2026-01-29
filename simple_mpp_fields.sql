-- Simple version for Supabase SQL Editor
-- Run each statement separately or all at once

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS outline_level INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_summary BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS projectedHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remainingHours DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS totalSlack DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignedResource TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_outline_level ON tasks(outline_level);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_summary ON tasks(is_summary);
