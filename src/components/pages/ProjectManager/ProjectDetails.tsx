import React from "react";
import { Project } from "../../../types";
import { useAppSelector } from "../../../store/hooks";
import { Clock, Tag, Users } from "lucide-react";

interface ProjectDetailsProps {
  project: Project;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project }) => {
  const { users, profiles } = useAppSelector((state) => state.users);
  const images = project.images || [];
  const nonPrimaryImages = images.filter((img) => !img.is_primary);

  const getDaysUntilEnd = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getUserDisplayName = (userId: string): string => {
    const profile = profiles.find((p) => p.user_id === userId);
    const user = users.find((u) => u.id === userId);
    return profile?.full_name || user?.email.split("@")[0] || "Unknown";
  };

  const daysUntilEnd = getDaysUntilEnd(project.end_date);
  const ownerName = getUserDisplayName(project.owner_id);
  const managerName = project.project_manager_id
    ? getUserDisplayName(project.project_manager_id)
    : "None";

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
      <p className="text-gray-600 text-sm">{project.description}</p>

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
            {project.team_members_count}/{project.max_team_members || "∞"}
          </div>
        </div>
      </div>

      <div className="bg-teal-50 p-3 rounded-lg shadow-sm">
        <div className="text-xs text-gray-500 flex items-center">
          <Users className="w-4 h-4 mr-1" /> Team Details
        </div>
        <div className="text-sm text-teal-700 mt-2">
          <p>
            <span className="font-semibold">Owner:</span> {ownerName}
          </p>
          <p>
            <span className="font-semibold">Manager:</span> {managerName}
          </p>
          <p>
            <span className="font-semibold">Collaborators:</span>{" "}
            {project.collaborators.length > 0
              ? project.collaborators
                  .map((c) => `${c.full_name} (${c.role_name || "Member"})`)
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
        <span>Days Left: {daysUntilEnd > 0 ? daysUntilEnd : "Ended"}</span>
      </div>

      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded-full hover:bg-teal-200 transition-colors"
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
              <div key={index} className="relative group flex-shrink-0">
                <img
                  src={img.url}
                  alt={`${project.name} image ${index + 1}`}
                  className="w-32 h-24 object-cover rounded-lg transition-transform duration-300 group-hover:scale-105 shadow-sm"
                  onError={(e) => {
                    console.error("Gallery image failed to load:", img.url);
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
  );
};

export default ProjectDetails;
