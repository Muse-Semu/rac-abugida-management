# RAC-Abugida-Management

![Tech Stack](https://img.shields.io/badge/Built%20With-React%20%7C%20Vite%20%7C%20TypeScript%20%7C%20Supabase-blue)

A modern web application for managing events, projects, dashboards, and users with secure Role-Based Access Control (RBAC) and real-time updates.

## 🚀 Overview

RAC-Abugida-Management streamlines organizational workflows through a modular interface and secure access controls. Built with modern web technologies, it provides:

- 📅 Event Management
- 👥 User Management 
- 📂 Project Management
- 📊 Dashboards with Metrics
- 🔐 Role-Based User Access
- ⚡ Real-Time Updates

## 📦 Project Structure
    rac-abugida-management/
    ├── src/
    │ ├── components/
    │ │ ├── Auth/ # Authentication module
    │ │ ├── Dashboard/ # Dashboard visualization module
    │ │ ├── EventManager/ # Event CRUD module
    │ │ ├── ProjectManager/# Project CRUD module
    │ │ ├── UserManager/ # User role management module
    │ ├── supabaseClient.ts # Supabase client initialization
    │ ├── types.ts # TypeScript interfaces
    │ ├── App.tsx # Main app component
    │ ├── index.css # Tailwind CSS
    │ ├── main.tsx # Entry point
    ├── .env # Environment variables
    ├── tailwind.config.js # Tailwind configuration
    ├── vite.config.ts # Vite configuration
    ├── package.json # Dependencies and scripts
    ├── README.md # Project documentation


## 🎯 Key Features

- **Secure RBAC**: Four distinct roles (Admins, Organizers, Members, and Viewers)
- **Real-time Sync**: Live updates via Supabase subscriptions
- **Interactive Dashboards**: Visual insights using Recharts
- **Modular Architecture**: Clean and scalable code structure
- **Modern UI/UX**: Responsive design with Tailwind CSS

## 🛠 Technology Stack

### Frontend
- **Vite** - Next generation frontend tooling
- **React** with **TypeScript** - For building UI components
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **jwt-decode** - JWT role extraction
- **Recharts** - Data visualization library

### Backend (via Supabase)
- **Supabase Auth** - Passwordless login with magic links
- **PostgreSQL** - Managed relational database
- **Real-time API** - `postgres_changes` WebSocket subscriptions

## 🔌 API Endpoints

### 🔐 Authentication
- `POST /auth/v1/signin` - Sends a magic link for passwordless login
- `GET /auth/v1/session` - Retrieves the current user session

### 📅 Events Management
- `GET /rest/v1/events` - Fetch all events (RLS: Authenticated users)
- `POST /rest/v1/events` - Create new event (RLS: Organizers/Admins)
- `PATCH /rest/v1/events?id=eq.<id>` - Update event (RLS: Owner or Admins)
- `DELETE /rest/v1/events?id=eq.<id>` - Delete event (RLS: Owner or Admins)
- **Real-time**: WebSocket subscription to `postgres_changes` on events table

### 📂 Project Management
- `GET /rest/v1/projects` - Fetch all projects (RLS: Based on role)
- `POST /rest/v1/projects` - Create new project (RLS: Organizers/Admins)
- `PATCH /rest/v1/projects?id=eq.<id>` - Update project (RLS: Owner or Admins)
- `DELETE /rest/v1/projects?id=eq.<id>` - Delete project (RLS: Owner or Admins)
- **Real-time**: WebSocket subscription to `postgres_changes` on projects table

### 👤 User Management
- `GET /rest/v1/user_roles?user_id=eq.<user_id>` - Fetch user role (RLS: Own role or Admins)
- `POST /rest/v1/user_roles` - Assign role to user (RLS: Admins)
- `PATCH /rest/v1/user_roles?user_id=eq.<user_id>` - Update user role (RLS: Admins)
- `DELETE /rest/v1/user_roles?user_id=eq.<user_id>` - Remove user role (RLS: Admins)

### 📊 Dashboards
- `GET /rest/v1/dashboard_metrics` - Fetch metrics (RLS: Viewers and Admins)
- `POST /rest/v1/dashboard_metrics` - Update metrics (RLS: Admins)

## 🧱 Database Schema


## Overview
This document describes the database schema for the project management and event collaboration system. The database is designed to support user profiles, role-based access control, event and project management with multimedia support, and collaboration features.

## Database Schema

### Tables Structure

#### 1. Profiles
- Stores user profile information that extends the authentication system
- **Fields**:
  - `user_id`: Primary key referencing auth.users
  - `designation`: User's job title/position
  - `profile_image`: URL to the user's profile picture
  - `created_at`, `updated_at`: Timestamps

#### 2. Roles
- Defines available system roles with permissions
- **Fields**:
  - `id`: Auto-incrementing primary key
  - `role_name`: Predefined role names (Admin, Organizer, Member, Viewer)
  - `description`: Role description
  - `created_at`: Creation timestamp

#### 3. User Roles
- Junction table assigning roles to users
- **Fields**:
  - `user_id`: References auth.users
  - `role_id`: References roles
  - `assigned_at`: Assignment timestamp
  - Unique constraint on (user_id, role_id)

#### 4. Events
- Manages event information
- **Fields**:
  - `title`, `description`: Event details
  - `start_time`, `end_time`: Event timing
  - `owner_id`: Event creator reference
  - `created_at`, `updated_at`: Timestamps

#### 5. Event Images
- Stores images associated with events
- **Fields**:
  - `event_id`: References events
  - `image_url`: Image location
  - `is_primary`: Flags primary image
  - `uploaded_at`: Upload timestamp
  - Unique constraint ensuring one primary image per event

#### 6. Projects
- Manages project information
- **Fields**:
  - `name`, `description`: Project details
  - `status`: Project state (default 'Active')
  - `owner_id`: Project creator reference
  - `created_at`, `updated_at`: Timestamps

#### 7. Project Images
- Stores images associated with projects
- **Fields**:
  - `project_id`: References projects
  - `image_url`: Image location
  - `is_primary`: Flags primary image
  - `uploaded_at`: Upload timestamp
  - Unique constraint ensuring one primary image per project

#### 8. Event Collaborators
- Manages user participation in events
- **Fields**:
  - `event_id`, `user_id`: Composite reference
  - `role_id`: Collaborator's role
  - `assigned_at`: Assignment timestamp
  - Unique constraint per user per event

#### 9. Project Collaborators
- Manages user participation in projects
- **Fields**:
  - `project_id`, `user_id`: Composite reference
  - `role_id`: Collaborator's role
  - `assigned_at`: Assignment timestamp
  - Unique constraint per user per project

#### 10. Dashboard Metrics
- Stores aggregated system metrics
- **Fields**:
  - `metric_name`: Identifier for the metric
  - `metric_value`: JSON data for flexible storage
  - `related_entity_type`: Type of entity (Event/Project/General)
  - `related_entity_id`: Optional entity reference
  - `created_at`, `updated_at`: Timestamps

## Key Relationships
- Users have profiles (`profiles` table extends auth.users)
- Users can have multiple roles through `user_roles` junction table
- Both events and projects:
  - Have owners (users)
  - Support multiple images with one primary image
  - Have collaborators with specific roles
- Dashboard metrics can be associated with specific entities or be general

## Constraints
- Role names are restricted to specific values
- Only one primary image allowed per event/project
- Each user can only have one role per event/project
- Cascading deletes for dependent records where appropriate
> Similar tables exist for `projects`, `dashboard_metrics`, and `user_roles`

## 🔐 Role-Based Access Control

| Module            | Admin      | Organizer   | Member     | Viewer     |
|-------------------|------------|-------------|------------|------------|
| Events CRUD       | ✅ Full    | ✅ Own only | ❌         | ✅ Read     |
| Projects CRUD     | ✅ Full    | ✅ Own only | ✅ Read     | ❌         |
| User Management   | ✅ Full    | ❌          | ❌         | ❌         |
| Dashboard View    | ✅ Full    | ✅          | ✅         | ✅         |


## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- Supabase account
- Git

### Installation Steps

1. **Clone the repository**:
```bash
git clone https://github.com/Muse-Semu/rac-abugida-management.git
cd rac-abugida-management










## 🛡️ Database Security (RLS Policies)

```sql
-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for events
CREATE POLICY "Allow view for all roles"
ON events FOR SELECT
USING (true);

CREATE POLICY "Allow insert for organizers and above"
ON events FOR INSERT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'organizer')
  )
);

CREATE POLICY "Allow update if creator"
ON events FOR UPDATE
USING (organizer_id = auth.uid());

-- Policies for user_roles
CREATE POLICY "Allow admin everything"
ON user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- JWT Custom Claim Hook
CREATE FUNCTION public.jwt_role_hook(uid uuid)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'role', COALESCE((SELECT role FROM user_roles WHERE user_id = uid), 'viewer')
  )
$$ LANGUAGE SQL SECURITY DEFINER;

-- Assign to JWT hook
ALTER ROLE authenticator SET jwt_custom_claim_hook = 'public.jwt_role_hook';



