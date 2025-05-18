import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../supabaseClient';
import { Event } from '../../types';

interface EventState {
  events: Event[];
  loading: boolean;
  error: string | null;
}

interface EventImage {
  url: string;
  is_primary: boolean;
}

interface EventImageRecord {
  image_url: string;
  is_primary: boolean;
}

interface CollaboratorResponse {
  event_id: number;
  user_id: string;
  users: {
    email: string;
    profiles: {
      full_name: string;
    } | null;
  };
}

interface UserProfile {
  user_id: string;
  full_name: string;
  users: {
    email: string;
  };
}

interface ProfileWithEmail {
  user_id: string;
  full_name: string;
  email: {
    email: string;
  };
}

const initialState: EventState = {
  events: [],
  loading: false,
  error: null,
};

export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async () => {
    try {
      // First fetch all events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Then fetch all event images
      const { data: images, error: imagesError } = await supabase
        .from('event_images')
        .select('*');

      if (imagesError) throw imagesError;

      // Fetch all event collaborators
      const { data: collaborators, error: collaboratorsError } = await supabase
        .from('event_collaborators')
        .select('event_id, user_id');

      if (collaboratorsError) throw collaboratorsError;
      if (!collaborators) throw new Error('Failed to fetch collaborators');

      // Fetch user details for all collaborators
      const userIds = [...new Set(collaborators.map(c => c.user_id))];
      
      // Get profiles data
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;
      if (!profiles) throw new Error('Failed to fetch profiles');

      // Create a map of user details
      const userDetails = profiles.reduce((acc, profile) => {
        acc[profile.user_id] = {
          email: '', // We'll get this from the user's session when needed
          full_name: profile.full_name
        };
        return acc;
      }, {} as Record<string, { email: string; full_name: string }>);

      // Group images by event_id
      const imagesByEvent = images.reduce((acc, img) => {
        if (!acc[img.event_id]) {
          acc[img.event_id] = [];
        }
        acc[img.event_id].push({
          url: img.image_url,
          is_primary: img.is_primary
        });
        return acc;
      }, {} as Record<number, EventImage[]>);

      // Group collaborators by event_id with their details
      const collaboratorsByEvent = collaborators.reduce((acc, collab) => {
        if (!acc[collab.event_id]) {
          acc[collab.event_id] = [];
        }
        const userDetail = userDetails[collab.user_id];
        if (userDetail) {
          acc[collab.event_id].push({
            id: collab.user_id,
            email: userDetail.email,
            full_name: userDetail.full_name
          });
        }
        return acc;
      }, {} as Record<number, Array<{ id: string; email: string; full_name: string }>>);

      // Combine events with their images and collaborators
      const eventsWithImages = events.map(event => ({
        ...event,
        images: imagesByEvent[event.id] || [],
        collaborators: collaboratorsByEvent[event.id] || []
      }));

      console.log('Events with images and collaborators:', eventsWithImages); // Debug log

      return eventsWithImages;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

export const createEvent = createAsyncThunk(
  'events/createEvent',
  async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'attendees_count'>) => {
    try {
      // Remove images and collaborators from eventData since they're in separate tables
      const { images, collaborators, ...eventFields } = eventData as any;

      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(eventFields)
        .select()
        .single();

      if (eventError) throw eventError;

      // Handle images separately in event_images table
      if (images && images.length > 0) {
        const { error: imagesError } = await supabase
          .from('event_images')
          .insert(
            (images as EventImage[]).map(img => ({
              event_id: event.id,
              image_url: img.url,
              is_primary: img.is_primary
            }))
          );

        if (imagesError) throw imagesError;
      }

      // Handle collaborators separately in event_collaborators table
      if (collaborators && collaborators.length > 0) {
        const { error: collaboratorsError } = await supabase
          .from('event_collaborators')
          .insert(
            collaborators.map((userId: string) => ({
              event_id: event.id,
              user_id: userId
            }))
          );

        if (collaboratorsError) throw collaboratorsError;
      }

      // Fetch the complete event
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single();

      if (fetchError) throw fetchError;

      // Fetch images for this event
      const { data: eventImages, error: imagesError } = await supabase
        .from('event_images')
        .select('*')
        .eq('event_id', event.id);

      if (imagesError) throw imagesError;

      // Fetch collaborators for this event
      const { data: eventCollaborators, error: collaboratorsError } = await supabase
        .from('event_collaborators')
        .select('user_id')
        .eq('event_id', event.id);

      if (collaboratorsError) throw collaboratorsError;

      // Return combined event data with images and collaborators
      return {
        ...completeEvent,
        images: eventImages.map(img => ({
          url: img.image_url,
          is_primary: img.is_primary
        })),
        collaborators: eventCollaborators.map(c => c.user_id)
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

export const updateEvent = createAsyncThunk(
  'events/updateEvent',
  async ({ eventId, eventData }: { eventId: number; eventData: Partial<Event> }) => {
    try {
      // Remove images and collaborators from eventData since they're in separate tables
      const { images, collaborators, ...eventFields } = eventData as any;

      // Update event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .update(eventFields)
        .eq('id', eventId)
        .select()
        .single();

      if (eventError) throw eventError;

      // Handle images separately in event_images table
      if (images) {
        // Delete existing images
        const { error: deleteError } = await supabase
          .from('event_images')
          .delete()
          .eq('event_id', eventId);

        if (deleteError) throw deleteError;

        // Insert new images
        if (images.length > 0) {
          const { error: insertError } = await supabase
            .from('event_images')
            .insert(
              (images as EventImage[]).map(img => ({
                event_id: eventId,
                image_url: img.url,
                is_primary: img.is_primary
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // Handle collaborators separately in event_collaborators table
      if (collaborators) {
        // Delete existing collaborators
        const { error: deleteError } = await supabase
          .from('event_collaborators')
          .delete()
          .eq('event_id', eventId);

        if (deleteError) throw deleteError;

        // Insert new collaborators
        if (collaborators.length > 0) {
          const { error: insertError } = await supabase
            .from('event_collaborators')
            .insert(
              collaborators.map((userId: string) => ({
                event_id: eventId,
                user_id: userId
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // Fetch the complete event
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError) throw fetchError;

      // Fetch images for this event
      const { data: eventImages, error: imagesError } = await supabase
        .from('event_images')
        .select('*')
        .eq('event_id', eventId);

      if (imagesError) throw imagesError;

      // Fetch collaborators for this event
      const { data: eventCollaborators, error: collaboratorsError } = await supabase
        .from('event_collaborators')
        .select('user_id')
        .eq('event_id', eventId);

      if (collaboratorsError) throw collaboratorsError;

      // Return combined event data with images and collaborators
      return {
        ...completeEvent,
        images: eventImages.map(img => ({
          url: img.image_url,
          is_primary: img.is_primary
        })),
        collaborators: eventCollaborators.map(c => c.user_id)
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

export const addCollaborator = createAsyncThunk(
  'events/addCollaborator',
  async ({ eventId, userId }: { eventId: number; userId: string }) => {
    const { error } = await supabase
      .from('event_collaborators')
      .insert({ event_id: eventId, user_id: userId });

    if (error) throw error;
    return { eventId, userId };
  }
);

export const removeCollaborator = createAsyncThunk(
  'events/removeCollaborator',
  async ({ eventId, userId }: { eventId: number; userId: string }) => {
    const { error } = await supabase
      .from('event_collaborators')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
    return { eventId, userId };
  }
);

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
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
        state.error = action.error.message || 'Failed to fetch events';
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.events.unshift(action.payload);
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        const index = state.events.findIndex(event => event.id === action.payload.id);
        if (index !== -1) {
          state.events[index] = action.payload;
        }
      });
  },
});

export default eventSlice.reducer; 