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

interface User {
  id: string;
  email: string;
  role?: {
    id: number;
    role_name: string;
  };
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  designation: string;
  is_active: boolean;
  created_at: string;
}

export const EventList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { events, loading, error } = useAppSelector((state) => state.events);
  const { users, profiles } = useAppSelector((state) => state.users);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<Array<{ id: string; email: string; full_name: string }>>([]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    // Get current user ID
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

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
      // Ensure all required fields are present
      if (!formData.title || !formData.description || !formData.start_time || !formData.end_time || !formData.location) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Upload images first
      const imageUrls = await Promise.all(
        selectedImages.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const { data, error } = await supabase.storage
            .from('event-images')
            .upload(fileName, file);

          if (error) throw error;
          return supabase.storage.from('event-images').getPublicUrl(data.path).data.publicUrl;
        })
      );

      const formattedData = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      };

      // Create event data with proper types
      const eventData = {
        title: formattedData.title as string,
        description: formattedData.description as string,
        start_time: formattedData.start_time,
        end_time: formattedData.end_time,
        location: formattedData.location as string,
        status: formattedData.status || 'Scheduled',
        event_type: formattedData.event_type || 'Public',
        tags: formattedData.tags || [],
        max_attendees: formattedData.max_attendees || null,
        is_recurring: formattedData.is_recurring || false,
        images: imageUrls.map((url, index) => ({
          url,
          is_primary: index === primaryImageIndex
        })),
        owner_id: (await supabase.auth.getUser()).data.user?.id || '',
        collaborators: selectedCollaborators
      } as Omit<Event, 'id' | 'attendees_count' | 'created_at' | 'updated_at'>;

      if (isEditing) {
        await dispatch(updateEvent({ eventId: isEditing, eventData }));
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
      } else {
        await dispatch(createEvent(eventData));
        toast({
          title: "Success",
          description: "Event created successfully",
        });
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        status: 'Scheduled',
        event_type: 'Public',
        tags: [],
        max_attendees: null,
        is_recurring: false,
      });
      setSelectedImages([]);
      setPrimaryImageIndex(0);
      setSelectedCollaborators([]);
      setIsEditing(null);
      setIsSubmitting(false);
    } catch (error: any) {
      console.error('Error submitting event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit event",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (event: Event) => {
    setIsEditing(event.id);
    
    // Format dates for the form
    const formattedEvent = {
      ...event,
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      end_time: new Date(event.end_time).toISOString().slice(0, 16),
    };
    
    setFormData(formattedEvent);
    
    // Set selected images and primary image index
    const imageFiles = await Promise.all(
      event.images.map(async (img) => {
        const response = await fetch(img.url);
        const blob = await response.blob();
        return new File([blob], img.url.split('/').pop() || 'image.jpg', { type: blob.type });
      })
    );

    setSelectedImages(imageFiles);
    const primaryIndex = event.images.findIndex(img => img.is_primary);
    setPrimaryImageIndex(primaryIndex >= 0 ? primaryIndex : 0);
    
    // Set selected collaborators
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
                    onValueChange={(value) => {
                      const user = users.find(u => u.id === value);
                      const profile = profiles.find(p => p.user_id === value);
                      if (user && !selectedCollaborators.some(c => c.id === user.id)) {
                        setSelectedCollaborators([...selectedCollaborators, {
                          id: user.id,
                          email: user.email || '',
                          full_name: profile?.full_name || user.email.split('@')[0]
                        }]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collaborators" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter(user => {
                          const profile = profiles.find(p => p.user_id === user.id);
                          return user.id !== currentUserId && profile?.is_active;
                        })
                        .map((user) => {
                          const profile = profiles.find(p => p.user_id === user.id);
                          return (
                            <SelectItem key={`select-${user.id}`} value={user.id}>
                              {profile?.full_name || user.email.split('@')[0]} - {user.role?.role_name || 'Member'}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCollaborators.map((collaborator) => (
                      <div key={`selected-${collaborator.id}`} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded">
                        <span>{collaborator.full_name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCollaborators(selectedCollaborators.filter(c => c.id !== collaborator.id))}
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
        {events.map((event) => {
          const images = event.images || [];
          const primaryImage = images.find(img => img.is_primary)?.url;
          
          return (
            <div
              key={event.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              {/* Event Header with Image */}
              <div className="relative h-48">
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">{event.title.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    event.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                    event.status === 'Ongoing' ? 'bg-green-100 text-green-800' :
                    event.status === 'Completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </div>

              {/* Event Content */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{event.event_type}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(event)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Edit
                  </Button>
                </div>

                <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Attendees</div>
                    <div className="text-lg font-semibold">{event.attendees_count}/{event.max_attendees || '∞'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-500">Location</div>
                    <div className="text-lg font-semibold truncate">{event.location || 'TBD'}</div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(event.start_time).toLocaleString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(event.end_time).toLocaleString()}
                  </div>
                </div>

                {/* Tags */}
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

                {/* Recurring Badge */}
                {event.is_recurring && (
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mb-4">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Recurring Event
                  </div>
                )}

                {/* Collaborators List */}
                {event.collaborators && event.collaborators.length > 0 && (
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
                            <span className="text-gray-900 font-medium">{collaborator.full_name}</span>
                            <span className="text-gray-500 text-xs">{collaborator.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Images */}
                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.slice(0, 4).map((img, index) => (
                      <div key={index} className="relative aspect-square">
                        <img
                          src={img.url}
                          alt={`${event.title} image ${index + 1}`}
                          className={`w-full h-full object-cover rounded-lg ${
                            img.is_primary ? 'ring-2 ring-indigo-500' : ''
                          }`}
                        />
                        {img.is_primary && (
                          <div className="absolute bottom-1 left-1 bg-indigo-500 text-white text-xs px-1 rounded">
                            Primary
                          </div>
                        )}
                      </div>
                    ))}
                    {images.length > 4 && (
                      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-500 text-sm">+{images.length - 4}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 