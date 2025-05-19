import React from "react";
import { useAppDispatch } from "../../../store/hooks";
import { Project } from "../../../types";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../hooks/use-toast";
import { deleteProject } from "../../../store/slices/projectSlice";

interface DeleteConfirmationProps {
  project: Project;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  project,
  onConfirm,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      const result = await dispatch(deleteProject(project.id));
      if (deleteProject.rejected.match(result)) {
        throw new Error(result.payload as string);
      }
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      onConfirm();
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to delete project. Check permissions or try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="absolute inset-0 bg-black/600 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          Delete Project?
        </h3>
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete "{project.name}"? This action cannot
          be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmation;
