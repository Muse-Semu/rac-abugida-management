import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DashboardMetric } from '../types';

interface DashboardState {
  metrics: DashboardMetric[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  metrics: [],
  isLoading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setMetrics: (state, action: PayloadAction<DashboardMetric[]>) => {
      state.metrics = action.payload;
    },
    addMetric: (state, action: PayloadAction<DashboardMetric>) => {
      state.metrics.unshift(action.payload);
    },
    updateMetric: (state, action: PayloadAction<DashboardMetric>) => {
      const index = state.metrics.findIndex(metric => metric.id === action.payload.id);
      if (index !== -1) {
        state.metrics[index] = action.payload;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setMetrics,
  addMetric,
  updateMetric,
  setLoading,
  setError,
} = dashboardSlice.actions;

export default dashboardSlice.reducer; 