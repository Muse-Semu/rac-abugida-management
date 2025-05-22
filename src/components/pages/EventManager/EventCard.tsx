import React from "react";
import { Event } from "../../../types";
import { Button } from "../../../components/ui/button";
import { CollaboratorList } from "./CollaboratorList";
import { ImageGallery } from "./ImageGallery";

interface EventCardProps {
  event: Event;
  onEdit: (event: Event) => void;
  currentUserId: string;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onEdit,
  currentUserId,
}) => {
  const images = event.images || [];
  const primaryImage = images.find((img) => img.is_primary)?.url;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
      <div className="relative h-48">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              {event.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute top-4 right-4">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              event.status === "Scheduled"
                ? "bg-blue-100 text-blue-800"
                : event.status === "Ongoing"
                ? "bg-green-100 text-green-800"
                : event.status === "Completed"
                ? "bg-gray-100 text-gray-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {event.status}
          </span>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{event.event_type}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(event)}
            className="text-gray-600 hover:text-gray-900"
          >
            Edit
          </Button>
        </div>
        <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Attendees</div>
            <div className="text-lg font-semibold">
              {event.attendees_count}/{event.max_attendees || "∞"}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Location</div>
            <div className="text-lg font-semibold truncate">
              {event.location || "TBD"}
            </div>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-500">
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
            {new Date(event.start_time).toLocaleString()}
          </div>
          <div className="flex items-center text-sm text-gray-500">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {new Date(event.end_time).toLocaleString()}
          </div>
        </div>
        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {event.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {event.is_recurring && (
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mb-4">
            <svg
              className="w-3 h-3 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Recurring Event
          </div>
        )}
        <CollaboratorList event={event} currentUserId={currentUserId} />
        <ImageGallery images={images} eventTitle={event.title} />
      </div>
    </div>
  );
};
