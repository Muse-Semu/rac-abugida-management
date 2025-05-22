import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { supabase } from "../../../supabaseClient";
import { Event, Collaborator } from "../../../types";
import { fetchEvents } from "../../../store/slices/eventSlice";
import { Dialog, DialogTrigger } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { EventForm } from "./EventForm";
import { EventCard } from "./EventCard";
import { useToast } from "../../../hooks/use-toast";

export const EventList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { events, loading, error } = useAppSelector((state) => state.events);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<
    Collaborator[]
  >([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Partial<Event>>({
    title: "",
    description: "",
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date().toISOString().slice(0, 16),
    location: "",
    status: "Scheduled",
    event_type: "Public",
    tags: [],
    max_attendees: null,
    is_recurring: false,
  });
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
    dispatch(fetchEvents());
  }, [dispatch]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      start_time: new Date().toISOString().slice(0, 16),
      end_time: new Date().toISOString().slice(0, 16),
      location: "",
      status: "Scheduled",
      event_type: "Public",
      tags: [],
      max_attendees: null,
      is_recurring: false,
    });
    setSelectedImages([]);
    setPrimaryImageIndex(0);
    setSelectedCollaborators([]);
    setIsCreating(false);
    setIsEditing(null);
  };

  const handleEdit = async (event: Event) => {
    setIsEditing(event.id);
    const formattedEvent = {
      ...event,
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      end_time: new Date(event.end_time).toISOString().slice(0, 16),
    };
    setFormData(formattedEvent);
    const imageFiles = await Promise.all(
      event.images.map(async (img) => {
        const response = await fetch(img.url);
        const blob = await response.blob();
        return new File([blob], img.url.split("/").pop() || "image.jpg", {
          type: blob.type,
        });
      })
    );
    setSelectedImages(imageFiles);
    setPrimaryImageIndex(
      event.images.findIndex((img) => img.is_primary) >= 0
        ? event.images.findIndex((img) => img.is_primary)
        : 0
    );
    setSelectedCollaborators(event.collaborators || []);
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
        <h1 className="text-2xl font-bold">Events</h1>
        <Dialog
          open={isCreating || isEditing !== null}
          onOpenChange={(open) => {
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreating(true)}>Create Event</Button>
          </DialogTrigger>
          <EventForm
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
            selectedCollaborators={selectedCollaborators}
            setSelectedCollaborators={setSelectedCollaborators}
            selectedImages={selectedImages}
            setSelectedImages={setSelectedImages}
            primaryImageIndex={primaryImageIndex}
            setPrimaryImageIndex={setPrimaryImageIndex}
            resetForm={resetForm}
            currentUserId={currentUserId}
          />
        </Dialog>
      </div>
      {error && <div className="text-red-500 text-center p-4">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={handleEdit}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
};

export default EventList;
