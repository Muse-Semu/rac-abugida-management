import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../supabaseClient';
import { Event } from '../../types';

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

export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: false });

    if (error) throw error;
    return data as Event[];
  }
);

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setEvents: (state, action: PayloadAction<Event[]>) => {
      state.events = action.payload;
    },
    addEvent: (state, action: PayloadAction<Event>) => {
      state.events.unshift(action.payload);
    },
    updateEvent: (state, action: PayloadAction<Event>) => {
      const index = state.events.findIndex(event => event.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
      }
    },
    removeEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter(event => event.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
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
      });
  },
});

export const {
  setEvents,
  addEvent,
  updateEvent,
  removeEvent,
  setLoading,
  setError,
} = eventSlice.actions;

export default eventSlice.reducer; 