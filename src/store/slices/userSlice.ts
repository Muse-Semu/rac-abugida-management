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

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  designation: string;
  is_active: boolean;
  created_at: string;
}

interface UserState {
  users: User[];
  roles: Role[];
  profiles: Profile[];
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  users: [],
  roles: [],
  profiles: [],
  loading: false,
  error: null,
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_id');

      if (rolesError) throw rolesError;

      // Get all roles
      const { data: roles, error: roleDetailsError } = await supabase
        .from('roles')
        .select('id, role_name');

      if (roleDetailsError) throw roleDetailsError;

      // Combine the data
      const formattedUsers: User[] = profiles.map((profile: any) => {
        const userRole = userRoles.find((ur: any) => ur.user_id === profile.user_id);
        const role = userRole ? roles.find((r: any) => r.id === userRole.role_id) : null;
        
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

      return { users: formattedUsers, profiles };
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

        // Only assign role if role_id is provided (admin creating user)
        if (userData.role_id) {
          // First check if the current user is an admin
          const { data: currentUserRoles, error: roleCheckError } = await supabase
            .from('user_roles')
            .select(`
              roles (
                role_name
              )
            `)
            .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

          if (roleCheckError) throw roleCheckError;

          // Check if any of the user's roles is Admin
          const isAdmin = currentUserRoles?.some(
            (userRole: any) => userRole.roles?.role_name === 'Admin'
          );

          // Only proceed with role assignment if the current user is an admin
          if (isAdmin) {
            // First delete any existing roles for this user
            const { error: deleteError } = await supabase
              .from('user_roles')
              .delete()
              .eq('user_id', authData.user.id);

            if (deleteError) throw deleteError;

            // Then insert the new role
            const { error: roleError } = await supabase
              .from('user_roles')
              .insert({
                user_id: authData.user.id,
                role_id: parseInt(userData.role_id),
              });

            if (roleError) throw roleError;
          }
        }

        // Fetch the created user's role to return complete data
        const { data: userRoles, error: fetchRoleError } = await supabase
          .from('user_roles')
          .select(`
            roles (
              id,
              role_name
            )
          `)
          .eq('user_id', authData.user.id);

        if (fetchRoleError) throw fetchRoleError;

        const userRole = userRoles?.[0]?.roles;

        return {
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          designation: userData.designation,
          is_active: userData.is_active,
          created_at: authData.user.created_at,
          role: userRole ? {
            id: userRole.id,
            role_name: userRole.role_name,
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
        // First check if user already has a role
        const { data: existingRole, error: checkError } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError; // PGRST116 is "no rows returned"

        if (existingRole) {
          // Update existing role
          const { error: updateError } = await supabase
            .from('user_roles')
            .update({ role_id: parseInt(userData.role_id) })
            .eq('user_id', userId);

          if (updateError) throw updateError;
        } else {
          // Insert new role
          const { error: insertError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              role_id: parseInt(userData.role_id),
            });

          if (insertError) throw insertError;
        }
      }

      // Fetch updated user data
      const { data: profile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileFetchError) throw profileFetchError;

      // Fetch user's role
      const { data: userRole, error: roleFetchError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .single();

      if (roleFetchError && roleFetchError.code !== 'PGRST116') throw roleFetchError;

      // Fetch role details if user has a role
      let roleDetails = null;
      if (userRole) {
        const { data: role, error: roleDetailsError } = await supabase
          .from('roles')
          .select('id, role_name')
          .eq('id', userRole.role_id)
          .single();

        if (roleDetailsError) throw roleDetailsError;
        roleDetails = role;
      }

      return {
        id: userId,
        email: profile.email,
        full_name: userData.full_name,
        designation: userData.designation,
        is_active: userData.is_active,
        created_at: profile.created_at,
        role: roleDetails ? {
          id: roleDetails.id,
          role_name: roleDetails.role_name,
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
    setProfiles: (state, action: PayloadAction<Profile[]>) => {
      state.profiles = action.payload;
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
        state.users = action.payload.users;
        state.profiles = action.payload.profiles;
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
  setProfiles,
  setLoading,
  setError,
} = userSlice.actions;

export default userSlice.reducer;