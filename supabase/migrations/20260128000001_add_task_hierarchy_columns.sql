-- Migration to add support for recursive MPP task hierarchy
-- Adds outline_level and is_summary to tasks table to support V13 parser logic

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS outline_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_summary BOOLEAN DEFAULT false;

-- Add index for performance on hierarchical queries if needed (though parent_task_id is already indexed)
CREATE INDEX IF NOT EXISTS idx_tasks_outline_level ON tasks(outline_level);
