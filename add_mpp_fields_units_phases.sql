-- Add missing MPP parser fields to units and phases tables
-- This script adds all the required fields for proper WBS hierarchy and MPP parser integration

-- Add MPP parser fields to units table
DO $$
BEGIN
    -- Add outline_level column (hierarchy level from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'outline_level'
    ) THEN
        ALTER TABLE units ADD COLUMN outline_level INTEGER DEFAULT 1;
        RAISE NOTICE 'Added outline_level column to units table';
    END IF;

    -- Add parent_id column (parent task ID from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE units ADD COLUMN parent_id TEXT;
        RAISE NOTICE 'Added parent_id column to units table';
    END IF;

    -- Add is_summary column (whether this is a summary task/phase)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'is_summary'
    ) THEN
        ALTER TABLE units ADD COLUMN is_summary BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_summary column to units table';
    END IF;

    -- Add projectedHours column (calculated projected hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'projectedHours'
    ) THEN
        ALTER TABLE units ADD COLUMN projectedHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added projectedHours column to units table';
    END IF;

    -- Add remainingHours column (calculated remaining hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'remainingHours'
    ) THEN
        ALTER TABLE units ADD COLUMN remainingHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added remainingHours column to units table';
    END IF;

    -- Add totalSlack column (total slack from MPP)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'totalSlack'
    ) THEN
        ALTER TABLE units ADD COLUMN totalSlack DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added totalSlack column to units table';
    END IF;

    -- Add comments column (task comments/notes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'comments'
    ) THEN
        ALTER TABLE units ADD COLUMN comments TEXT;
        RAISE NOTICE 'Added comments column to units table';
    END IF;

    -- Add assignedResource column (employee name)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'units' AND column_name = 'assignedResource'
    ) THEN
        ALTER TABLE units ADD COLUMN assignedResource TEXT;
        RAISE NOTICE 'Added assignedResource column to units table';
    END IF;
END $$;

-- Add MPP parser fields to phases table
DO $$
BEGIN
    -- Add outline_level column (hierarchy level from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'outline_level'
    ) THEN
        ALTER TABLE phases ADD COLUMN outline_level INTEGER DEFAULT 1;
        RAISE NOTICE 'Added outline_level column to phases table';
    END IF;

    -- Add parent_id column (parent task ID from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE phases ADD COLUMN parent_id TEXT;
        RAISE NOTICE 'Added parent_id column to phases table';
    END IF;

    -- Add is_summary column (whether this is a summary task/phase)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'is_summary'
    ) THEN
        ALTER TABLE phases ADD COLUMN is_summary BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_summary column to phases table';
    END IF;

    -- Add projectedHours column (calculated projected hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'projectedHours'
    ) THEN
        ALTER TABLE phases ADD COLUMN projectedHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added projectedHours column to phases table';
    END IF;

    -- Add remainingHours column (calculated remaining hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'remainingHours'
    ) THEN
        ALTER TABLE phases ADD COLUMN remainingHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added remainingHours column to phases table';
    END IF;

    -- Add totalSlack column (total slack from MPP)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'totalSlack'
    ) THEN
        ALTER TABLE phases ADD COLUMN totalSlack DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added totalSlack column to phases table';
    END IF;

    -- Add comments column (task comments/notes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'comments'
    ) THEN
        ALTER TABLE phases ADD COLUMN comments TEXT;
        RAISE NOTICE 'Added comments column to phases table';
    END IF;

    -- Add assignedResource column (employee name)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'phases' AND column_name = 'assignedResource'
    ) THEN
        ALTER TABLE phases ADD COLUMN assignedResource TEXT;
        RAISE NOTICE 'Added assignedResource column to phases table';
    END IF;
END $$;

-- Add MPP parser fields to projects table
DO $$
BEGIN
    -- Add outline_level column (hierarchy level from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'outline_level'
    ) THEN
        ALTER TABLE projects ADD COLUMN outline_level INTEGER DEFAULT 1;
        RAISE NOTICE 'Added outline_level column to projects table';
    END IF;

    -- Add parent_id column (parent task ID from MPP parser)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN parent_id TEXT;
        RAISE NOTICE 'Added parent_id column to projects table';
    END IF;

    -- Add is_summary column (whether this is a summary task/phase)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'is_summary'
    ) THEN
        ALTER TABLE projects ADD COLUMN is_summary BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_summary column to projects table';
    END IF;

    -- Add projectedHours column (calculated projected hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'projectedHours'
    ) THEN
        ALTER TABLE projects ADD COLUMN projectedHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added projectedHours column to projects table';
    END IF;

    -- Add remainingHours column (calculated remaining hours)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'remainingHours'
    ) THEN
        ALTER TABLE projects ADD COLUMN remainingHours DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added remainingHours column to projects table';
    END IF;

    -- Add totalSlack column (total slack from MPP)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'totalSlack'
    ) THEN
        ALTER TABLE projects ADD COLUMN totalSlack DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added totalSlack column to projects table';
    END IF;

    -- Add comments column (task comments/notes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'comments'
    ) THEN
        ALTER TABLE projects ADD COLUMN comments TEXT;
        RAISE NOTICE 'Added comments column to projects table';
    END IF;

    -- Add assignedResource column (employee name)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'assignedResource'
    ) THEN
        ALTER TABLE projects ADD COLUMN assignedResource TEXT;
        RAISE NOTICE 'Added assignedResource column to projects table';
    END IF;
END $$;

-- Create indexes for better performance on hierarchy queries
CREATE INDEX IF NOT EXISTS idx_units_outline_level ON units(outline_level);
CREATE INDEX IF NOT EXISTS idx_units_parent_id ON units(parent_id);
CREATE INDEX IF NOT EXISTS idx_units_is_summary ON units(is_summary);

CREATE INDEX IF NOT EXISTS idx_phases_outline_level ON phases(outline_level);
CREATE INDEX IF NOT EXISTS idx_phases_parent_id ON phases(parent_id);
CREATE INDEX IF NOT EXISTS idx_phases_is_summary ON phases(is_summary);

CREATE INDEX IF NOT EXISTS idx_projects_outline_level ON projects(outline_level);
CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects(parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_summary ON projects(is_summary);

-- Add comments to explain the new columns
COMMENT ON COLUMN units.outline_level IS 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)';
COMMENT ON COLUMN units.parent_id IS 'Parent task ID from MPP parser for hierarchy structure';
COMMENT ON COLUMN units.is_summary IS 'Whether this is a summary task (phase/unit) from MPP parser';
COMMENT ON COLUMN units.projectedHours IS 'Calculated projected hours from MPP parser';
COMMENT ON COLUMN units.remainingHours IS 'Calculated remaining hours (projected - actual)';
COMMENT ON COLUMN units.totalSlack IS 'Total slack/float from MPP parser';
COMMENT ON COLUMN units.comments IS 'Task comments and notes from MPP parser';
COMMENT ON COLUMN units.assignedResource IS 'Assigned resource name from MPP parser';

COMMENT ON COLUMN phases.outline_level IS 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)';
COMMENT ON COLUMN phases.parent_id IS 'Parent task ID from MPP parser for hierarchy structure';
COMMENT ON COLUMN phases.is_summary IS 'Whether this is a summary task (phase/unit) from MPP parser';
COMMENT ON COLUMN phases.projectedHours IS 'Calculated projected hours from MPP parser';
COMMENT ON COLUMN phases.remainingHours IS 'Calculated remaining hours (projected - actual)';
COMMENT ON COLUMN phases.totalSlack IS 'Total slack/float from MPP parser';
COMMENT ON COLUMN phases.comments IS 'Task comments and notes from MPP parser';
COMMENT ON COLUMN phases.assignedResource IS 'Assigned resource name from MPP parser';

COMMENT ON COLUMN projects.outline_level IS 'Hierarchy level from MPP parser (1=project, 2=phase, 3=unit, 4=task)';
COMMENT ON COLUMN projects.parent_id IS 'Parent task ID from MPP parser for hierarchy structure';
COMMENT ON COLUMN projects.is_summary IS 'Whether this is a summary task (phase/unit) from MPP parser';
COMMENT ON COLUMN projects.projectedHours IS 'Calculated projected hours from MPP parser';
COMMENT ON COLUMN projects.remainingHours IS 'Calculated remaining hours (projected - actual)';
COMMENT ON COLUMN projects.totalSlack IS 'Total slack/float from MPP parser';
COMMENT ON COLUMN projects.comments IS 'Task comments and notes from MPP parser';
COMMENT ON COLUMN projects.assignedResource IS 'Assigned resource name from MPP parser';

-- Show current table structures
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name IN ('tasks', 'units', 'phases', 'projects') 
AND column_name IN (
    'outline_level', 'parent_id', 'is_summary', 
    'projectedHours', 'remainingHours', 'totalSlack', 
    'comments', 'assignedResource'
)
ORDER BY table_name, column_name;
