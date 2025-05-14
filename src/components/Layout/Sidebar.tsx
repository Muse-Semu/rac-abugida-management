import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { useAuth } from '../../hooks/useAuth';
import {
  HomeIcon,
  CalendarIcon,
  FolderIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  onSectionChange: (section: 'dashboard' | 'events' | 'projects' | 'users') => void;
  activeSection: 'dashboard' | 'events' | 'projects' | 'users';
}

export const Sidebar: React.FC<SidebarProps> = ({ onSectionChange, activeSection }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, role, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      const success = await signOut();
      if (success) {
        navigate('/login');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', icon: HomeIcon, section: 'dashboard' as const },
    { name: 'Events', icon: CalendarIcon, section: 'events' as const },
    { name: 'Projects', icon: FolderIcon, section: 'projects' as const },
    { name: 'Users', icon: UsersIcon, section: 'users' as const },
    { name: 'Analytics', icon: ChartBarIcon, section: 'dashboard' as const },
    { name: 'Settings', icon: CogIcon, section: 'dashboard' as const },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="flex flex-col w-64">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 bg-gray-800">
          <h1 className="text-xl font-bold"></h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            // Hide Users link for non-admin users
            if (item.name === 'Users' && role?.role_name !== 'Admin') {
              return null;
            }
            return (
              <button
                key={item.name}
                onClick={() => onSectionChange(item.section)}
                className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  activeSection === item.section
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon className="w-6 h-6 mr-3" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.email}</p>
              <p className="text-xs text-gray-300">{role?.role_name}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-4 w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}; 