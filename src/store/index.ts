import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import projectReducer from './slices/projectSlice';
import eventReducer from './slices/eventSlice';
import authReducer from './slices/authSlice';
import dashboardReducer from './slices/dashboardSlice';

export const store = configureStore({
  reducer: {
    users: userReducer,
    projects: projectReducer,
    events: eventReducer,
    auth: authReducer,
    dashboard: dashboardReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 