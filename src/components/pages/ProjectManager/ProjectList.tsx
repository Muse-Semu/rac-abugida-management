import React, { useEffect, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { fetchProjects } from "../../../store/slices/projectSlice";
import { Dialog, DialogTrigger } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { useToast } from "../../../hooks/use-toast";
import { supabase } from "../../../supabaseClient";
import ProjectForm from "./ProjectForm";
import DeleteConfirmation from "./DeleteConfirmation";
import ProjectDetails from "./ProjectDetails";
import { Project } from "../../../types";
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FullScreenImageModalProps {
  images: { url: string; is_primary: boolean }[];
  initialIndex: number;
  onClose: () => void;
}

const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({
  images,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrev = () =>
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const handleNext = () =>
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = images[currentIndex].url;
    link.download = `project-image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed  inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
      role="dialog"
      aria-label="Full-screen image viewer"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowLeft") handlePrev();
        if (e.key === "ArrowRight") handleNext();
      }}
      tabIndex={0}
    >
      <div className="relative  w-full h-full max-w-5xl max-h-[90vh] flex items-center justify-center">
        <img
          src={images[currentIndex].url}
          alt={`Project image ${currentIndex + 1}`}
          className="w-full h-full object-contain"
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
          aria-label="Close full-screen image"
        >
          <X className="w-6 h-6" />
        </button>
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
        <button
          onClick={handleDownload}
          className="absolute bottom-4 right-4 text-white bg-teal-600 rounded-full p-2 hover:bg-teal-700"
          aria-label="Download image"
        >
          <Download className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projects, loading, error } = useAppSelector(
    (state) => state.projects
  );
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(
    null
  );
  const [fullScreenImage, setFullScreenImage] = useState<{
    projectId: string;
    index: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
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

  const handleEditClick = (project: Project) => {
    setIsEditing(project.id);
    setFormData({
      ...project,
      start_date: new Date(project.start_date).toISOString().split("T")[0],
      end_date: new Date(project.end_date).toISOString().split("T")[0],
    });
    setSelectedCollaborators(project.collaborators || []);
    setSelectedImages([]); // Images are re-uploaded on edit
    setPrimaryImageIndex(
      project.images?.findIndex((img) => img.is_primary) || 0
    );
    setExpandedProjectId(null);
  };

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (project) =>
          project.name.toLowerCase().includes(query) ||
          (project.tags &&
            project.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    }

    // Apply status filter
    if (statusFilter !== "All") {
      result = result.filter((project) => project.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "progress":
          comparison =
            (a.progress_percentage || 0) - (b.progress_percentage || 0);
          break;
        case "end_date":
          comparison =
            new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [projects, searchQuery, statusFilter, sortBy, sortOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className=" p-6 bg-gradient-to-br from-gray-50 to-teal-50 ">
      <div className="pl-16 py-6">
        {/* Header Section */}
        <div className="flex sm:flex-row justify-between items-center mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-4 sm:mb-0">
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
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                onClick={() => setIsCreating(true)}
              >
                Create New Project
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

        {/* Filter and Search Controls */}
        <div className="bg-white p-4 rounded-xl shadow-md  mb-6 flex  sm:flex-row gap-4 items-center">
          <div className="relative flex">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search projects by name or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-300 focus:ring-teal-500 focus:border-teal-500 rounded-lg w-full"
              aria-label="Search projects"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <SortAsc className="w-5 h-5 text-gray-500" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 border-gray-300 focus:ring-teal-500 focus:border-teal-500">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="end_date">End Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="border-gray-300"
              aria-label={`Sort order: ${sortOrder}`}
            >
              {sortOrder === "asc" ? (
                <SortAsc className="w-5 h-5" />
              ) : (
                <SortDesc className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Project Grid */}
        <motion.div
          className="grid  grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          layout
        >
          <AnimatePresence>
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Compact Project Card */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() =>
                      setExpandedProjectId(
                        expandedProjectId === project.id ? null : project.id
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setExpandedProjectId(
                          expandedProjectId === project.id ? null : project.id
                        );
                      }
                    }}
                    aria-expanded={expandedProjectId === project.id}
                    aria-label={`Toggle details for ${project.name}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={
                            project.images?.find((img) => img.is_primary)
                              ?.url ||
                            "https://via.placeholder.com/80?text=No+Image"
                          }
                          alt={`${project.name} primary image`}
                          className="w-20 h-20 object-cover rounded-lg shadow-md hover:scale-105 transition-transform cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullScreenImage({
                              projectId: project.name,
                              index:
                                project.images?.findIndex(
                                  (img) => img.is_primary
                                ) || 0,
                            });
                          }}
                        />
                        <div className="absolute -top-1 -right-1 bg-teal-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          Primary
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {project.name}
                        </h3>
                        <p className="text-sm text-gray-500 capitalize">
                          {project.status}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-teal-500 h-2 rounded-full"
                              style={{
                                width: `${project.progress_percentage || 0}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600">
                            {project.progress_percentage || 0}%
                          </span>
                        </div>
                      </div>
                      {expandedProjectId === project.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {project.tags?.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {project.tags && project.tags.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{project.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedProjectId === project.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-200"
                      >
                        <div className="p-4">
                          <ProjectDetails
                            project={project}
                            setFullScreenImage={setFullScreenImage}
                          />
                          <div className="mt-4 flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setDeleteConfirmId(project.id)}
                              className="text-red-500 border-red-500 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                            <Button
                              onClick={() => handleEditClick(project)}
                              className="bg-teal-600 hover:bg-teal-700 text-white"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center py-12"
              >
                <p className="text-gray-500 text-lg">
                  No projects found. Try adjusting your search or filters.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Delete Confirmation Dialog */}
        {deleteConfirmId && (
          <DeleteConfirmation
            project={projects.find((p) => p.id === deleteConfirmId)!}
            onConfirm={() => setDeleteConfirmId(null)}
            onCancel={() => setDeleteConfirmId(null)}
          />
        )}

        {/* Full-Screen Image Modal */}
        {fullScreenImage && (
          <FullScreenImageModal
            images={
              projects.find((p) => p.name === fullScreenImage.projectId)
                ?.images || []
            }
            initialIndex={fullScreenImage.index}
            onClose={() => setFullScreenImage(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectList;
