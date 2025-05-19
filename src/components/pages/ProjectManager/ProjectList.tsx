
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { supabase } from '../../../supabaseClient';
import { Project } from '../../../types';
import {
  fetchProjects,
  createProject,
  updateProject,
  addCollaborator,
  removeCollaborator,
  deleteProject,
} from '../../../store/slices/projectSlice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { useToast } from '../../../hooks/use-toast';
import { Trash2, Copy, Archive, Eye, Clock, Users, Tag, ChevronDown, ChevronUp } from 'lucide-react';

interface User {
  id: string;
  email: string;
  role?: {
    id: number;
    role_name: string;
  };
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  designation: string;
  is_active: boolean;
  created_at: string;
}

interface Collaborator {
  id: string;
  email: string;
  full_name: string;
  role_id?: number;
  role_name?: string;
}

export const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, loading, error } = useAppSelector((state) => state.projects);
  const { users, profiles } = useAppSelector((state) => state.users);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<Collaborator[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    description: '',
    status: 'Active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    budget: 0,
    progress_percentage: 0,
    tags: [],
    max_team_members: null,
    is_archived: false,
    project_type: 'Internal',
    project_target: 0,
    project_target_type: 'Revenue',
    project_manager_id: '',
    owner_id: '',
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (user) {
          setCurrentUserId(user.id);
          setFormData(prev => ({ ...prev, owner_id: user.id }));
        }
      } catch (error: any) {
        console.error('Error fetching current user:', error);
        toast({
          title: 'Error',
          description: 'Failed to authenticate user',
          variant: 'destructive',
        });
      }
    };
    getCurrentUser();
    dispatch(fetchProjects());
  }, [dispatch, toast]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      setSelectedImages([...selectedImages, ...newImages]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > index) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'Active',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      budget: 0,
      progress_percentage: 0,
      tags: [],
      max_team_members: null,
      is_archived: false,
      project_type: 'Internal',
      project_target: 0,
      project_target_type: 'Revenue',
      project_manager_id: '',
      owner_id: currentUserId,
    });
    setSelectedImages([]);
    setPrimaryImageIndex(0);
    setSelectedCollaborators([]);
    setIsCreating(false);
    setIsEditing(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const missingFields = [];
      if (!formData.name) missingFields.push('name');
      if (!formData.description) missingFields.push('description');
      if (!formData.start_date) missingFields.push('start_date');
      if (!formData.end_date) missingFields.push('end_date');
      if (formData.budget == null) missingFields.push('budget');
      if (formData.project_target == null) missingFields.push('project_target');

      if (missingFields.length > 0) {
        toast({
          title: 'Error',
          description: `Please fill in the following required fields: ${missingFields.join(', ')}`,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        toast({
          title: 'Error',
          description: 'End date must be after start date',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const imageUrls = await Promise.all(
        selectedImages.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from('project-images')
            .upload(fileName, file);

          if (error) {
            console.error('Image upload error:', error);
            throw new Error(`Failed to upload image: ${error.message}`);
          }
          const { data: publicUrlData } = supabase.storage
            .from('project-images')
            .getPublicUrl(data.path);
          return publicUrlData.publicUrl;
        })
      );

      const formattedData = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        budget: Number(formData.budget) || 0,
        project_target: Number(formData.project_target) || 0,
      };

      const projectData = {
        name: formattedData.name as string,
        description: formattedData.description as string,
        status: formattedData.status || 'Active',
        start_date: formattedData.start_date,
        end_date: formattedData.end_date,
        budget: formattedData.budget,
        progress_percentage: formattedData.progress_percentage || 0,
        tags: formattedData.tags || [],
        max_team_members: formattedData.max_team_members || null,
        is_archived: formattedData.is_archived || false,
        project_type: formattedData.project_type || 'Internal',
        project_target: formattedData.project_target,
        project_target_type: formattedData.project_target_type || 'Revenue',
        project_manager_id: formattedData.project_manager_id || '',
        owner_id: currentUserId,
        images: imageUrls.map((url, index) => ({
          url,
          is_primary: index === primaryImageIndex,
        })),
        collaborators: selectedCollaborators,
      } as Omit<Project, 'id' | 'created_at' | 'updated_at' | 'team_members_count'>;

      if (isEditing) {
        const result = await dispatch(updateProject({ projectId: isEditing, projectData }));
        if (updateProject.rejected.match(result)) {
          throw new Error(result.payload as string);
        }
        toast({
          title: 'Success',
          description: 'Project updated successfully',
        });
      } else {
        const result = await dispatch(createProject(projectData));
        if (createProject.rejected.match(result)) {
          throw new Error(result.payload as string);
        }
        toast({
          title: 'Success',
          description: 'Project created successfully',
        });
      }

      resetForm();
    } catch (error: any) {
      console.error('Error submitting project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit project. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (project: Project) => {
    setIsEditing(project.id);
    const formattedProject = {
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'Active',
      start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      budget: project.budget ?? 0,
      progress_percentage: project.progress_percentage ?? 0,
      tags: project.tags || [],
      max_team_members: project.max_team_members ?? null,
      is_archived: project.is_archived ?? false,
      project_type: project.project_type || 'Internal',
      project_target: project.project_target ?? 0,
      project_target_type: project.project_target_type || 'Revenue',
      project_manager_id: project.project_manager_id || '',
      owner_id: project.owner_id || currentUserId,
    };
    setFormData(formattedProject);

    const imageFiles = await Promise.all(
      (project.images || []).map(async (img) => {
        try {
          const response = await fetch(img.url);
          if (!response.ok) throw new Error(`Failed to fetch image: ${img.url}`);
          const blob = await response.blob();
          return new File([blob], img.url.split('/').pop() || 'image.jpg', { type: blob.type });
        } catch (error) {
          console.error('Error fetching image:', img.url, error);
          return null;
        }
      })
    ).then(files => files.filter((file): file is File => file !== null));

    setSelectedImages(imageFiles);
    const primaryIndex = project.images.findIndex(img => img.is_primary);
    setPrimaryImageIndex(primaryIndex >= 0 ? primaryIndex : 0);
    setSelectedCollaborators(project.collaborators || []);
  };

  const handleArchive = async (project: Project) => {
    try {
      const updatedProject = { ...project, is_archived: !project.is_archived };
      const result = await dispatch(updateProject({ projectId: project.id, projectData: updatedProject }));
      if (updateProject.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
      toast({
        title: 'Success',
        description: `Project ${project.is_archived ? 'unarchived' : 'archived'} successfully`,
      });
    } catch (error: any) {
      console.error('Error archiving project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive project',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (projectId: number) => {
    try {
      const result = await dispatch(deleteProject(projectId));
      if (deleteProject.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
      toast({
        title: 'Success',
        description: 'Project deleted successfully',
      });
      setDeleteConfirmId(null);
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete project. Check permissions or try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (project: Project) => {
    try {
      const duplicatedProject = {
        ...project,
        name: `${project.name} (Copy)`,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
      };
      const result = await dispatch(createProject(duplicatedProject));
      if (createProject.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
      toast({
        title: 'Success',
        description: 'Project duplicated successfully',
      });
    } catch (error: any) {
      console.error('Error duplicating project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate project',
        variant: 'destructive',
      });
    }
  };

  const getDaysUntilEnd = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const toggleProjectDetails = (projectId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  // Helper to get user display name
  const getUserDisplayName = (userId: string): string => {
    const profile = profiles.find(p => p.user_id === userId);
    const user = users.find(u => u.id === userId);
    return profile?.full_name || user?.email.split('@')[0] || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 pl-16 ">
      <div className="flex justify-between items-center mb-8 ">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Projects</h1>
        <Dialog
          open={isCreating || isEditing !== null}
          onOpenChange={(open) => {
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white transition-colors"
              onClick={() => setIsCreating(true)}
            >
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl bg-white rounded-2xl shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-gray-900">
                {isEditing ? 'Edit Project' : 'Create New Project'}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                {isEditing ? 'Update the project details below.' : 'Fill in the project details to create a new project.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium text-gray-700">Status</Label>
                  <Select
                    value={formData.status || 'Active'}
                    onValueChange={(value) => setFormData({ ...formData, status: value as Project['status'] })}
                  >
                    <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_type" className="text-sm font-medium text-gray-700">Project Type</Label>
                  <Select
                    value={formData.project_type || 'Internal'}
                    onValueChange={(value) => setFormData({ ...formData, project_type: value as Project['project_type'] })}
                  >
                    <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="External">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-sm font-medium text-gray-700">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-sm font-medium text-gray-700">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-sm font-medium text-gray-700">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget ?? ''}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value ? Number(e.target.value) : 0 })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="progress_percentage" className="text-sm font-medium text-gray-700">Progress Percentage</Label>
                  <Input
                    id="progress_percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress_percentage ?? ''}
                    onChange={(e) => setFormData({ ...formData, progress_percentage: Number(e.target.value) || 0 })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_target" className="text-sm font-medium text-gray-700">Project Target</Label>
                  <Input
                    id="project_target"
                    type="number"
                    value={formData.project_target ?? ''}
                    onChange={(e) => setFormData({ ...formData, project_target: e.target.value ? Number(e.target.value) : 0 })}
                    required
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_target_type" className="text-sm font-medium text-gray-700">Target Type</Label>
                  <Select
                    value={formData.project_target_type || 'Revenue'}
                    onValueChange={(value) => setFormData({ ...formData, project_target_type: value as Project['project_target_type'] })}
                  >
                    <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Revenue">Revenue</SelectItem>
                      <SelectItem value="Cost">Cost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_team_members" className="text-sm font-medium text-gray-700">Max Team Members</Label>
                  <Input
                    id="max_team_members"
                    type="number"
                    value={formData.max_team_members ?? ''}
                    onChange={(e) => setFormData({ ...formData, max_team_members: e.target.value ? Number(e.target.value) : null })}
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_manager_id" className="text-sm font-medium text-gray-700">Project Manager</Label>
                  <Select
                    value={formData.project_manager_id || ''}
                    onValueChange={(value) => setFormData({ ...formData, project_manager_id: value })}
                  >
                    <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                      <SelectValue placeholder="Select project manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter(user => {
                          const profile = profiles.find(p => p.user_id === user.id);
                          return profile?.is_active;
                        })
                        .map((user) => {
                          const profile = profiles.find(p => p.user_id === user.id);
                          return (
                            <SelectItem key={`manager-${user.id}`} value={user.id}>
                              {profile?.full_name || user.email.split('@')[0]}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-sm font-medium text-gray-700">Tags</Label>
                  <Input
                    id="tags"
                    type="text"
                    value={formData.tags?.join(', ') || ''}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()) })}
                    placeholder="Enter tags separated by commas"
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_archived"
                      checked={formData.is_archived ?? false}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_archived: checked as boolean })}
                    />
                    <Label htmlFor="is_archived" className="text-sm font-medium text-gray-700">Is Archived</Label>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Collaborators</Label>
                  <Select
                    onValueChange={(value) => {
                      const user = users.find(u => u.id === value);
                      const profile = profiles.find(p => p.user_id === value);
                      if (user && !selectedCollaborators.some(c => c.id === user.id)) {
                        setSelectedCollaborators([...selectedCollaborators, {
                          id: user.id,
                          email: user.email || '',
                          full_name: profile?.full_name || user.email.split('@')[0],
                          role_id: undefined,
                          role_name: user.role?.role_name || 'Member',
                        }]);
                      }
                    }}
                  >
                    <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                      <SelectValue placeholder="Select collaborators" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter(user => {
                          const profile = profiles.find(p => p.user_id === user.id);
                          return user.id !== currentUserId && profile?.is_active;
                        })
                        .map((user) => {
                          const profile = profiles.find(p => p.user_id === user.id);
                          return (
                            <SelectItem key={`select-${user.id}`} value={user.id}>
                              {profile?.full_name || user.email.split('@')[0]} - {user.role?.role_name || 'Member'}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCollaborators.map((collaborator) => (
                      <div key={`selected-${collaborator.id}`} className="flex items-center gap-2 bg-teal-100 px-3 py-1 rounded-full text-sm text-teal-800">
                        <span>{collaborator.full_name} ({collaborator.role_name || 'Member'})</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCollaborators(selectedCollaborators.filter(c => c.id !== collaborator.id))}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Images</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className={`w-full h-28 object-cover rounded-lg transition-transform duration-300 group-hover:scale-105 ${
                            index === primaryImageIndex ? 'ring-2 ring-teal-500' : ''
                          }`}
                          onClick={() => setPrimaryImageIndex(index)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                        {index === primaryImageIndex && (
                          <div className="absolute bottom-1 left-1 bg-teal-500 text-white text-xs px-2 py-0.5 rounded">
                            Primary
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {isSubmitting ? 'Submitting...' : isEditing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg max-w-7xl mx-auto">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {projects.map((project) => {
          console.log(`Project ${project.id} images:`, project.images); // Debug image URLs
          const images = project.images || [];
          const primaryImage = images.find(img => img.is_primary)?.url || '';
          const nonPrimaryImages = images.filter(img => !img.is_primary);
          const daysUntilEnd = getDaysUntilEnd(project.end_date);
          const isExpanded = expandedProjects.has(project.id);

          // Get owner and manager names
          const ownerName = getUserDisplayName(project.owner_id);
          const managerName = project.project_manager_id ? getUserDisplayName(project.project_manager_id) : 'None';

          return (
            <div
              key={project.id}
              className="relative bg-white rounded-2xl shadow-lg   transition-all duration-300 hover:shadow-xl"
            >
              <div className="relative h-48 group">
                {console.log("primary image", primaryImage)}
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt={project.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      console.error(
                        "Primary image failed to load:",
                        primaryImage
                      );
                      e.currentTarget.src =
                        "https://via.placeholder.com/600x200?text=Image+Not+Found";
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-teal-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-4xl font-bold">
                      {project.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-opacity-20 transition-opacity duration-300"></div>
                <div className="absolute top-4 right-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm ${
                      project.status === "Active"
                        ? "bg-teal-500"
                        : project.status === "Completed"
                        ? "bg-blue-500"
                        : project.status === "On Hold"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    {project.name}
                  </h3>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(project)}
                      className="text-gray-600 hover:text-teal-600"
                      title="Edit Project"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(project)}
                      className="text-gray-600 hover:text-teal-600"
                      title={project.is_archived ? "Unarchive" : "Archive"}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(project)}
                      className="text-gray-600 hover:text-teal-600"
                      title="Duplicate Project"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="text-gray-600 hover:text-red-600"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center mb-4">
                  <div className="relative w-12 h-12">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="2"
                        strokeDasharray={`${project.progress_percentage}, 100`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-teal-700">
                      {project.progress_percentage}%
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="text-sm text-gray-600">Progress</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${project.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full flex justify-between items-center text-teal-600 hover:bg-teal-50"
                  onClick={() => toggleProjectDetails(project.id)}
                >
                  <span>{isExpanded ? "Hide Details" : "Show Details"}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>

                {isExpanded && (
                  <div className="mt-4 space-y-4 animate-in fade-in duration-300">
                    <p className="text-gray-600 text-sm">
                      {project.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-teal-50 p-3 rounded-lg shadow-sm">
                        <div className="text-xs text-gray-500 flex items-center">
                          <Users className="w-4 h-4 mr-1" /> Budget
                        </div>
                        <div className="text-lg font-semibold text-teal-700">
                          ${project.budget.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-teal-50 p-3 rounded-lg shadow-sm">
                        <div className="text-xs text-gray-500 flex items-center">
                          <Users className="w-4 h-4 mr-1" /> Team
                        </div>
                        <div className="text-lg font-semibold text-teal-700">
                          {project.team_members_count}/
                          {project.max_team_members || "∞"}
                        </div>
                      </div>
                    </div>

                    <div className="bg-teal-50 p-3 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-500 flex items-center">
                        <Users className="w-4 h-4 mr-1" /> Team Details
                      </div>
                      <div className="text-sm text-teal-700 mt-2">
                        <p>
                          <span className="font-semibold">Owner:</span>{" "}
                          {ownerName}
                        </p>
                        <p>
                          <span className="font-semibold">Manager:</span>{" "}
                          {managerName}
                        </p>
                        <p>
                          <span className="font-semibold">Collaborators:</span>{" "}
                          {project.collaborators.length > 0
                            ? project.collaborators
                                .map(
                                  (c) =>
                                    `${c.full_name} (${
                                      c.role_name || "Member"
                                    })`
                                )
                                .join(", ")
                            : "None"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center text-xs text-gray-600">
                      <Clock className="w-4 h-4 mr-1" />
                      {new Date(project.start_date).toLocaleDateString()} -{" "}
                      {new Date(project.end_date).toLocaleDateString()}
                    </div>

                    <div className="flex items-center text-xs text-gray-600">
                      <Tag className="w-4 h-4 mr-1" />
                      <span>
                        Days Left: {daysUntilEnd > 0 ? daysUntilEnd : "Ended"}
                      </span>
                    </div>

                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-teal-100 te50xt-teal-700 text-xs rounded-full hover:bg-teal-200 transition-colors"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {images.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                          Image Gallery
                        </h4>
                        <div className="flex overflow-x-auto gap-3 pb-3">
                          {nonPrimaryImages.map((img, index) => (
                            <div
                              key={index}
                              className="relative group flex-shrink-0"
                            >
                              <img
                                src={img.url}
                                alt={`${project.name} image ${index + 1}`}
                                className="w-32 h-24 object-cover rounded-lg transition-transform duration-300 group-hover:scale-105 shadow-sm"
                                onError={(e) => {
                                  console.error(
                                    "Gallery image failed to load:",
                                    img.url
                                  );
                                  e.currentTarget.src =
                                    "https://via.placeholder.com/128x96?text=Image+Not+Found";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/10 bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-300"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {deleteConfirmId === project.id && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      Delete Project?
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Are you sure you want to delete "{project.name}"? This
                      action cannot be undone.
                    </p>
                    <div className="flex justify-end space-x-3">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteConfirmId(null)}
                        className="border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleDelete(project.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectList;
