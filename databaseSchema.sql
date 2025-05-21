-- Enabling required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table to store additional user information
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE, -- Date of birth
    designation VARCHAR(100), -- e.g., "Project Manager", "Developer"
    profile_image VARCHAR(255), -- URL or path to profile image,
    bio TEXT, -- Short biography or description
    contact_number VARCHAR(20), -- Contact number
    address TEXT, -- Physical address
    social_links JSONB, -- JSON object for social media links
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT FALSE
);

-- Roles table to define available roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL CHECK (role_name IN ('Admin', 'Organizer', 'Member', 'Viewer')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User roles junction table to assign roles to users
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Events table for event management
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255), -- Event location
    status VARCHAR(50) DEFAULT 'Scheduled', -- e.g., Scheduled, Ongoing, Completed
    event_type VARCHAR(50) CHECK (event_type IN ('Public', 'Private', 'Internal')),
    tags VARCHAR(255)[], -- Array of tags for categorization
    attendees_count INTEGER DEFAULT 0, -- Number of attendees
    max_attendees INTEGER, -- Maximum number of attendees
    is_recurring BOOLEAN DEFAULT FALSE, -- Indicates if the event is recurring
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event images table for storing multiple images per event
CREATE TABLE event_images (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL, -- URL or path to image
    is_primary BOOLEAN DEFAULT FALSE, -- Marks the primary image
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, is_primary) -- Ensures only one primary image per event
);

-- Projects table for project management
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    budget NUMERIC(15, 2), -- Budget for the project
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    tags VARCHAR(255)[], -- Array of tags for categorization
    team_members_count INTEGER DEFAULT 0, -- Number of team members
    max_team_members INTEGER, -- Maximum number of team members
    is_archived BOOLEAN DEFAULT FALSE, -- Indicates if the project is archived
    project_type VARCHAR(50) CHECK (project_type IN ('Internal', 'External')),
    project_target NUMERIC(15, 2), -- Target for the project
    project_target_type VARCHAR(50) CHECK (project_target_type IN ('Revenue', 'Cost')),
    project_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
);

-- Project images table for storing multiple images per project
CREATE TABLE project_images (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL, -- URL or path to image
    is_primary BOOLEAN DEFAULT FALSE, -- Marks the primary image
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, is_primary) -- Ensures only one primary image per project
);

CREATE TABLE project_collaborators (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);


-- Event collaborators (junction table for user-event collaboration)
CREATE TABLE event_collaborators (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Project collaborators (junction table for user-project collaboration)

-- Dashboard metrics table for aggregated metrics
CREATE TABLE dashboard_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL, -- Store flexible metric data
    related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('Event', 'Project', 'General')),
    related_entity_id INTEGER, -- Optional reference to event/project
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_events_owner_id ON events(owner_id);
CREATE INDEX idx_event_images_event_id ON event_images(event_id);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_project_images_project_id ON project_images(project_id);
CREATE INDEX idx_event_collaborators_event_id ON event_collaborators(event_id);
CREATE INDEX idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX idx_dashboard_metrics_entity_type ON dashboard_metrics(related_entity_type);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_events_timestamp
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_projects_timestamp
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_dashboard_metrics_timestamp
    BEFORE UPDATE ON dashboard_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();