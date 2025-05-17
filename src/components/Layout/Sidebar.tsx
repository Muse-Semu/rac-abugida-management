import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../store/hooks";
import { useAuth } from "../../hooks/useAuth";
import {
  HomeIcon,
  CalendarIcon,
  FolderIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

interface SidebarProps {
  onSectionChange: (
    section: "dashboard" | "events" | "projects" | "users"
  ) => void;
  activeSection: "dashboard" | "events" | "projects" | "users";
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSectionChange,
  activeSection,
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, role, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      const success = await signOut();
      if (success) {
        navigate("/login");
      }
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigation = [
    { name: "Dashboard", icon: HomeIcon, section: "dashboard" as const },
    { name: "Events", icon: CalendarIcon, section: "events" as const },
    { name: "Projects", icon: FolderIcon, section: "projects" as const },
    { name: "Users", icon: UsersIcon, section: "users" as const },
    { name: "Analytics", icon: ChartBarIcon, section: "dashboard" as const },
    { name: "Settings", icon: CogIcon, section: "dashboard" as const },
  ];

  return (
    <div className="h-screen flex inset-0  bg-opacity-50 fixed w-16 hover:w-64  z-10 ">
      <div className="group flex flex-col h-full bg-gray-800  text-white transition-all duration-300 w-16 hover:w-64  shadow-lg">
        {/* Logo */}
        <div className="flex items-center h-16 px-4 bg-gray-900">
          <h1 className="text-xl font-bold truncate opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Abugida
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            if (item.name === "Users" && role?.role_name !== "Admin") {
              return null;
            }
            return (
              <button
                key={item.name}
                onClick={() => onSectionChange(item.section)}
                className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  activeSection === item.section
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-600 hover:text-white"
                } transition-colors duration-200`}
              >
                <item.icon className="w-6 h-6 flex-shrink-0" />
                <span className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 truncate">
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-sm font-medium text-white truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-400">{role?.role_name}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-4 w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-600 rounded-md"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Sign out
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
