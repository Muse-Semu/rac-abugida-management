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
  const [eventImages, setEventImages] = useState<Record<number, { url: string; is_primary: boolean }[]>>({});
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
    const fetchEventsAndImages = async () => {
      try {
        // Fetch images for all events
        const { data: imagesData, error: imagesError } = await supabase
          .from('event_images')
          .select('*');

        if (imagesError) throw imagesError;

        // Group images by event_id
        const imagesByEvent = imagesData.reduce((acc, img) => {
          if (!acc[img.event_id]) {
            acc[img.event_id] = [];
          }
          acc[img.event_id].push({
            url: img.image_url,
            is_primary: img.is_primary
          });
          return acc;
        }, {} as Record<number, { url: string; is_primary: boolean }[]>);

        setEventImages(imagesByEvent);
      } catch (error) {
        console.error('Error fetching event images:', error);
        toast({
          title: "Error",
          description: "Failed to load event images.",
          variant: "destructive",
        });
      }
    };

    dispatch(fetchEvents());
    fetchUsers();
    fetchEventsAndImages();
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
          try {
            const fileExt = image.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            
            // Try to upload directly to the bucket
            const { data, error } = await supabase.storage
              .from('event-images')
              .upload(fileName, image, {
                cacheControl: '3600',
                upsert: false
              });

            if (error) {
              console.error('Image upload error:', error);
              toast({
                title: "Error",
                description: `Failed to upload image: ${error.message}`,
                variant: "destructive",
              });
              throw error;
            }

            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
              .from('event-images')
              .getPublicUrl(data.path);

            return publicUrl;
          } catch (error: any) {
            console.error('Error in image upload:', error);
            throw error;
          }
        })
      );

      // Prepare event data without images
      const eventData = {
        title: formattedData.title || '',
        description: formattedData.description || '',
        start_time: formattedData.start_time,
        end_time: formattedData.end_time,
        location: formattedData.location || '',
        status: formattedData.status || 'Scheduled',
        event_type: formattedData.event_type || 'Public',
        tags: formattedData.tags || [],
        max_attendees: formattedData.max_attendees || null,
        is_recurring: formattedData.is_recurring || false,
        owner_id: (await supabase.auth.getUser()).data.user?.id || '',
      };

      let eventId: number;

      if (isEditing) {
        // Update event using the Redux action
        const resultAction = await dispatch(updateEvent({
          eventId: isEditing,
          eventData: eventData
        }));

        if (updateEvent.rejected.match(resultAction)) {
          throw new Error(resultAction.error.message);
        }

        eventId = isEditing;
      } else {
        // Create event using the Redux action
        const resultAction = await dispatch(createEvent(eventData));

        if (createEvent.rejected.match(resultAction)) {
          throw new Error(resultAction.error.message);
        }

        eventId = resultAction.payload.id;
      }

      // Handle images separately
      if (selectedImages.length > 0) {
        // Delete existing images if updating
        if (isEditing) {
          const { error: deleteError } = await supabase
            .from('event_images')
            .delete()
            .eq('event_id', eventId);

          if (deleteError) throw deleteError;
        }

        // Insert new images
        const { error: insertError } = await supabase
          .from('event_images')
          .insert(
            imageUrls.map((url, index) => ({
              event_id: eventId,
              image_url: url,
              is_primary: index === primaryImageIndex
            }))
          );

        if (insertError) throw insertError;
      }

      // Handle collaborators
      if (selectedCollaborators.length > 0) {
        // Delete existing collaborators if updating
        if (isEditing) {
          const { error: deleteError } = await supabase
            .from('event_collaborators')
            .delete()
            .eq('event_id', eventId);

          if (deleteError) throw deleteError;
        }

        // Insert new collaborators
        const { error: insertError } = await supabase
          .from('event_collaborators')
          .insert(
            selectedCollaborators.map(userId => ({
              event_id: eventId,
              user_id: userId
            }))
          );

        if (insertError) throw insertError;
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

      // Refresh the events list
      dispatch(fetchEvents());
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save event. Please check your permissions and try again.",
        variant: "destructive",
      });
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
    
    // Fetch event images
    const { data: images, error: imagesError } = await supabase
      .from('event_images')
      .select('*')
      .eq('event_id', event.id);

    if (imagesError) {
      console.error('Error fetching event images:', imagesError);
      return;
    }

    // Fetch event collaborators
    const { data: collaborators, error: collaboratorsError } = await supabase
      .from('event_collaborators')
      .select('user_id')
      .eq('event_id', event.id);

    if (collaboratorsError) {
      console.error('Error fetching event collaborators:', collaboratorsError);
      return;
    }

    // Set selected images and primary image index
    const imageFiles = await Promise.all(
      images.map(async (img) => {
        const response = await fetch(img.image_url);
        const blob = await response.blob();
        return new File([blob], img.image_url.split('/').pop() || 'image.jpg', { type: blob.type });
      })
    );

    setSelectedImages(imageFiles);
    const primaryIndex = images.findIndex(img => img.is_primary);
    setPrimaryImageIndex(primaryIndex >= 0 ? primaryIndex : 0);
    
    // Set selected collaborators
    setSelectedCollaborators(collaborators.map(c => c.user_id));
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
        {events.map((event) => {
          const images = eventImages[event.id] || [];
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

                {/* Event Images Grid */}
                {images.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Event Images</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((img, index) => (
                        <div key={index} className="relative aspect-square group">
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
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg" />
                        </div>
                      ))}
                    </div>
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