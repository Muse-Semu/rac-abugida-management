import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProjects } from "../../../store/slices/projectSlice";
import { Dialog, DialogTrigger } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../hooks/use-toast";
import { supabase } from "../../../supabaseClient";
import ProjectCard from "./ProjectCard";
import ProjectForm from "./ProjectForm";
import DeleteConfirmation from "./DeleteConfirmation";
import { Project } from "../../../types";

export const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, loading, error } = useAppSelector(
    (state) => state.projects
  );
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
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
  const [selectedCollaborators, setSelectedCollaborators] = useState([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 pl-16 border-2">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Projects
        </h1>
        <Dialog
          open={isCreating || isEditing !== null}
          onOpenChange={(open) => {
            if (!open) resetForm();
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
          <ProjectForm
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
            selectedCollaborators={selectedCollaborators}
            setSelectedCollaborators={setSelectedCollaborators}
            selectedImages={selectedImages}
            setSelectedImages={setSelectedImages}
            primaryImageIndex={primaryImageIndex}
            setPrimaryImageIndex={setPrimaryImageIndex}
            currentUserId={currentUserId}
            resetForm={resetForm}
          />
        </Dialog>
      </div>

      {error && (
        <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg max-w-7xl mx-auto">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            currentUserId={currentUserId}
            setIsEditing={setIsEditing}
            setFormData={setFormData}
            setSelectedCollaborators={setSelectedCollaborators}
            setSelectedImages={setSelectedImages}
            setPrimaryImageIndex={setPrimaryImageIndex}
            setDeleteConfirmId={setDeleteConfirmId}
          />
        ))}
      </div>

      {deleteConfirmId && (
        <DeleteConfirmation
          project={projects.find((p) => p.id === deleteConfirmId)!}
          onConfirm={() => setDeleteConfirmId(null)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
};

export default ProjectList;
