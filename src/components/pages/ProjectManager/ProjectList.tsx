import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { supabase } from "../../../supabaseClient";
import { Project } from "../../../types";
import {
  fetchProjects,
  createProject,
  updateProject,
  addCollaborator,
  removeCollaborator,
} from "../../../store/slices/projectSlice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Checkbox } from "../../../components/ui/checkbox";
import { useToast } from "../../../hooks/use-toast";

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
  const { projects, loading, error } = useAppSelector(
    (state) => state.projects
  );
  const { users, profiles } = useAppSelector((state) => state.users);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<
    Collaborator[]
  >([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [formData, setFormData] = useState<Partial<Project>>({
    name: "",
    description: "",
    status: "Active",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    budget: 0,
    progress_percentage: 0,
    tags: [],
    max_team_members: null,
    is_archived: false,
    project_type: "Internal",
    project_target: 0,
    project_target_type: "Revenue",
    project_manager_id: "",
    owner_id: "",
  });

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;
        if (user) {
          setCurrentUserId(user.id);
          setFormData((prev) => ({ ...prev, owner_id: user.id }));
        }
      } catch (error: any) {
        console.error("Error fetching current user:", error);
        toast({
          title: "Error",
          description: "Failed to authenticate user",
          variant: "destructive",
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
      name: "",
      description: "",
      status: "Active",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      budget: 0,
      progress_percentage: 0,
      tags: [],
      max_team_members: null,
      is_archived: false,
      project_type: "Internal",
      project_target: 0,
      project_target_type: "Revenue",
      project_manager_id: "",
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
    console.log("Form submitted, formData:", formData); // Debug log
    setIsSubmitting(true);

    try {
      // Validate required fields with detailed logging
      const missingFields = [];
      if (!formData.name) missingFields.push("name");
      if (!formData.description) missingFields.push("description");
      if (!formData.start_date) missingFields.push("start_date");
      if (!formData.end_date) missingFields.push("end_date");
      if (formData.budget == null) missingFields.push("budget");
      if (formData.project_target == null) missingFields.push("project_target");

      if (missingFields.length > 0) {
        console.error("Validation failed, missing fields:", missingFields);
        toast({
          title: "Error",
          description: `Please fill in the following required fields: ${missingFields.join(
            ", "
          )}`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validate dates
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        console.error("Validation failed: End date before start date");
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Upload images
      console.log("Uploading images:", selectedImages.length);
      const imageUrls = await Promise.all(
        selectedImages.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from("project-images")
            .upload(fileName, file);

          if (error) {
            console.error("Image upload error:", error);
            throw new Error(`Failed to upload image: ${error.message}`);
          }
          return supabase.storage.from("project-images").getPublicUrl(data.path)
            .data.publicUrl;
        })
      );

      const formattedData = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        budget: Number(formData.budget) || 0, // Ensure number
        project_target: Number(formData.project_target) || 0, // Ensure number
      };

      // Prepare project data
      const projectData = {
        name: formattedData.name as string,
        description: formattedData.description as string,
        status: formattedData.status || "Active",
        start_date: formattedData.start_date,
        end_date: formattedData.end_date,
        budget: formattedData.budget,
        progress_percentage: formattedData.progress_percentage || 0,
        tags: formattedData.tags || [],
        max_team_members: formattedData.max_team_members || null,
        is_archived: formattedData.is_archived || false,
        project_type: formattedData.project_type || "Internal",
        project_target: formattedData.project_target,
        project_target_type: formattedData.project_target_type || "Revenue",
        project_manager_id: formattedData.project_manager_id || "",
        owner_id: currentUserId,
        images: imageUrls.map((url, index) => ({
          url,
          is_primary: index === primaryImageIndex,
        })),
        collaborators: selectedCollaborators,
      } as Omit<
        Project,
        "id" | "created_at" | "updated_at" | "team_members_count"
      >;

      console.log("Submitting project data:", projectData);

      if (isEditing) {
        console.log("Updating project ID:", isEditing);
        const result = await dispatch(
          updateProject({ projectId: isEditing, projectData })
        );
        if (updateProject.rejected.match(result)) {
          throw new Error(result.payload as string);
        }
        toast({
          title: "Success",
          description: "Project updated successfully",
        });
      } else {
        console.log("Creating new project");
        const result = await dispatch(createProject(projectData));
        if (createProject.rejected.match(result)) {
          throw new Error(result.payload as string);
        }
        toast({
          title: "Success",
          description: "Project created successfully",
        });
      }

      resetForm();
    } catch (error: any) {
      console.error("Error submitting project:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to submit project. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (project: Project) => {
    console.log("Editing project:", project); // Debug log
    setIsEditing(project.id);

    // Ensure all required fields are set with fallbacks
    const formattedProject = {
      name: project.name || "",
      description: project.description || "",
      status: project.status || "Active",
      start_date: project.start_date
        ? new Date(project.start_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      end_date: project.end_date
        ? new Date(project.end_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      budget: project.budget ?? 0,
      progress_percentage: project.progress_percentage ?? 0,
      tags: project.tags || [],
      max_team_members: project.max_team_members ?? null,
      is_archived: project.is_archived ?? false,
      project_type: project.project_type || "Internal",
      project_target: project.project_target ?? 0,
      project_target_type: project.project_target_type || "Revenue",
      project_manager_id: project.project_manager_id || "",
      owner_id: project.owner_id || currentUserId,
    };

    console.log("Setting formData for edit:", formattedProject); // Debug log
    setFormData(formattedProject);

    // Set selected images and primary image index
    const imageFiles = await Promise.all(
      (project.images || []).map(async (img) => {
        try {
          const response = await fetch(img.url);
          const blob = await response.blob();
          return new File([blob], img.url.split("/").pop() || "image.jpg", {
            type: blob.type,
          });
        } catch (error) {
          console.error("Error fetching image:", img.url, error);
          return null;
        }
      })
    ).then((files) => files.filter((file): file is File => file !== null));

    setSelectedImages(imageFiles);
    const primaryIndex = project.images.findIndex((img) => img.is_primary);
    setPrimaryImageIndex(primaryIndex >= 0 ? primaryIndex : 0);

    // Set selected collaborators
    setSelectedCollaborators(project.collaborators || []);
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
            console.log("Dialog open state changed:", open);
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                console.log("Opening create dialog");
                setIsCreating(true);
              }}
            >
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Project" : "Create New Project"}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update the project details below."
                  : "Fill in the project details below to create a new project."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || "Active"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as Project["status"],
                      })
                    }
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
                    value={formData.project_type || "Internal"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        project_type: value as Project["project_type"],
                      })
                    }
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
                    value={formData.start_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget ?? ""} // Use empty string if undefined
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budget: e.target.value ? Number(e.target.value) : 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="progress_percentage">
                    Progress Percentage
                  </Label>
                  <Input
                    id="progress_percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress_percentage ?? ""} // Use empty string if undefined
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        progress_percentage: Number(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_target">Project Target</Label>
                  <Input
                    id="project_target"
                    type="number"
                    value={formData.project_target ?? ""} // Use empty string if undefined
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        project_target: e.target.value
                          ? Number(e.target.value)
                          : 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_target_type">Target Type</Label>
                  <Select
                    value={formData.project_target_type || "Revenue"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        project_target_type:
                          value as Project["project_target_type"],
                      })
                    }
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
                  <Label htmlFor="max_team_members">Max Team Members</Label>
                  <Input
                    id="max_team_members"
                    type="number"
                    value={formData.max_team_members ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_team_members: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_manager_id">Project Manager</Label>
                  <Select
                    value={formData.project_manager_id || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, project_manager_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((user) => {
                          const profile = profiles.find(
                            (p) => p.user_id === user.id
                          );
                          return profile?.is_active;
                        })
                        .map((user) => {
                          const profile = profiles.find(
                            (p) => p.user_id === user.id
                          );
                          return (
                            <SelectItem
                              key={`manager-${user.id}`}
                              value={user.id}
                            >
                              {profile?.full_name || user.email.split("@")[0]}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    type="text"
                    value={formData.tags?.join(", ") || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tags: e.target.value
                          .split(",")
                          .map((tag) => tag.trim()),
                      })
                    }
                    placeholder="Enter tags separated by commas"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_archived"
                      checked={formData.is_archived ?? false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          is_archived: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="is_archived">Is Archived</Label>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Collaborators</Label>
                  <Select
                    onValueChange={(value) => {
                      const user = users.find((u) => u.id === value);
                      const profile = profiles.find((p) => p.user_id === value);
                      if (
                        user &&
                        !selectedCollaborators.some((c) => c.id === user.id)
                      ) {
                        setSelectedCollaborators([
                          ...selectedCollaborators,
                          {
                            id: user.id,
                            email: user.email || "",
                            full_name:
                              profile?.full_name || user.email.split("@")[0],
                            role_id: undefined,
                            role_name: user.role?.role_name || "Member",
                          },
                        ]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collaborators" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((user) => {
                          const profile = profiles.find(
                            (p) => p.user_id === user.id
                          );
                          return (
                            user.id !== currentUserId && profile?.is_active
                          );
                        })
                        .map((user) => {
                          const profile = profiles.find(
                            (p) => p.user_id === user.id
                          );
                          return (
                            <SelectItem
                              key={`select-${user.id}`}
                              value={user.id}
                            >
                              {profile?.full_name || user.email.split("@")[0]} -{" "}
                              {user.role?.role_name || "Member"}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCollaborators.map((collaborator) => (
                      <div
                        key={`selected-${collaborator.id}`}
                        className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded"
                      >
                        <span>
                          {collaborator.full_name} (
                          {collaborator.role_name || "Member"})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCollaborators(
                              selectedCollaborators.filter(
                                (c) => c.id !== collaborator.id
                              )
                            )
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
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
                            index === primaryImageIndex
                              ? "ring-2 ring-indigo-500"
                              : ""
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
                    console.log("Cancel button clicked");
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={() => console.log("Submit button clicked")}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : isEditing
                    ? "Update"
                    : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="text-red-500 text-center p-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const images = project.images || [];
          const primaryImage = images.find((img) => img.is_primary)?.url;

          return (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="relative h-48">
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt={project.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {project.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute top-4 right-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      project.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : project.status === "Completed"
                        ? "bg-blue-100 text-blue-800"
                        : project.status === "On Hold"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {project.project_type}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(project)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Edit
                  </Button>
                </div>

                <p className="text-gray-600 mb-4 line-clamp-2">
                  {project.description}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Budget</div>
                    <div className="text-lg font-semibold">
                      ${project.budget.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Team Size</div>
                    <div className="text-lg font-semibold">
                      {project.team_members_count}/
                      {project.max_team_members || "∞"}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{project.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress_percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {new Date(project.start_date).toLocaleDateString()} -{" "}
                  {new Date(project.end_date).toLocaleDateString()}
                </div>

                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {project.collaborators && project.collaborators.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Collaborators
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {project.collaborators.map((collaborator) => (
                        <div
                          key={collaborator.id}
                          className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full text-sm"
                        >
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 text-xs font-medium">
                              {collaborator.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-medium">
                              {collaborator.full_name} (
                              {collaborator.role_name || "Member"})
                            </span>
                            <span className="text-gray-500 text-xs">
                              {collaborator.email}
                            </span>
                          </div>
                          {(project.owner_id === currentUserId ||
                            project.project_manager_id === currentUserId) && (
                            <button
                              type="button"
                              onClick={() =>
                                dispatch(
                                  removeCollaborator({
                                    projectId: project.id,
                                    userId: collaborator.id,
                                  })
                                )
                              }
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.slice(0, 4).map((img, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={img.url}
                          alt={`${project.name} image ${index + 1}`}
                          className={`w-full h-full object-cover rounded-lg ${
                            img.is_primary ? "ring-2 ring-indigo-500" : ""
                          }`}
                        />
                        {img.is_primary && (
                          <div className="absolute bottom-1 left-1 bg-indigo-500 text-white text-xs px-1 rounded">
                            Primary
                          </div>
                        )}
                      </div>
                    ))}
                    {images.length > 4 && (
                      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-500 text-sm">
                          +{images.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectList;
