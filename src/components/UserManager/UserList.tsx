import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { supabase } from '../../supabaseClient';
import { User, Role, UserRole } from '../../types';

export const UserList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { role } = useAppSelector((state) => state.auth);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch users
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*');

        if (usersError) throw usersError;

        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('*');

        if (rolesError) throw rolesError;

        // Fetch user roles
        const { data: userRolesData, error: userRolesError } = await supabase
          .from('user_roles')
          .select('*, roles(*)');

        if (userRolesError) throw userRolesError;

        setUsers(usersData as User[]);
        setRoles(rolesData as Role[]);
        setUserRoles(userRolesData as UserRole[]);
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for user roles
    const subscription = supabase
      .channel('user_roles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newUserRole = payload.new as UserRole;
            setUserRoles((prev) => [...prev, newUserRole]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedUserRole = payload.new as UserRole;
            setUserRoles((prev) =>
              prev.map((ur) =>
                ur.user_id === updatedUserRole.user_id ? updatedUserRole : ur
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedUserRole = payload.old as UserRole;
            setUserRoles((prev) =>
              prev.filter((ur) => ur.user_id !== deletedUserRole.user_id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRoleChange = async (userId: string, newRoleId: number) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role_id: newRoleId,
        });

      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">{error}</div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Designation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const userRole = userRoles.find((ur) => ur.user_id === user.id);
              const role = roles.find((r) => r.id === userRole?.role_id);

              return (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.profile_image && (
                        <img
                          className="h-10 w-10 rounded-full"
                          src={user.profile_image}
                          alt=""
                        />
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.designation}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role?.role_name === 'Admin' ? (
                      <select
                        value={role?.id || ''}
                        onChange={(e) => handleRoleChange(user.id, Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Select Role</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.role_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {role?.role_name || 'No Role'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 