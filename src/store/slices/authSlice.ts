import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, Role } from '../types';

interface AuthState {
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  role: null,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState: (state, action: PayloadAction<Partial<AuthState>>) => {
      return { ...state, ...action.payload };
    },
    clearAuthState: (state) => {
      return initialState;
    },
  },
});

export const { setAuthState, clearAuthState } = authSlice.actions;
export default authSlice.reducer; 