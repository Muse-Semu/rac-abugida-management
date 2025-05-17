import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../supabaseClient';

interface Project {
  id: number;
  name: string;
  description: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  start_date: string;
  end_date: string;
  budget: number;
  progress_percentage: number;
  tags: string[];
  team_members_count: number;
  max_team_members: number | null;
  is_archived: boolean;
  project_type: 'Internal' | 'External';
  project_target: number;
  project_target_type: 'Revenue' | 'Cost';
  project_manager_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  projects: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      // Get current user's role
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', user?.id);

      const isAdmin = userRoles?.some((ur: any) => ur.roles.role_name === 'Admin');
      const isManager = userRoles?.some((ur: any) => ur.roles.role_name === 'Project Manager');

      // Base query
      let query = supabase
        .from('projects')
        .select(`
          *,
          project_collaborators(user_id)
        `);

      // If not admin or manager, only show projects where user is creator or collaborator
      if (!isAdmin && !isManager) {
        query = query.or(`owner_id.eq.${user?.id},project_collaborators.user_id.eq.${user?.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'team_members_count'>, { rejectWithValue }) => {
    try {
      // Check if user has permission
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', user?.id);

      const isAdmin = userRoles?.some((ur: any) => ur.roles.role_name === 'Admin');
      const isManager = userRoles?.some((ur: any) => ur.roles.role_name === 'Project Manager');

      if (!isAdmin && !isManager) {
        throw new Error('You do not have permission to create projects');
      }

      console.log("Project data is ",projectData)
      // Create project
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          owner_id: user?.id,
          team_members_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return project;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ projectId, projectData }: { projectId: number; projectData: Partial<Project> }, { rejectWithValue }) => {
    try {
      // Check if user has permission
      const { data: { user } } = await supabase.auth.getUser();
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id, project_manager_id')
        .eq('id', projectId)
        .single();

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', user?.id);

      const isAdmin = userRoles?.some((ur: any) => ur.roles.role_name === 'Admin');
      const isManager = userRoles?.some((ur: any) => ur.roles.role_name === 'Project Manager');
      const isOwner = project?.owner_id === user?.id;
      const isProjectManager = project?.project_manager_id === user?.id;

      if (!isAdmin && !isManager && !isOwner && !isProjectManager) {
        throw new Error('You do not have permission to update this project');
      }

      // Update project
      const { data, error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addCollaborator = createAsyncThunk(
  'projects/addCollaborator',
  async ({ projectId, userId }: { projectId: number; userId: string }, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: projectId,
          user_id: userId,
        });

      if (error) throw error;

      return { projectId, userId };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const removeCollaborator = createAsyncThunk(
  'projects/removeCollaborator',
  async ({ projectId, userId }: { projectId: number; userId: string }, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .match({ project_id: projectId, user_id: userId });

      if (error) throw error;

      return { projectId, userId };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Projects
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Project
      .addCase(createProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.unshift(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Project
      .addCase(updateProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.projects.findIndex(project => project.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = { ...state.projects[index], ...action.payload };
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Add Collaborator
      .addCase(addCollaborator.fulfilled, (state, action) => {
        const project = state.projects.find(p => p.id === action.payload.projectId);
        if (project) {
          // Update team_members_count
          project.team_members_count = (project.team_members_count || 0) + 1;
        }
      })
      // Remove Collaborator
      .addCase(removeCollaborator.fulfilled, (state, action) => {
        const project = state.projects.find(p => p.id === action.payload.projectId);
        if (project) {
          // Update team_members_count
          project.team_members_count = Math.max((project.team_members_count || 0) - 1, 0);
        }
      });
  },
});

export default projectSlice.reducer; 