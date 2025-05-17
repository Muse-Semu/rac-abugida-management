import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../supabaseClient';

interface Event {
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
}

interface EventState {
  events: Event[];
  loading: boolean;
  error: string | null;
}

const initialState: EventState = {
  events: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async (_, { rejectWithValue }) => {
    try {
      // Get current user's role
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', user?.id);

      const isAdmin = userRoles?.some((ur: any) => ur.roles.role_name === 'Admin');
      const isOrganizer = userRoles?.some((ur: any) => ur.roles.role_name === 'Organizer');

      // Base query
      let query = supabase
        .from('events')
        .select(`
          *,
          event_collaborators(user_id)
        `);

      // If not admin or organizer, only show events where user is creator or collaborator
      if (!isAdmin && !isOrganizer) {
        query = query.or(`owner_id.eq.${user?.id},event_collaborators.user_id.eq.${user?.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createEvent = createAsyncThunk(
  'events/createEvent',
  async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'attendees_count'>, { rejectWithValue }) => {
    try {
      // Check if user has permission
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', user?.id);

      const isAdmin = userRoles?.some((ur: any) => ur.roles.role_name === 'Admin');
      const isOrganizer = userRoles?.some((ur: any) => ur.roles.role_name === 'Organizer');

      if (!isAdmin && !isOrganizer) {
        throw new Error('You do not have permission to create events');
      }

      // Create event
      const { data: event, error } = await supabase
        .from('events')
        .insert({
          ...eventData,
          owner_id: user?.id,
          attendees_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return event;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateEvent = createAsyncThunk(
  'events/updateEvent',
  async ({ eventId, eventData }: { eventId: number; eventData: Partial<Event> }, { rejectWithValue }) => {
    try {
      // Check if user has permission
      const { data: { user } } = await supabase.auth.getUser();
      const { data: event } = await supabase
        .from('events')
        .select('owner_id')
        .eq('id', eventId)
        .single();

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', user?.id);

      const isAdmin = userRoles?.some((ur: any) => ur.roles.role_name === 'Admin');
      const isOrganizer = userRoles?.some((ur: any) => ur.roles.role_name === 'Organizer');
      const isOwner = event?.owner_id === user?.id;

      if (!isAdmin && !isOrganizer && !isOwner) {
        throw new Error('You do not have permission to update this event');
      }

      // Update event
      const { data, error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', eventId)
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
  'events/addCollaborator',
  async ({ eventId, userId }: { eventId: number; userId: string }, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('event_collaborators')
        .insert({
          event_id: eventId,
          user_id: userId,
        });

      if (error) throw error;

      return { eventId, userId };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const removeCollaborator = createAsyncThunk(
  'events/removeCollaborator',
  async ({ eventId, userId }: { eventId: number; userId: string }, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('event_collaborators')
        .delete()
        .match({ event_id: eventId, user_id: userId });

      if (error) throw error;

      return { eventId, userId };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Events
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Event
      .addCase(createEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.loading = false;
        state.events.unshift(action.payload);
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Event
      .addCase(updateEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.events.findIndex(event => event.id === action.payload.id);
        if (index !== -1) {
          state.events[index] = { ...state.events[index], ...action.payload };
        }
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Add Collaborator
      .addCase(addCollaborator.fulfilled, (state, action) => {
        const event = state.events.find(e => e.id === action.payload.eventId);
        if (event) {
          // Update team_members_count
          event.attendees_count = (event.attendees_count || 0) + 1;
        }
      })
      // Remove Collaborator
      .addCase(removeCollaborator.fulfilled, (state, action) => {
        const event = state.events.find(e => e.id === action.payload.eventId);
        if (event) {
          // Update team_members_count
          event.attendees_count = Math.max((event.attendees_count || 0) - 1, 0);
        }
      });
  },
});

export default eventSlice.reducer; 