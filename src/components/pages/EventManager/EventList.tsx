import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { supabase } from '../../../supabaseClient';
import { Event } from '../../../types';
import {
  fetchEvents,
  createEvent,
  updateEvent,
  addCollaborator,
  removeCollaborator
} from '../../../store/slices/eventSlice';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { useToast } from '../../../hooks/use-toast';
export const EventList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { events, loading, error } = useAppSelector((state) => state.events);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [formData, setFormData] = useState<Partial<Event>>({
    title: '',
    description: '',
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date().toISOString().slice(0, 16),
    location: '',
    status: 'Scheduled',
    event_type: 'Public',
    tags: [],
    max_attendees: null,
    is_recurring: false,
  });

  useEffect(() => {
    dispatch(fetchEvents());
    fetchUsers();

    // Set up real-time subscription
    const subscription = supabase
      .channel('events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            dispatch(createEvent(payload.new as Event));
          } else if (payload.eventType === 'UPDATE') {
            dispatch(updateEvent({ eventId: payload.new.id, eventData: payload.new }));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data);
  };

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
    try {
      // Format dates to ISO string
      const formattedData = {
        ...formData,
        start_time: new Date(formData.start_time!).toISOString(),
        end_time: new Date(formData.end_time!).toISOString(),
      };

      // Upload images first
      const imageUrls = await Promise.all(
        selectedImages.map(async (image) => {
          const fileExt = image.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from('event-images')
            .upload(fileName, image);
          if (error) {
            toast({
              title: "Error",
              description: `Failed to upload image: ${error.message}`,
              variant: "destructive",
            });
            throw error;
          }
          return data.path;
        })
      );

      const eventData = {
        ...formattedData,
        primary_image: imageUrls[primaryImageIndex],
        images: imageUrls,
        owner_id: (await supabase.auth.getUser()).data.user?.id,
      };

      if (isEditing) {
        await dispatch(updateEvent({ eventId: isEditing, eventData }));
      } else {
        await dispatch(createEvent(eventData as Omit<Event, 'id' | 'created_at' | 'updated_at' | 'attendees_count'>));
      }

      // Add collaborators
      for (const userId of selectedCollaborators) {
        await dispatch(addCollaborator({ eventId: isEditing || 0, userId }));
      }

      toast({
        title: isEditing ? "Event Updated" : "Event Created",
        description: isEditing ? "Your event has been updated successfully." : "Your event has been created successfully.",
        variant: "default",
      });

      setIsCreating(false);
      setIsEditing(null);
      setSelectedImages([]);
      setSelectedCollaborators([]);
      setFormData({
        title: '',
        description: '',
        start_time: new Date().toISOString().slice(0, 16),
        end_time: new Date().toISOString().slice(0, 16),
        location: '',
        status: 'Scheduled',
        event_type: 'Public',
        tags: [],
        max_attendees: null,
        is_recurring: false,
      });
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event. Please check your permissions and try again.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (event: Event) => {
    setIsEditing(event.id);
    setFormData(event);
    setSelectedCollaborators(event.collaborators || []);
    setPrimaryImageIndex(event.images?.indexOf(event.primary_image) || 0);
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
            if (!open) {
              setIsCreating(false);
              setIsEditing(null);
              setSelectedImages([]);
              setSelectedCollaborators([]);
              setFormData({
                title: '',
                description: '',
                start_time: new Date().toISOString().slice(0, 16),
                end_time: new Date().toISOString().slice(0, 16),
                location: '',
                status: 'Scheduled',
                event_type: 'Public',
                tags: [],
                max_attendees: null,
                is_recurring: false,
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreating(true)}>Create Event</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Event' : 'Create New Event'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update the event details below.' : 'Fill in the event details below to create a new event.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as Event['status'] })}
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
                    onValueChange={(value) => setFormData({ ...formData, event_type: value as Event['event_type'] })}
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
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_attendees">Max Attendees</Label>
                  <Input
                    id="max_attendees"
                    type="number"
                    value={formData.max_attendees || ''}
                    onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    type="text"
                    value={formData.tags?.join(', ')}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()) })}
                    placeholder="Enter tags separated by commas"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_recurring"
                      checked={formData.is_recurring}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
                    />
                    <Label htmlFor="is_recurring">Is Recurring</Label>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Collaborators</Label>
                  <Select
                    onValueChange={(value) => setSelectedCollaborators([...selectedCollaborators, value])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collaborators" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCollaborators.map((userId) => {
                      const user = users.find(u => u.id === userId);
                      return user ? (
                        <div key={userId} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded">
                          <span>{user.email}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCollaborators(selectedCollaborators.filter(id => id !== userId))}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
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
                            index === primaryImageIndex ? 'ring-2 ring-indigo-500' : ''
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(null);
                    setSelectedImages([]);
                    setSelectedCollaborators([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="text-red-500 text-center p-4">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{event.title}</h3>
              <Button
                variant="ghost"
                onClick={() => handleEdit(event)}
              >
                Edit
              </Button>
            </div>
            <p className="text-gray-600 mb-4">{event.description}</p>
            <div className="text-sm text-gray-500 space-y-2">
              <div>Status: {event.status}</div>
              <div>Type: {event.event_type}</div>
              <div>Location: {event.location}</div>
              <div>Attendees: {event.attendees_count}/{event.max_attendees || '∞'}</div>
              <div>Start: {new Date(event.start_time).toLocaleString()}</div>
              <div>End: {new Date(event.end_time).toLocaleString()}</div>
              <div>Recurring: {event.is_recurring ? 'Yes' : 'No'}</div>
              <div>Tags: {event.tags?.join(', ')}</div>
            </div>
            {event.primary_image && (
              <img
                src={event.primary_image}
                alt={event.title}
                className="mt-4 w-full h-48 object-cover rounded"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}; 