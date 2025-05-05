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

  const register = async (email: string, password: string) => {
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

        if (createRoleError) throw createRoleError;
        if (!newRole) throw new Error('Failed to create Member role');
        memberRoleId = newRole.id;
      } else {
        if (!existingRole) throw new Error('Member role not found');
        memberRoleId = existingRole.id;
      }

      // Register the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw error;
      }

      if (data.user) {
        // Create a profile for the new user
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              user_id: data.user.id,
              email: data.user.email,
              designation: 'Member',
            },
          ]);

        if (profileError) throw profileError;

        // Assign Member role to the user
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            {
              user_id: data.user.id,
              role_id: memberRoleId,
            },
          ]);

        if (roleError) throw roleError;

        // Sign in the user after successful registration
        await signIn(email, password);
      }
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

  const signOut = async () => {
    try {
      dispatch(setAuthState({ isLoading: true }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
      dispatch(setAuthState({
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false,
      }));
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