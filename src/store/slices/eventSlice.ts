import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "../../supabaseClient";
import { Event } from "../../types";

interface EventState {
  events: Event[];
  loading: boolean;
  error: string | null;
}

interface EventImage {
  url: string;
  is_primary: boolean;
}

interface Collaborator {
  id: string;
  email: string;
  full_name: string;
  role_id?: number;
  role_name?: string;
}

const initialState: EventState = {
  events: [],
  loading: false,
  error: null,
};

export const fetchEvents = createAsyncThunk("events/fetchEvents", async () => {
  try {
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (eventsError) throw eventsError;

    const { data: images, error: imagesError } = await supabase
      .from("event_images")
      .select("*");

    if (imagesError) throw imagesError;

    const { data: collaborators, error: collaboratorsError } = await supabase
      .from("event_collaborators")
      .select("event_id, user_id, role_id, roles(role_name)");

    if (collaboratorsError) throw collaboratorsError;
    if (!collaborators) throw new Error("Failed to fetch collaborators");

    const userIds = [...new Set(collaborators.map((c) => c.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    if (profilesError) throw profilesError;
    if (!profiles) throw new Error("Failed to fetch profiles");

    const userDetails = profiles.reduce((acc, profile) => {
      acc[profile.user_id] = {
        email: "",
        full_name: profile.full_name,
      };
      return acc;
    }, {} as Record<string, { email: string; full_name: string }>);

    const imagesByEvent = images.reduce((acc, img) => {
      if (!acc[img.event_id]) {
        acc[img.event_id] = [];
      }
      acc[img.event_id].push({
        url: img.image_url,
        is_primary: img.is_primary,
      });
      return acc;
    }, {} as Record<number, EventImage[]>);

    const collaboratorsByEvent = collaborators.reduce((acc, collab) => {
      if (!acc[collab.event_id]) {
        acc[collab.event_id] = [];
      }
      const userDetail = userDetails[collab.user_id];
      if (userDetail) {
        acc[collab.event_id].push({
          id: collab.user_id,
          email: userDetail.email,
          full_name: userDetail.full_name,
          role_id: collab.role_id,
          role_name: collab.roles?.role_name,
        });
      }
      return acc;
    }, {} as Record<number, Collaborator[]>);

    const eventsWithImages = events.map((event) => ({
      ...event,
      images: imagesByEvent[event.id] || [],
      collaborators: collaboratorsByEvent[event.id] || [],
    }));

    return eventsWithImages;
  } catch (error: any) {
    throw new Error(error.message);
  }
});

export const createEvent = createAsyncThunk(
  "events/createEvent",
  async (
    eventData: Omit<
      Event,
      "id" | "created_at" | "updated_at" | "attendees_count"
    >
  ) => {
    try {
      const { images, collaborators, ...eventFields } = eventData as any;

      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert(eventFields)
        .select()
        .single();

      if (eventError) throw eventError;

      if (images && images.length > 0) {
        const { error: imagesError } = await supabase
          .from("event_images")
          .insert(
            (images as EventImage[]).map((img) => ({
              event_id: event.id,
              image_url: img.url,
              is_primary: img.is_primary,
            }))
          );

        if (imagesError) throw imagesError;
      }

      if (collaborators && collaborators.length > 0) {
        const { data: validUsers, error: userError } = await supabase
          .from("profiles")
          .select("user_id")
          .in("user_id", collaborators);

        if (userError) throw userError;
        const validUserIds = validUsers.map((u) => u.user_id);
        const invalidCollaborators = collaborators.filter(
          (userId: string) => !validUserIds.includes(userId)
        );
        if (invalidCollaborators.length > 0) {
          throw new Error(
            `Invalid collaborators: ${invalidCollaborators.join(", ")}`
          );
        }

        const { data: memberRole, error: roleError } = await supabase
          .from("roles")
          .select("id")
          .eq("role_name", "Member")
          .single();

        if (roleError) throw roleError;

        const { error: collaboratorsError } = await supabase
          .from("event_collaborators")
          .insert(
            collaborators.map((userId: string) => ({
              event_id: event.id,
              user_id: userId,
              role_id: memberRole.id,
            }))
          );

        if (collaboratorsError) throw collaboratorsError;
      }

      const { data: completeEvent, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("id", event.id)
        .single();

      if (fetchError) throw fetchError;

      const { data: eventImages, error: imagesError } = await supabase
        .from("event_images")
        .select("*")
        .eq("event_id", event.id);

      if (imagesError) throw imagesError;

      const { data: eventCollaborators, error: collaboratorsError } =
        await supabase
          .from("event_collaborators")
          .select("user_id, role_id, roles(role_name)")
          .eq("event_id", event.id);

      if (collaboratorsError) throw collaboratorsError;

      const collaboratorUserIds = eventCollaborators.map((c) => c.user_id);
      const { data: collaboratorProfiles, error: profilesError } =
        await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", collaboratorUserIds);

      if (profilesError) throw profilesError;

      const collaboratorDetails = collaboratorProfiles.reduce(
        (acc, profile) => {
          acc[profile.user_id] = {
            email: "",
            full_name: profile.full_name,
          };
          return acc;
        },
        {} as Record<string, { email: string; full_name: string }>
      );

      const formattedCollaborators = eventCollaborators.map((c) => ({
        id: c.user_id,
        email: collaboratorDetails[c.user_id]?.email || "",
        full_name: collaboratorDetails[c.user_id]?.full_name || "",
        role_id: c.role_id,
        role_name: c.roles?.role_name,
      }));

      return {
        ...completeEvent,
        images: eventImages.map((img) => ({
          url: img.image_url,
          is_primary: img.is_primary,
        })),
        collaborators: formattedCollaborators,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

export const updateEvent = createAsyncThunk(
  "events/updateEvent",
  async ({
    eventId,
    eventData,
  }: {
    eventId: number;
    eventData: Partial<Event>;
  }) => {
    try {
      const { images, collaborators, ...eventFields } = eventData as any;

      const { data: event, error: eventError } = await supabase
        .from("events")
        .update(eventFields)
        .eq("id", eventId)
        .select()
        .single();

      if (eventError) throw eventError;

      if (images) {
        const { error: deleteError } = await supabase
          .from("event_images")
          .delete()
          .eq("event_id", eventId);

        if (deleteError) throw deleteError;

        if (images.length > 0) {
          const { error: insertError } = await supabase
            .from("event_images")
            .insert(
              (images as EventImage[]).map((img) => ({
                event_id: eventId,
                image_url: img.url,
                is_primary: img.is_primary,
              }))
            );

          if (insertError) throw insertError;
        }
      }

      if (collaborators) {
        const { error: deleteError } = await supabase
          .from("event_collaborators")
          .delete()
          .eq("event_id", eventId);

        if (deleteError) throw deleteError;

        if (collaborators.length > 0) {
          const { data: validUsers, error: userError } = await supabase
            .from("profiles")
            .select("user_id")
            .in("user_id", collaborators);

          if (userError) throw userError;
          const validUserIds = validUsers.map((u) => u.user_id);
          const invalidCollaborators = collaborators.filter(
            (userId: string) => !validUserIds.includes(userId)
          );
          if (invalidCollaborators.length > 0) {
            throw new Error(
              `Invalid collaborators: ${invalidCollaborators.join(", ")}`
            );
          }

          const { data: memberRole, error: roleError } = await supabase
            .from("roles")
            .select("id")
            .eq("role_name", "Member")
            .single();

          if (roleError) throw roleError;

          const { error: insertError } = await supabase
            .from("event_collaborators")
            .insert(
              collaborators.map((userId: string) => ({
                event_id: eventId,
                user_id: userId,
                role_id: memberRole.id,
              }))
            );

          if (insertError) throw insertError;
        }
      }

      const { data: completeEvent, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (fetchError) throw fetchError;

      const { data: eventImages, error: imagesError } = await supabase
        .from("event_images")
        .select("*")
        .eq("event_id", eventId);

      if (imagesError) throw imagesError;

      const { data: eventCollaborators, error: collaboratorsError } =
        await supabase
          .from("event_collaborators")
          .select("user_id, role_id, roles(role_name)")
          .eq("event_id", eventId);

      if (collaboratorsError) throw collaboratorsError;

      const collaboratorUserIds = eventCollaborators.map((c) => c.user_id);
      const { data: collaboratorProfiles, error: profilesError } =
        await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", collaboratorUserIds);

      if (profilesError) throw profilesError;

      const collaboratorDetails = collaboratorProfiles.reduce(
        (acc, profile) => {
          acc[profile.user_id] = {
            email: "",
            full_name: profile.full_name,
          };
          return acc;
        },
        {} as Record<string, { email: string; full_name: string }>
      );

      const formattedCollaborators = eventCollaborators.map((c) => ({
        id: c.user_id,
        email: collaboratorDetails[c.user_id]?.email || "",
        full_name: collaboratorDetails[c.user_id]?.full_name || "",
        role_id: c.role_id,
        role_name: c.roles?.role_name,
      }));

      return {
        ...completeEvent,
        images: eventImages.map((img) => ({
          url: img.image_url,
          is_primary: img.is_primary,
        })),
        collaborators: formattedCollaborators,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
);

export const addCollaborator = createAsyncThunk(
  "events/addCollaborator",
  async ({ eventId, userId }: { eventId: number; userId: string }) => {
    const { data: validUser, error: userError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (userError || !validUser) throw new Error(`Invalid user: ${userId}`);

    const { data: memberRole, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("role_name", "Member")
      .single();

    if (roleError) throw roleError;

    const { error } = await supabase
      .from("event_collaborators")
      .insert({ event_id: eventId, user_id: userId, role_id: memberRole.id });

    if (error) throw error;

    // Fetch user details for the collaborator
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", userId)
      .single();

    if (profileError) throw profileError;

    return {
      eventId,
      collaborator: {
        id: userId,
        email: "",
        full_name: profile.full_name || "",
        role_id: memberRole.id,
        role_name: "Member",
      },
    };
  }
);

export const removeCollaborator = createAsyncThunk(
  "events/removeCollaborator",
  async ({ eventId, userId }: { eventId: number; userId: string }) => {
    const { error } = await supabase
      .from("event_collaborators")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (error) throw error;
    return { eventId, userId };
  }
);

export const deleteEvent = createAsyncThunk(
  "events/deleteEvent",
  async (eventId: number) => {
    try {
      // Delete related event images
      const { error: imagesError } = await supabase
        .from("event_images")
        .delete()
        .eq("event_id", eventId);

      if (imagesError) throw imagesError;

      // Delete related event collaborators
      const { error: collaboratorsError } = await supabase
        .from("event_collaborators")
        .delete()
        .eq("event_id", eventId);

      if (collaboratorsError) throw collaboratorsError;

      // Delete the event
      const { error: eventError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (eventError) throw eventError;

      return eventId;
    } catch (error: any) {
      throw new Error(error.message || "Failed to delete event");
    }
  }
);

const eventSlice = createSlice({
  name: "events",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch events";
      })
      .addCase(createEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.loading = false;
        state.events.unshift(action.payload);
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to create event";
      })
      .addCase(updateEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.events.findIndex(
          (event) => event.id === action.payload.id
        );
        if (index !== -1) {
          state.events[index] = action.payload;
        }
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to update event";
      })
      .addCase(addCollaborator.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addCollaborator.fulfilled, (state, action) => {
        state.loading = false;
        const { eventId, collaborator } = action.payload;
        const event = state.events.find((e) => e.id === eventId);
        if (event) {
          event.collaborators.push(collaborator);
        }
      })
      .addCase(addCollaborator.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to add collaborator";
      })
      .addCase(removeCollaborator.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeCollaborator.fulfilled, (state, action) => {
        state.loading = false;
        const { eventId, userId } = action.payload;
        const event = state.events.find((e) => e.id === eventId);
        if (event) {
          event.collaborators = event.collaborators.filter(
            (c) => c.id !== userId
          );
        }
      })
      .addCase(removeCollaborator.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to remove collaborator";
      })
      .addCase(deleteEvent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteEvent.fulfilled, (state, action) => {
        state.loading = false;
        state.events = state.events.filter(
          (event) => event.id !== action.payload
        );
      })
      .addCase(deleteEvent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to delete event";
      });
  },
});

export default eventSlice.reducer;
