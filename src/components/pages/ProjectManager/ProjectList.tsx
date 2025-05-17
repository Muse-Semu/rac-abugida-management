import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { supabase } from '../../../supabaseClient';
import { Project } from '../../../types';
import {
  fetchProjects,
  createProject,
  updateProject,
  addCollaborator,
  removeCollaborator
} from '../../../store/slices/projectSlice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { useToast } from '../../../hooks/use-toast';
export const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, loading, error } = useAppSelector((state) => state.projects);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
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
  });

  useEffect(() => {
    dispatch(fetchProjects());
    fetchUsers();
  }, [dispatch]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Format dates to ISO string
      const formattedData = {
        ...formData,
        start_date: new Date(formData.start_date!).toISOString(),
        end_date: new Date(formData.end_date!).toISOString(),
      };

      // Upload images first
      const imageUrls = await Promise.all(
        selectedImages.map(async (image) => {
          const fileExt = image.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from('project-images')
            .upload(fileName, image);
          if (error) throw error;
          return data.path;
        })
      );

      const projectData = {
        ...formattedData,
        primary_image: imageUrls[primaryImageIndex],
        images: imageUrls,
        owner_id: (await supabase.auth.getUser()).data.user?.id,
      };

      if (isEditing) {
        await dispatch(updateProject({ projectId: isEditing, projectData }));
      } else {
        await dispatch(createProject(projectData as Omit<Project, 'id' | 'created_at' | 'updated_at' | 'team_members_count'>));
      }

      // Add collaborators
      for (const userId of selectedCollaborators) {
        await dispatch(addCollaborator({ projectId: isEditing || 0, userId }));
      }

      toast({
        title: isEditing ? "Project Updated" : "Project Created",
        description: isEditing ? "Your project has been updated successfully." : "Your project has been created successfully.",
        variant: "default",
      });

      setIsCreating(false);
      setIsEditing(null);
      setSelectedImages([]);
      setSelectedCollaborators([]);
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
      });
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save project. Please check your permissions and try again.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (project: Project) => {
    setIsEditing(project.id);
    setFormData(project);
    setSelectedCollaborators(project.collaborators || []);
    setPrimaryImageIndex(project.images?.indexOf(project.primary_image) || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 ml-14">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog 
          open={isCreating || isEditing !== null} 
          onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              setIsEditing(null);
              setSelectedImages([]);
              setSelectedCollaborators([]);
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
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreating(true)}>Create Project</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Project' : 'Create New Project'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update the project details below.' : 'Fill in the project details below to create a new project.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as Project['status'] })}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="project_type">Project Type</Label>
                  <Select
                    value={formData.project_type}
                    onValueChange={(value) => setFormData({ ...formData, project_type: value as Project['project_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="External">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="progress">Progress Percentage</Label>
                  <Input
                    id="progress"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress_percentage}
                    onChange={(e) => setFormData({ ...formData, progress_percentage: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Project Target</Label>
                  <Input
                    id="target"
                    type="number"
                    value={formData.project_target}
                    onChange={(e) => setFormData({ ...formData, project_target: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_type">Target Type</Label>
                  <Select
                    value={formData.project_target_type}
                    onValueChange={(value) => setFormData({ ...formData, project_target_type: value as Project['project_target_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Revenue">Revenue</SelectItem>
                      <SelectItem value="Cost">Cost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_team">Max Team Members</Label>
                  <Input
                    id="max_team"
                    type="number"
                    value={formData.max_team_members || ''}
                    onChange={(e) => setFormData({ ...formData, max_team_members: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    type="text"
                    value={formData.tags?.join(', ')}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()) })}
                    placeholder="Enter tags separated by commas"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Collaborators</Label>
                  <Select
                    onValueChange={(value) => setSelectedCollaborators([...selectedCollaborators, value])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collaborators" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCollaborators.map((userId) => {
                      const user = users.find(u => u.id === userId);
                      return user ? (
                        <div key={userId} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded">
                          <span>{user.email}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCollaborators(selectedCollaborators.filter(id => id !== userId))}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Images</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className={`w-full h-24 object-cover rounded ${
                            index === primaryImageIndex ? 'ring-2 ring-indigo-500' : ''
                          }`}
                          onClick={() => setPrimaryImageIndex(index)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                        >
                          ×
                        </button>
                        {index === primaryImageIndex && (
                          <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 text-white text-xs text-center">
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
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(null);
                    setSelectedImages([]);
                    setSelectedCollaborators([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="text-red-500 text-center p-4">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <Button
                variant="ghost"
                onClick={() => handleEdit(project)}
              >
                Edit
              </Button>
            </div>
            <p className="text-gray-600 mb-4">{project.description}</p>
            <div className="text-sm text-gray-500 space-y-2">
              <div>Status: {project.status}</div>
              <div>Type: {project.project_type}</div>
              <div>Budget: ${project.budget}</div>
              <div>Progress: {project.progress_percentage}%</div>
              <div>Target: ${project.project_target} ({project.project_target_type})</div>
              <div>Team Members: {project.team_members_count}/{project.max_team_members || '∞'}</div>
              <div>Start: {new Date(project.start_date).toLocaleDateString()}</div>
              <div>End: {new Date(project.end_date).toLocaleDateString()}</div>
              <div>Tags: {project.tags?.join(', ')}</div>
            </div>
            {project.primary_image && (
              <img
                src={project.primary_image}
                alt={project.name}
                className="mt-4 w-full h-48 object-cover rounded"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 