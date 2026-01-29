-- Add missing MPP parser fields to tasks table
-- This script adds all the required fields for proper WBS hierarchy and MPP parser integration

-- Check if columns exist before adding them
DO $$
BEGIN
    -- Add outline_level column (hierarchy level from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'outline_level'
    ) THEN
        ALTER TABLE tasks ADD COLUMN outline_level INTEGER DEFAULT 1;
        RAISE NOTICE 'Added outline_level column';
    END IF;

    -- Add parent_id column (parent task ID from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN parent_id TEXT;
        RAISE NOTICE 'Added parent_id column';
    END IF;

    -- Add is_summary column (whether this is a summary task/phase)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'is_summary'
    ) THEN
        ALTER TABLE tasks ADD COLUMN is_summary BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_summary column';
    END IF;

    -- Add projectedHours column (calculated projected hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'projectedHours'
    ) THEN
        ALTER TABLE tasks ADD COLUMN projectedHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added projectedHours column';
    END IF;

    -- Add remainingHours column (calculated remaining hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'remainingHours'
    ) THEN
        ALTER TABLE tasks ADD COLUMN remainingHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added remainingHours column';
    END IF;

    -- Add totalSlack column (total slack from MPP)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'totalSlack'
    ) THEN
        ALTER TABLE tasks ADD COLUMN totalSlack DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added totalSlack column';
    END IF;

    -- Add comments column (task comments/notes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'comments'
    ) THEN
        ALTER TABLE tasks ADD COLUMN comments TEXT;
        RAISE NOTICE 'Added comments column';
    END IF;

    -- Add assignedResource column (employee name)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'assignedResource'
    ) THEN
        ALTER TABLE tasks ADD COLUMN assignedResource TEXT;
        RAISE NOTICE 'Added assignedResource column';
    END IF;

    RAISE NOTICE 'All MPP parser fields have been added to tasks table';
END $$;

-- Create indexes for better performance on hierarchy queries
CREATE INDEX IF NOT EXISTS idx_tasks_outline_level ON tasks(outline_level);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_summary ON tasks(is_summary);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id_outline_level ON tasks(project_id, outline_level);

-- Add comments to explain the new columns
COMMENT ON COLUMN tasks.outline_level IS 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)';
COMMENT ON COLUMN tasks.parent_id IS 'Parent task ID from MPP parser for hierarchy structure';
COMMENT ON COLUMN tasks.is_summary IS 'Whether this is a summary task (phase/unit) from MPP parser';
COMMENT ON COLUMN tasks.projectedHours IS 'Calculated projected hours from MPP parser';
COMMENT ON COLUMN tasks.remainingHours IS 'Calculated remaining hours (projected - actual)';
COMMENT ON COLUMN tasks.totalSlack IS 'Total slack/float from MPP parser';
COMMENT ON COLUMN tasks.comments IS 'Task comments and notes from MPP parser';
COMMENT ON COLUMN tasks.assignedResource IS 'Assigned resource name from MPP parser';

-- Show current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN (
    'outline_level', 'parent_id', 'is_summary', 
    'projectedHours', 'remainingHours', 'totalSlack', 
    'comments', 'assignedResource'
)
ORDER BY column_name;
