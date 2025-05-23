export interface User {
  id: string;
  email: string;
  designation: string;
  profile_image?: string;
}

export interface Role {
  id: number;
  role_name: 'Admin' | 'Organizer' | 'Member' | 'Viewer';
  description: string;
}

export interface UserRole {
  user_id: string;
  role_id: number;
  assigned_at: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  status: 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
  event_type: 'Public' | 'Private' | 'Internal';
  tags: string[];
  attendees_count: number;
  max_attendees: number | null;
  is_recurring: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
  images: Array<{
    url: string;
    is_primary: boolean;
  }>;
  collaborators?: Array<{
    id: string;
    email: string;
    full_name: string;
  }>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Completed' | 'On Hold';
  organizer_id: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetric {
  id: string;
  metric_name: string;
  metric_value: any;
  related_entity_type: 'Event' | 'Project' | 'General';
  related_entity_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  error: string | null;
}

export interface EventState {
  events: Event[];
  selectedEvent: Event | null;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

export interface DashboardState {
  metrics: DashboardMetric[];
  isLoading: boolean;
  error: string | null;
} 