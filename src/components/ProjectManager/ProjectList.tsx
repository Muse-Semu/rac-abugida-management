import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { supabase } from '../../supabaseClient';
import { Project } from '../../types';
import {
  setProjects,
  addProject,
  updateProject,
  removeProject,
  setLoading,
  setError,
} from '../../store/slices/projectSlice';

export const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, isLoading, error } = useAppSelector((state) => state.projects);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    description: '',
    status: 'Active',
  });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        dispatch(setLoading(true));
        
        const { data: projects, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        dispatch(setProjects(projects as Project[]));
        dispatch(setError(null));
      } catch (error) {
        dispatch(setError(error instanceof Error ? error.message : 'An error occurred'));
      } finally {
        dispatch(setLoading(false));
      }
    };

    fetchProjects();

    // Set up real-time subscription
    const subscription = supabase
      .channel('projects_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            dispatch(addProject(payload.new as Project));
          } else if (payload.eventType === 'UPDATE') {
            dispatch(updateProject(payload.new as Project));
          } else if (payload.eventType === 'DELETE') {
            dispatch(removeProject(payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([newProject])
        .select()
        .single();

      if (error) throw error;

      setIsCreating(false);
      setNewProject({
        name: '',
        description: '',
        status: 'Active',
      });
    } catch (error) {
      dispatch(setError(error instanceof Error ? error.message : 'An error occurred'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Create Project
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateProject} className="mb-6 p-4 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={newProject.status}
                onChange={(e) => setNewProject({ ...newProject, status: e.target.value as Project['status'] })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="text-red-500 text-center p-4">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${
                project.status === 'Active' ? 'bg-green-100 text-green-800' :
                project.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {project.status}
              </span>
            </div>
            <p className="text-gray-600 mb-4">{project.description}</p>
            <div className="text-sm text-gray-500">
              Created: {new Date(project.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 