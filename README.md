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

### `events` Table (it's not final schema)
| Field          | Type                      | Description                |
|----------------|---------------------------|----------------------------|
| `id`           | UUID (Primary Key)        | Auto-generated             |
| `title`        | TEXT                      | Required                   |
| `description`  | TEXT                      | Optional                   |
| `date`         | TIMESTAMP WITH TIME ZONE  | Required                   |
| `organizer_id` | UUID (FK to auth.users)   | Creator ID                 |
| `created_at`   | TIMESTAMP WITH TIME ZONE  | Default `NOW()`            |

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



