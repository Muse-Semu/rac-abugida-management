import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchEvents } from '../../store/slices/eventSlice';
import { fetchProjects } from '../../store/slices/projectSlice';
import { fetchUsers } from '../../store/slices/userSlice';
import { Sidebar } from '../Layout/Sidebar';
import { DashboardTour } from '../Tour/DashboardTour';
import { EventList } from '../EventManager/EventList';
import { ProjectList } from '../ProjectManager/ProjectList';
import { UserList } from '../UserManager/UserList';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Calendar, Users, FolderOpen, Activity } from "lucide-react";

export const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, role } = useAppSelector((state) => state.auth);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'events' | 'projects' | 'users'>('dashboard');

  useEffect(() => {
    // Fetch data based on role
    if (role?.role_name === 'Admin') {
      dispatch(fetchEvents());
      dispatch(fetchProjects());
      dispatch(fetchUsers());
    } else if (role?.role_name === 'Organizer') {
      dispatch(fetchEvents());
      dispatch(fetchProjects());
    } else {
      dispatch(fetchEvents());
    }
  }, [dispatch, role]);

  const renderContent = () => {
    switch (activeSection) {
      case 'events':
        return <EventList />;
      case 'projects':
        return <ProjectList />;
      case 'users':
        return role?.role_name === 'Admin' ? <UserList /> : null;
      default:
        return (
          <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">Welcome back, {user?.email}</h1>
                <p className="text-[hsl(var(--muted-foreground))]">Here's what's happening with your events and projects.</p>
              </div>
              <div className="flex gap-4">
                <Button onClick={() => setActiveSection('events')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  View Events
                </Button>
                <Button onClick={() => setActiveSection('projects')}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  View Projects
                </Button>
                {role?.role_name === 'Admin' && (
                  <Button onClick={() => setActiveSection('users')}>
                    <Users className="mr-2 h-4 w-4" />
                    View Users
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">+2 from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                  <FolderOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5</div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">+1 from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">+2 from last month</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      <div>
                        <p className="text-sm font-medium">New event created</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      <div>
                        <p className="text-sm font-medium">Project updated</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">4 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                      <div>
                        <p className="text-sm font-medium">New team member joined</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">1 day ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Team Meeting</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Tomorrow, 10:00 AM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Project Review</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Friday, 2:00 PM</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Client Presentation</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Next Monday, 11:00 AM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      <Sidebar onSectionChange={setActiveSection} activeSection={activeSection} />
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
      <DashboardTour />
    </div>
  );
}; 