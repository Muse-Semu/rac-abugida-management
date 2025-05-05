import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AuthState, EventState, ProjectState, DashboardState } from '../types';

// Define the initial states
const initialAuthState: AuthState = {
  user: null,
  role: null,
  isLoading: false,
  error: null,
};

const initialEventState: EventState = {
  events: [],
  selectedEvent: null,
  isLoading: false,
  error: null,
};

const initialProjectState: ProjectState = {
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,
};

const initialDashboardState: DashboardState = {
  metrics: [],
  isLoading: false,
  error: null,
};

// Define the context type
interface AppContextType {
  authState: AuthState;
  eventState: EventState;
  projectState: ProjectState;
  dashboardState: DashboardState;
  dispatch: React.Dispatch<any>;
}

// Create the context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Define action types
type Action =
  | { type: 'SET_AUTH_STATE'; payload: Partial<AuthState> }
  | { type: 'SET_EVENT_STATE'; payload: Partial<EventState> }
  | { type: 'SET_PROJECT_STATE'; payload: Partial<ProjectState> }
  | { type: 'SET_DASHBOARD_STATE'; payload: Partial<DashboardState> };

// Reducer function
const appReducer = (state: any, action: Action) => {
  switch (action.type) {
    case 'SET_AUTH_STATE':
      return { ...state, authState: { ...state.authState, ...action.payload } };
    case 'SET_EVENT_STATE':
      return { ...state, eventState: { ...state.eventState, ...action.payload } };
    case 'SET_PROJECT_STATE':
      return { ...state, projectState: { ...state.projectState, ...action.payload } };
    case 'SET_DASHBOARD_STATE':
      return { ...state, dashboardState: { ...state.dashboardState, ...action.payload } };
    default:
      return state;
  }
};

// Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, {
    authState: initialAuthState,
    eventState: initialEventState,
    projectState: initialProjectState,
    dashboardState: initialDashboardState,
  });

  return (
    <AppContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}; 