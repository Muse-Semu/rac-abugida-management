import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setAuthState } from '../store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.auth);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
          // Fetch user role and profile
          const { data: userRole, error: roleError } = await supabase
            .from('user_roles')
            .select('*, roles(*)')
            .eq('user_id', session.user.id)
            .single();

          if (roleError) throw roleError;

          dispatch(setAuthState({
            user: session.user,
            role: userRole.roles,
            isLoading: false,
            error: null,
          }));
        } else {
          dispatch(setAuthState({
            user: null,
            role: null,
            isLoading: false,
            error: null,
          }));
        }
      } catch (error) {
        console.error('Session check error:', error);
        dispatch(setAuthState({
          error: error instanceof Error ? error.message : 'An error occurred',
          isLoading: false,
        }));
      } finally {
        setIsInitialized(true);
      }
    };

    checkSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
          try {
            const { data: userRole, error: roleError } = await supabase
              .from('user_roles')
              .select('*, roles(*)')
              .eq('user_id', session.user.id)
              .single();

            if (roleError) throw roleError;

            dispatch(setAuthState({
              user: session.user,
              role: userRole.roles,
              isLoading: false,
              error: null,
            }));
          } catch (error) {
            console.error('Role fetch error:', error);
            dispatch(setAuthState({
              error: error instanceof Error ? error.message : 'An error occurred',
              isLoading: false,
            }));
          }
        } else if (event === 'SIGNED_OUT') {
          dispatch(setAuthState({
            user: null,
            role: null,
            isLoading: false,
            error: null,
          }));
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  const signIn = async (email: string, password: string) => {
    try {
      dispatch(setAuthState({ isLoading: true, error: null }));
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error('User not found. Please check your credentials or register a new account.');
        }
        throw error;
      }

      if (data.session) {
        // Fetch user role and profile
        const { data: userRole, error: roleError } = await supabase
          .from('user_roles')
          .select('*, roles(*)')
          .eq('user_id', data.session.user.id)
          .single();

        if (roleError) throw roleError;

        dispatch(setAuthState({
          user: data.session.user,
          role: userRole.roles,
          isLoading: false,
          error: null,
        }));

        return true; // Return true to indicate successful sign-in
      }
      return false;
    } catch (error) {
      dispatch(setAuthState({
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false,
      }));
      throw error;
    } finally {
      dispatch(setAuthState({ isLoading: false }));
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {
      dispatch(setAuthState({ isLoading: true, error: null }));
      
      // First, check if the Member role exists
      let memberRoleId: number;
      const { data: existingRole, error: roleCheckError } = await supabase
        .from('roles')
        .select('id')
        .eq('role_name', 'Member')
        .single();

      if (roleCheckError) {
        console.error('Error checking Member role:', roleCheckError);
        // If Member role doesn't exist, create it
        const { data: newRole, error: createRoleError } = await supabase
          .from('roles')
          .insert([
            {
              role_name: 'Member',
              description: 'Regular member with basic access',
            },
          ])
          .select()
          .single();

        if (createRoleError) {
          console.error('Error creating Member role:', createRoleError);
          throw new Error('Failed to create Member role: ' + createRoleError.message);
        }
        if (!newRole) throw new Error('Failed to create Member role: No data returned');
        memberRoleId = newRole.id;
      } else {
        if (!existingRole) throw new Error('Member role not found');
        memberRoleId = existingRole.id;
      }

      console.log('Member role ID:', memberRoleId);

      // Register the user with email confirmation disabled
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error('Error during sign up:', error);
        if (error.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw new Error('Failed to create user: ' + error.message);
      }

      if (!data.user) {
        throw new Error('No user data returned after registration');
      }

      console.log('User created with ID:', data.user.id);

      // Wait a short moment to ensure the user is fully created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a profile for the new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            user_id: data.user.id,
            full_name: fullName,
            designation: 'Member',
          },
        ])
        .select()
        .single();

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // If profile creation fails, we should clean up the user
        try {
          await supabase.auth.admin.deleteUser(data.user.id);
        } catch (deleteError) {
          console.error('Error deleting user after profile creation failure:', deleteError);
        }
        throw new Error('Failed to create profile: ' + profileError.message);
      }

      console.log('Profile created successfully');

      // Assign Member role to the user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([
          {
            user_id: data.user.id,
            role_id: memberRoleId,
          },
        ])
        .select()
        .single();

      if (roleError) {
        console.error('Error assigning role:', roleError);
        // If role assignment fails, we should clean up the user and profile
        try {
          await supabase.auth.admin.deleteUser(data.user.id);
        } catch (deleteError) {
          console.error('Error deleting user after role assignment failure:', deleteError);
        }
        throw new Error('Failed to assign role: ' + roleError.message);
      }

      console.log('Role assigned successfully');

      // Sign in the user after successful registration
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Error signing in after registration:', signInError);
        throw new Error('Failed to sign in after registration: ' + signInError.message);
      }

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      dispatch(setAuthState({
        error: error instanceof Error ? error.message : 'An error occurred during registration',
        isLoading: false,
      }));
      throw error;
    } finally {
      dispatch(setAuthState({ isLoading: false }));
    }
  };

  const signOut = async () => {
    try {
      dispatch(setAuthState({ isLoading: true }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear the auth state
      dispatch(setAuthState({
        user: null,
        role: null,
        isLoading: false,
        error: null,
      }));
      
      return true; // Return true to indicate successful sign-out
    } catch (error) {
      console.error('Sign out error:', error);
      dispatch(setAuthState({
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false,
      }));
      return false;
    }
  };

  return {
    user: authState.user,
    role: authState.role,
    isLoading: authState.isLoading,
    error: authState.error,
    isInitialized,
    signIn,
    register,
    signOut,
  };
}; 