import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { Project } from "../../../types";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../hooks/use-toast";
import {
  updateProject,
  createProject,
  deleteProject,
} from "../../../store/slices/projectSlice";
import {
  Trash2,
  Copy,
  Archive,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ProjectDetails from "./ProjectDetails";

interface Collaborator {
  id: string;
  email: string;
  full_name: string;
  role_id?: number;
  role_name?: string;
}

interface ProjectCardProps {
  project: Project;
  currentUserId: string;
  setIsEditing: (id: number | null) => void;
  setFormData: (data: Partial<Project>) => void;
  setSelectedCollaborators: (collaborators: Collaborator[]) => void;
  setSelectedImages: (images: File[]) => void;
  setPrimaryImageIndex: (index: number) => void;
  setDeleteConfirmId: (id: number | null) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  currentUserId,
  setIsEditing,
  setFormData,
  setSelectedCollaborators,
  setSelectedImages,
  setPrimaryImageIndex,
  setDeleteConfirmId,
}) => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const handleEdit = async () => {
    setIsEditing(project.id);
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
    setFormData(formattedProject);

    const imageFiles = await Promise.all(
      (project.images || []).map(async (img) => {
        try {
          const response = await fetch(img.url);
          if (!response.ok)
            throw new Error(`Failed to fetch image: ${img.url}`);
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
    setSelectedCollaborators(project.collaborators || []);
  };

  const handleArchive = async () => {
    try {
      const updatedProject = { ...project, is_archived: !project.is_archived };
      const result = await dispatch(
        updateProject({ projectId: project.id, projectData: updatedProject })
      );
      if (updateProject.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
      toast({
        title: "Success",
        description: `Project ${
          project.is_archived ? "unarchived" : "archived"
        } successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to archive project",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async () => {
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
        title: "Success",
        description: "Project duplicated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate project",
        variant: "destructive",
      });
    }
  };

  const images = project.images || [];
  const primaryImage = images.find((img) => img.is_primary)?.url || "";

  return (
    <div className="relative bg-white rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="relative h-48 group">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={project.name}
            className="w-full h-full object-cover rounded-t-2xl transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              console.error("Primary image failed to load:", primaryImage);
              e.currentTarget.src =
                "https://via.placeholder.com/600x200?text=Image+Not+Found";
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-teal-400 to-purple-500 flex items-center justify-center rounded-t-2xl">
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
          <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="text-gray-600 hover:text-teal-600"
              title="Edit Project"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              className="text-gray-600 hover:text-teal-600"
              title={project.is_archived ? "Unarchive" : "Archive"}
            >
              <Archive className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
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
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="2"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
          onClick={() => setExpanded(!expanded)}
        >
          <span>{expanded ? "Hide Details" : "Show Details"}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>

        {expanded && <ProjectDetails project={project} />}
      </div>
    </div>
  );
};

export default ProjectCard;
