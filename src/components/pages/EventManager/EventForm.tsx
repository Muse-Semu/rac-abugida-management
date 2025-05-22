import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { supabase } from "../../../supabaseClient";
import { Event, Collaborator } from "../../../types";
import { createEvent, updateEvent } from "../../../store/slices/eventSlice";
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

interface EventFormProps {
  isEditing: number | null;
  formData: Partial<Event>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Event>>>;
  selectedCollaborators: Collaborator[];
  setSelectedCollaborators: React.Dispatch<
    React.SetStateAction<Collaborator[]>
  >;
  selectedImages: File[];
  setSelectedImages: React.Dispatch<React.SetStateAction<File[]>>;
  primaryImageIndex: number;
  setPrimaryImageIndex: React.Dispatch<React.SetStateAction<number>>;
  resetForm: () => void;
  currentUserId: string;
}

export const EventForm: React.FC<EventFormProps> = ({
  isEditing,
  formData,
  setFormData,
  selectedCollaborators,
  setSelectedCollaborators,
  selectedImages,
  setSelectedImages,
  primaryImageIndex,
  setPrimaryImageIndex,
  resetForm,
  currentUserId,
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
      if (
        !formData.title ||
        !formData.description ||
        !formData.start_time ||
        !formData.end_time ||
        !formData.location
      ) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const imageUrls = await Promise.all(
        selectedImages.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from("event-images")
            .upload(fileName, file);
          if (error) throw error;
          return supabase.storage.from("event-images").getPublicUrl(data.path)
            .data.publicUrl;
        })
      );

      const formattedData = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      };

      const eventData = {
        title: formattedData.title as string,
        description: formattedData.description as string,
        start_time: formattedData.start_time,
        end_time: formattedData.end_time,
        location: formattedData.location as string,
        status: formattedData.status || "Scheduled",
        event_type: formattedData.event_type || "Public",
        tags: formattedData.tags || [],
        max_attendees: formattedData.max_attendees || null,
        is_recurring: formattedData.is_recurring || false,
        images: imageUrls.map((url, index) => ({
          url,
          is_primary: index === primaryImageIndex,
        })),
        owner_id: currentUserId,
        collaborators: selectedCollaborators.map((c) => c.id),
      } as Omit<Event, "id" | "attendees_count" | "created_at" | "updated_at">;

      if (isEditing) {
        await dispatch(updateEvent({ eventId: isEditing, eventData }));
        toast({ title: "Success", description: "Event updated successfully" });
      } else {
        await dispatch(createEvent(eventData));
        toast({ title: "Success", description: "Event created successfully" });
      }

      resetForm();
    } catch (error: any) {
      console.error("Error submitting event:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit event",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit Event" : "Create New Event"}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update the event details below."
            : "Fill in the event details below to create a new event."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value as Event["status"] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Ongoing">Ongoing</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_type">Event Type</Label>
            <Select
              value={formData.event_type}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  event_type: value as Event["event_type"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="Private">Private</SelectItem>
                <SelectItem value="Internal">Internal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_time">Start Time</Label>
            <Input
              id="start_time"
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) =>
                setFormData({ ...formData, start_time: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">End Time</Label>
            <Input
              id="end_time"
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) =>
                setFormData({ ...formData, end_time: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_attendees">Max Attendees</Label>
            <Input
              id="max_attendees"
              type="number"
              value={formData.max_attendees || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_attendees: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              type="text"
              value={formData.tags?.join(", ")}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value.split(",").map((tag) => tag.trim()),
                })
              }
              placeholder="Enter tags separated by commas"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_recurring: checked as boolean })
                }
              />
              <Label htmlFor="is_recurring">Is Recurring</Label>
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
                      full_name: profile?.full_name || user.email.split("@")[0],
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
          <Button type="button" variant="outline" onClick={resetForm}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};
