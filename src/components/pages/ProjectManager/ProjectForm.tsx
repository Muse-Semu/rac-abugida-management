import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { supabase } from "../../../supabaseClient";
import { Project } from "../../../types";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  createProject,
  updateProject,
} from "../../../store/slices/projectSlice";

interface Collaborator {
  id: string;
  email: string;
  full_name: string;
  role_id?: number;
  role_name?: string;
}

interface ProjectFormProps {
  isEditing: number | null;
  formData: Partial<Project>;
  setFormData: (data: Partial<Project>) => void;
  selectedCollaborators: Collaborator[];
  setSelectedCollaborators: (collaborators: Collaborator[]) => void;
  selectedImages: File[];
  setSelectedImages: (images: File[]) => void;
  primaryImageIndex: number;
  setPrimaryImageIndex: (index: number) => void;
  currentUserId: string;
  resetForm: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  isEditing,
  formData,
  setFormData,
  selectedCollaborators,
  setSelectedCollaborators,
  selectedImages,
  setSelectedImages,
  primaryImageIndex,
  setPrimaryImageIndex,
  currentUserId,
  resetForm,
}) => {
  const dispatch = useAppDispatch();
  const { users, profiles } = useAppSelector((state) => state.users);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);

    try {
      const missingFields = [];
      if (!formData.name) missingFields.push("name");
      if (!formData.description) missingFields.push("description");
      if (!formData.start_date) missingFields.push("start_date");
      if (!formData.end_date) missingFields.push("end_date");
      if (formData.budget == null) missingFields.push("budget");
      if (formData.project_target == null) missingFields.push("project_target");

      if (missingFields.length > 0) {
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

      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const imageUrls = await Promise.all(
        selectedImages.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from("project-images")
            .upload(fileName, file);

          if (error)
            throw new Error(`Failed to upload image: ${error.message}`);
          const { data: publicUrlData } = supabase.storage
            .from("project-images")
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

      if (isEditing) {
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
      toast({
        title: "Error",
        description:
          error.message || "Failed to submit project. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-4xl bg-white rounded-2xl shadow-xl">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold text-gray-900">
          {isEditing ? "Edit Project" : "Create New Project"}
        </DialogTitle>
        <DialogDescription className="text-gray-600">
          {isEditing
            ? "Update the project details below."
            : "Fill in the project details to create a new project."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-gray-700"
            >
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="status"
              className="text-sm font-medium text-gray-700"
            >
              Status
            </Label>
            <Select
              value={formData.status || "Active"}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as Project["status"] })
              }
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
            <Label
              htmlFor="project_type"
              className="text-sm font-medium text-gray-700"
            >
              Project Type
            </Label>
            <Select
              value={formData.project_type || "Internal"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  project_type: value as Project["project_type"],
                })
              }
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
            <Label
              htmlFor="start_date"
              className="text-sm font-medium text-gray-700"
            >
              Start Date
            </Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, start_date: e.target.value })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="end_date"
              className="text-sm font-medium text-gray-700"
            >
              End Date
            </Label>
            <Input
              id="end_date"
              type="date"
              value={formData.end_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, end_date: e.target.value })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="budget"
              className="text-sm font-medium text-gray-700"
            >
              Budget
            </Label>
            <Input
              id="budget"
              type="number"
              value={formData.budget ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  budget: e.target.value ? Number(e.target.value) : 0,
                })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="progress_percentage"
              className="text-sm font-medium text-gray-700"
            >
              Progress Percentage
            </Label>
            <Input
              id="progress_percentage"
              type="number"
              min="0"
              max="100"
              value={formData.progress_percentage ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  progress_percentage: Number(e.target.value) || 0,
                })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="project_target"
              className="text-sm font-medium text-gray-700"
            >
              Project Target
            </Label>
            <Input
              id="project_target"
              type="number"
              value={formData.project_target ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  project_target: e.target.value ? Number(e.target.value) : 0,
                })
              }
              required
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="project_target_type"
              className="text-sm font-medium text-gray-700"
            >
              Target Type
            </Label>
            <Select
              value={formData.project_target_type || "Revenue"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  project_target_type: value as Project["project_target_type"],
                })
              }
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
            <Label
              htmlFor="max_team_members"
              className="text-sm font-medium text-gray-700"
            >
              Max Team Members
            </Label>
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
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="project_manager_id"
              className="text-sm font-medium text-gray-700"
            >
              Project Manager
            </Label>
            <Select
              value={formData.project_manager_id || ""}
              onValueChange={(value) =>
                setFormData({ ...formData, project_manager_id: value })
              }
            >
              <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                <SelectValue placeholder="Select project manager" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((user) => {
                    const profile = profiles.find((p) => p.user_id === user.id);
                    return profile?.is_active;
                  })
                  .map((user) => {
                    const profile = profiles.find((p) => p.user_id === user.id);
                    return (
                      <SelectItem key={`manager-${user.id}`} value={user.id}>
                        {profile?.full_name || user.email.split("@")[0]}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm font-medium text-gray-700">
              Tags
            </Label>
            <Input
              id="tags"
              type="text"
              value={formData.tags?.join(", ") || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value.split(",").map((tag) => tag.trim()),
                })
              }
              placeholder="Enter tags separated by commas"
              className="border-gray-300 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_archived"
                checked={formData.is_archived ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_archived: checked as boolean })
                }
              />
              <Label
                htmlFor="is_archived"
                className="text-sm font-medium text-gray-700"
              >
                Is Archived
              </Label>
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Collaborators
            </Label>
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
                      full_name: profile?.full_name || user.email.split("@")[0],
                      role_id: undefined,
                      role_name: user.role?.role_name || "Member",
                    },
                  ]);
                }
              }}
            >
              <SelectTrigger className="border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                <SelectValue placeholder="Select collaborators" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((user) => {
                    const profile = profiles.find((p) => p.user_id === user.id);
                    return user.id !== currentUserId && profile?.is_active;
                  })
                  .map((user) => {
                    const profile = profiles.find((p) => p.user_id === user.id);
                    return (
                      <SelectItem key={`select-${user.id}`} value={user.id}>
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
                  className="flex items-center gap-2 bg-teal-100 px-3 py-1 rounded-full text-sm text-teal-800"
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
                      index === primaryImageIndex ? "ring-2 ring-teal-500" : ""
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
            {isSubmitting ? "Submitting..." : isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};

export default ProjectForm;
