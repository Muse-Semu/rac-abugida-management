import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchEvents } from "../../store/slices/eventSlice";
import { fetchProjects } from "../../store/slices/projectSlice";
import { fetchUsers } from "../../store/slices/userSlice";
import { Sidebar } from "../Layout/Sidebar";
import { DashboardTour } from "../Tour/DashboardTour";
import { EventList } from "../EventManager/EventList";
import { ProjectList } from "../ProjectManager/ProjectList";
import { UserList } from "../UserManager/UserList";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Calendar, Users, FolderOpen, Activity } from "lucide-react";
import { formatDistanceToNow, format, isAfter } from "date-fns";

export const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, role } = useAppSelector((state) => state.auth);
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "events" | "projects" | "users"
  >("dashboard");

  // Get data from Redux store
  const events = useAppSelector((state) => state.events.events);
  const projects = useAppSelector((state) => state.projects.projects);
  const users = useAppSelector((state) => state.users.users);

  // Combine and sort recent activities
  const recentActivities = [
    ...events.map((e) => ({
      type: "event",
      title: `New event: ${e.title}`,
      created_at: e.created_at,
    })),
    ...projects.map((p) => ({
      type: "project",
      title: `New project: ${p.name}`,
      created_at: p.created_at,
    })),
    ...users.map((u) => ({
      type: "user",
      title: `New user: ${u.full_name || u.email}`,
      created_at: u.created_at,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5); // Show only the 5 most recent

  // Get upcoming events
  const now = new Date();
  const upcomingEvents = events
    .filter((e) => isAfter(new Date(e.start_time), now))
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
    .slice(0, 3); // Show only the next 3

  useEffect(() => {
    // Fetch data based on role
    if (role?.role_name === "Admin") {
      dispatch(fetchEvents());
      dispatch(fetchProjects());
      dispatch(fetchUsers());
    } else if (role?.role_name === "Organizer") {
      dispatch(fetchEvents());
      dispatch(fetchProjects());
    } else {
      dispatch(fetchEvents());
    }
  }, [dispatch, role]);

  const renderContent = () => {
    switch (activeSection) {
      case "events":
        return <EventList />;
      case "projects":
        return <ProjectList />;
      case "users":
        return role?.role_name === "Admin" ? <UserList /> : null;
      default:
        return (
          <div className="p-6 space-y-6 bg-gray-100 min-h-screen">
            {/* Header */}
            <div className="border-b border-gray-200 pb-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                Welcome back, {user?.email}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Here's an overview of your events, projects, and team.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900">
                    Total Events
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {events.length}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900">
                    Active Projects
                  </CardTitle>
                  <FolderOpen className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {projects.length}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900">
                    Team Members
                  </CardTitle>
                  <Users className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {users.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity and Events */}
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-gray-900">
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivities.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        No recent activity.
                      </div>
                    ) : (
                      recentActivities.map((activity, idx) => (
                        <div className="flex items-center" key={idx}>
                          <div
                            className={`w-2 h-2 rounded-full mr-3 ${
                              activity.type === "event"
                                ? "bg-green-500"
                                : activity.type === "project"
                                ? "bg-blue-500"
                                : "bg-yellow-500"
                            }`}
                          ></div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {activity.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(
                                new Date(activity.created_at),
                                { addSuffix: true }
                              )}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-gray-900">
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingEvents.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        No upcoming events.
                      </div>
                    ) : (
                      upcomingEvents.map((event, idx) => (
                        <div key={idx}>
                          <p className="text-sm font-medium text-gray-900">
                            {event.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(
                              new Date(event.start_time),
                              "EEEE, MMM d, h:mm a"
                            )}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        onSectionChange={setActiveSection}
        activeSection={activeSection}
      />
      <div className="flex-1 overflow-auto">{renderContent()}</div>
      <DashboardTour />
    </div>
  );
};
