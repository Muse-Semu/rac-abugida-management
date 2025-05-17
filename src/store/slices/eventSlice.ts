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

const initialState: EventState = {
  events: [],
  loading: false,
  error: null,
};

export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async () => {
    try {
      // Fetch events with their images using a join
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_images (
            image_url,
            is_primary
          )
        `)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Transform the data to match the expected format
      const transformedEvents = events.map(event => ({
        ...event,
        images: (event.event_images as EventImageRecord[] || []).map(img => ({
          url: img.image_url,
          is_primary: img.is_primary
        }))
      }));

      return transformedEvents;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

export const createEvent = createAsyncThunk(
  'events/createEvent',
  async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'attendees_count'>) => {
    try {
      // Extract images from eventData
      const { images, ...eventFields } = eventData as any;

      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(eventFields)
        .select()
        .single();

      if (eventError) throw eventError;

      // Handle images if they exist
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

      // Fetch the complete event with images
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
          event_images (
            image_url,
            is_primary
          )
        `)
        .eq('id', event.id)
        .single();

      if (fetchError) throw fetchError;

      return {
        ...completeEvent,
        images: (completeEvent.event_images as EventImageRecord[] || []).map(img => ({
          url: img.image_url,
          is_primary: img.is_primary
        }))
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
      // Extract images from eventData
      const { images, ...eventFields } = eventData as any;

      // Update event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .update(eventFields)
        .eq('id', eventId)
        .select()
        .single();

      if (eventError) throw eventError;

      // Handle images if they exist
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

      // Fetch the complete event with images
      const { data: completeEvent, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
          event_images (
            image_url,
            is_primary
          )
        `)
        .eq('id', eventId)
        .single();

      if (fetchError) throw fetchError;

      return {
        ...completeEvent,
        images: (completeEvent.event_images as EventImageRecord[] || []).map(img => ({
          url: img.image_url,
          is_primary: img.is_primary
        }))
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