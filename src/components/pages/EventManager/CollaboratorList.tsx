import React from "react";
import { useAppDispatch } from "../../../store/hooks";
import { Event } from "../../../types";
import { removeCollaborator } from "../../../store/slices/eventSlice";

interface CollaboratorListProps {
  event: Event;
  currentUserId: string;
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({
  event,
  currentUserId,
}) => {
  const dispatch = useAppDispatch();

  if (!event.collaborators || event.collaborators.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Collaborators</h4>
      <div className="flex flex-wrap gap-2">
        {event.collaborators.map((collaborator) => (
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
                {collaborator.full_name} ({collaborator.role_name || "Member"})
              </span>
              <span className="text-gray-500 text-xs">
                {collaborator.email}
              </span>
            </div>
            {event.owner_id === currentUserId && (
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    removeCollaborator({
                      eventId: event.id,
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
  );
};
