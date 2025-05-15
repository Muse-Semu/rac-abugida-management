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

  const register = async (email: string, password: string, fullName: string, designation: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
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
            full_name: fullName,
            designation: designation,
          });

        if (profileError) throw profileError;

        // Note: Role assignment will be handled by admin through the UserManagement page
      }

      return { success: true };
    } catch (error) {
      console.error('Error in registration:', error);
      return { success: false, error };
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