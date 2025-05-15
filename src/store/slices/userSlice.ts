// src/store/slices/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../supabaseClient';

interface User {
  id: string;
  email: string;
  full_name: string;
  designation: string;
  is_active: boolean;
  created_at: string;
  role?: {
    id: number;
    role_name: string;
  } | null;
}

interface Role {
  id: number;
  role_name: string;
  description: string;
}

interface UserState {
  users: User[];
  roles: Role[];
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  users: [],
  roles: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      // First, get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Then, get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles (
            id,
            role_name
          )
        `);

      if (rolesError) throw rolesError;

      // Combine the data
      const formattedUsers: User[] = profiles.map((profile: any) => {
        const userRole = userRoles.find((ur: any) => ur.user_id === profile.user_id);
        const role = userRole?.roles?.[0] || null;
        return {
          id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          designation: profile.designation,
          is_active: profile.is_active,
          created_at: profile.created_at,
          role: role ? {
            id: role.id,
            role_name: role.role_name,
          } : null,
        };
      });

      return formattedUsers;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchRoles = createAsyncThunk(
  'users/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*');

      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: { email: string; full_name: string; designation: string; role_id: string; is_active: boolean }, { rejectWithValue }) => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: 'temporaryPassword123!', // You might want to implement a better way to handle this
        options: {
          data: {
            full_name: userData.full_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            full_name: userData.full_name,
            designation: userData.designation,
            is_active: userData.is_active,
          });

        if (profileError) throw profileError;

        // Assign role if provided
        if (userData.role_id) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role_id: parseInt(userData.role_id),
            });

          if (roleError) throw roleError;
        }

        return {
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          designation: userData.designation,
          is_active: userData.is_active,
          created_at: authData.user.created_at,
          role: userData.role_id ? {
            id: parseInt(userData.role_id),
            role_name: '', // This will be populated when fetching users
          } : null,
        };
      }
      throw new Error('Failed to create user');
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, userData }: { userId: string; userData: { full_name: string; designation: string; role_id: string; is_active: boolean } }, { rejectWithValue }) => {
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: userData.full_name,
          designation: userData.designation,
          is_active: userData.is_active,
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Update role if provided
      if (userData.role_id) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            role_id: parseInt(userData.role_id),
          });

        if (roleError) throw roleError;
      }

      return {
        id: userId,
        full_name: userData.full_name,
        designation: userData.designation,
        is_active: userData.is_active,
        created_at: '', // This will be populated when fetching users
        role: userData.role_id ? {
          id: parseInt(userData.role_id),
          role_name: '', // This will be populated when fetching users
        } : null,
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return userId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const toggleUserStatus = createAsyncThunk(
  'users/toggleUserStatus',
  async ({ userId, currentStatus }: { userId: string; currentStatus: boolean }, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('user_id', userId);

      if (error) throw error;
      return { userId, is_active: !currentStatus };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    setRoles: (state, action: PayloadAction<Role[]>) => {
      state.roles = action.payload;
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
      // Fetch Users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Roles
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create User
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users.unshift(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = { ...state.users[index], ...action.payload };
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(user => user.id !== action.payload);
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Toggle User Status
      .addCase(toggleUserStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleUserStatus.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.users.findIndex(user => user.id === action.payload.userId);
        if (index !== -1) {
          state.users[index].is_active = action.payload.is_active;
        }
      })
      .addCase(toggleUserStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setUsers,
  setRoles,
  setLoading,
  setError,
} = userSlice.actions;

export default userSlice.reducer;