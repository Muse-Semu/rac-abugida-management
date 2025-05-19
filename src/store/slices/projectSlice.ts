
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "../../supabaseClient";

interface Collaborator {
  id: string;
  email: string;
  full_name: string;
  role_id?: number;
  role_name?: string;
}

interface ProjectImage {
  url: string;
  is_primary: boolean;
}

interface Project {
  id: number;
  name: string;
  description: string;
  status: "Active" | "Completed" | "On Hold" | "Cancelled";
  start_date: string;
  end_date: string;
  budget: number;
  progress_percentage: number;
  tags: string[];
  team_members_count: number;
  max_team_members: number | null;
  is_archived: boolean;
  project_type: "Internal" | "External";
  project_target: number;
  project_target_type: "Revenue" | "Cost";
  project_manager_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  images: ProjectImage[];
  collaborators: Collaborator[];
}

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  projects: [],
  loading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk(
  "projects/fetchProjects",
  async (_, { rejectWithValue }) => {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("roles(role_name)")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      const isAdmin = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Admin"
      );
      const isManager = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Project Manager"
      );

      // Fetch projects
      let query = supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      // Restrict projects for non-admin/non-manager users
      if (!isAdmin && !isManager) {
        query = query.or(
          `owner_id.eq.${user.id},project_manager_id.eq.${user.id}`
        );
      }

      const { data: projects, error: projectsError } = await query;
      if (projectsError) throw projectsError;

      // Fetch project images
      const { data: images, error: imagesError } = await supabase
        .from("project_images")
        .select("*");

      if (imagesError) throw imagesError;

      // Fetch project collaborators with role information
      const { data: collaborators, error: collaboratorsError } = await supabase
        .from("project_collaborators")
        .select("project_id, user_id, role_id, roles(role_name)");

      if (collaboratorsError) throw collaboratorsError;

      // Fetch user profiles for collaborators
      const userIds = [...new Set(collaborators.map((c) => c.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of user details
      const userDetails = profiles.reduce((acc, profile) => {
        acc[profile.user_id] = {
          email: "", // Email can be fetched if needed
          full_name: profile.full_name,
        };
        return acc;
      }, {} as Record<string, { email: string; full_name: string }>);

      // Group images by project_id
      const imagesByProject = images.reduce((acc, img) => {
        if (!acc[img.project_id]) {
          acc[img.project_id] = [];
        }
        acc[img.project_id].push({
          url: img.image_url,
          is_primary: img.is_primary,
        });
        return acc;
      }, {} as Record<number, ProjectImage[]>);

      // Group collaborators by project_id
      const collaboratorsByProject = collaborators.reduce((acc, collab) => {
        if (!acc[collab.project_id]) {
          acc[collab.project_id] = [];
        }
        const userDetail = userDetails[collab.user_id];
        if (userDetail) {
          acc[collab.project_id].push({
            id: collab.user_id,
            email: userDetail.email,
            full_name: userDetail.full_name,
            role_id: collab.role_id,
            role_name: collab.roles?.role_name,
          });
        }
        return acc;
      }, {} as Record<number, Collaborator[]>);

      // Combine projects with images and collaborators
      const projectsWithDetails = projects.map((project) => ({
        ...project,
        images: imagesByProject[project.id] || [],
        collaborators: collaboratorsByProject[project.id] || [],
      }));

      return projectsWithDetails;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createProject = createAsyncThunk(
  "projects/createProject",
  async (
    projectData: Omit<
      Project,
      "id" | "created_at" | "updated_at" | "team_members_count"
    >,
    { rejectWithValue }
  ) => {
    try {
      // Check permissions
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("roles(role_name)")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      const isAdmin = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Admin"
      );
      const isManager = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Project Manager"
      );

      if (!isAdmin && !isManager) {
        throw new Error("You do not have permission to create projects");
      }

      // Extract images and collaborators
      const { images, collaborators, ...projectFields } = projectData;

      // Validate images: ensure only one is_primary
      let validatedImages = images || [];
      const primaryCount = validatedImages.filter(img => img.is_primary).length;
      if (primaryCount > 1) {
        console.warn("Multiple primary images detected. Setting only the first as primary.");
        validatedImages = validatedImages.map((img, index) => ({
          ...img,
          is_primary: index === validatedImages.findIndex(i => i.is_primary),
        }));
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          ...projectFields,
          owner_id: user.id,
          team_members_count: 0,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Handle images
      if (validatedImages.length > 0) {
        const { error: imagesError } = await supabase
          .from("project_images")
          .insert(
            validatedImages.map((img) => ({
              project_id: project.id,
              image_url: img.url,
              is_primary: img.is_primary,
            }))
          );

        if (imagesError) throw imagesError;
      }

      // Handle collaborators
      if (collaborators && collaborators.length > 0) {
        // Validate collaborators
        const { data: validUsers, error: userError } = await supabase
          .from("profiles")
          .select("user_id")
          .in(
            "user_id",
            collaborators.map((c) => c.id)
          );

        if (userError) throw userError;
        const validUserIds = validUsers.map((u) => u.user_id);
        const invalidCollaborators = collaborators.filter(
          (c) => !validUserIds.includes(c.id)
        );
        if (invalidCollaborators.length > 0) {
          throw new Error(
            `Invalid collaborators: ${invalidCollaborators
              .map((c) => c.id)
              .join(", ")}`
          );
        }

        // Get Member role
        const { data: memberRole, error: roleError } = await supabase
          .from("roles")
          .select("id")
          .eq("role_name", "Member")
          .single();

        if (roleError) throw roleError;

        // Insert collaborators
        const { error: collaboratorsError } = await supabase
          .from("project_collaborators")
          .insert(
            collaborators.map((c) => ({
              project_id: project.id,
              user_id: c.id,
              role_id: memberRole.id,
            }))
          );

        if (collaboratorsError) throw collaboratorsError;

        // Update team_members_count
        const { error: countError } = await supabase
          .from("projects")
          .update({ team_members_count: collaborators.length })
          .eq("id", project.id);

        if (countError) throw countError;
      }

      // Fetch complete project
      const { data: completeProject, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project.id)
        .single();

      if (fetchError) throw fetchError;

      // Fetch images
      const { data: projectImages, error: imagesError } = await supabase
        .from("project_images")
        .select("*")
        .eq("project_id", project.id);

      if (imagesError) throw imagesError;

      // Fetch collaborators
      const { data: projectCollaborators, error: collaboratorsError } =
        await supabase
          .from("project_collaborators")
          .select("user_id, role_id, roles(role_name)")
          .eq("project_id", project.id);

      if (collaboratorsError) throw collaboratorsError;

      // Fetch profiles
      const collaboratorUserIds = projectCollaborators.map((c) => c.user_id);
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

      const formattedCollaborators = projectCollaborators.map((c) => ({
        id: c.user_id,
        email: collaboratorDetails[c.user_id]?.email || "",
        full_name: collaboratorDetails[c.user_id]?.full_name || "",
        role_id: c.role_id,
        role_name: c.roles?.role_name,
      }));

      return {
        ...completeProject,
        images: projectImages.map((img) => ({
          url: img.image_url,
          is_primary: img.is_primary,
        })),
        collaborators: formattedCollaborators,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateProject = createAsyncThunk(
  "projects/updateProject",
  async (
    {
      projectId,
      projectData,
    }: { projectId: number; projectData: Partial<Project> },
    { rejectWithValue }
  ) => {
    try {
      // Check permissions
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("owner_id, project_manager_id")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("roles(role_name)")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      const isAdmin = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Admin"
      );
      const isManager = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Project Manager"
      );
      const isOwner = project.owner_id === user.id;
      const isProjectManager = project.project_manager_id === user.id;

      if (!isAdmin && !isManager && !isOwner && !isProjectManager) {
        throw new Error("You do not have permission to update this project");
      }

      // Extract images and collaborators
      const { images, collaborators, ...projectFields } = projectData;

      // Update project
      const { data: updatedProject, error: updateError } = await supabase
        .from("projects")
        .update(projectFields)
        .eq("id", projectId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Handle images
      if (images) {
        // Delete existing images
        const { error: deleteError } = await supabase
          .from("project_images")
          .delete()
          .eq("project_id", projectId);

        if (deleteError) throw deleteError;

        // Validate images: ensure only one is_primary
        let validatedImages = images;
        const primaryCount = validatedImages.filter(img => img.is_primary).length;
        if (primaryCount > 1) {
          console.warn("Multiple primary images detected. Setting only the first as primary.");
          validatedImages = validatedImages.map((img, index) => ({
            ...img,
            is_primary: index === validatedImages.findIndex(i => i.is_primary),
          }));
        } else if (primaryCount === 0 && validatedImages.length > 0) {
          console.warn("No primary image set. Setting the first image as primary.");
          validatedImages = validatedImages.map((img, index) => ({
            ...img,
            is_primary: index === 0,
          }));
        }

        // Insert new images
        if (validatedImages.length > 0) {
          const { error: insertError } = await supabase
            .from("project_images")
            .insert(
              validatedImages.map((img) => ({
                project_id: projectId,
                image_url: img.url,
                is_primary: img.is_primary,
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // Handle collaborators
      if (collaborators) {
        // Delete existing collaborators
        const { error: deleteError } = await supabase
          .from("project_collaborators")
          .delete()
          .eq("project_id", projectId);

        if (deleteError) throw deleteError;

        // Insert new collaborators
        if (collaborators.length > 0) {
          // Validate collaborators
          const { data: validUsers, error: userError } = await supabase
            .from("profiles")
            .select("user_id")
            .in(
              "user_id",
              collaborators.map((c) => c.id)
            );

          if (userError) throw userError;
          const validUserIds = validUsers.map((u) => u.user_id);
          const invalidCollaborators = collaborators.filter(
            (c) => !validUserIds.includes(c.id)
          );
          if (invalidCollaborators.length > 0) {
            throw new Error(
              `Invalid collaborators: ${invalidCollaborators
                .map((c) => c.id)
                .join(", ")}`
            );
          }

          // Get Member role
          const { data: memberRole, error: roleError } = await supabase
            .from("roles")
            .select("id")
            .eq("role_name", "Member")
            .single();

          if (roleError) throw roleError;

          // Insert collaborators
          const { error: insertError } = await supabase
            .from("project_collaborators")
            .insert(
              collaborators.map((c) => ({
                project_id: projectId,
                user_id: c.id,
                role_id: memberRole.id,
              }))
            );

          if (insertError) throw insertError;

          // Update team_members_count
          const { error: countError } = await supabase
            .from("projects")
            .update({ team_members_count: collaborators.length })
            .eq("id", projectId);

          if (countError) throw countError;
        } else {
          // Reset team_members_count if no collaborators
          const { error: countError } = await supabase
            .from("projects")
            .update({ team_members_count: 0 })
            .eq("id", projectId);

          if (countError) throw countError;
        }
      }

      // Fetch complete project
      const { data: completeProject, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (fetchError) throw fetchError;

      // Fetch images
      const { data: projectImages, error: imagesError } = await supabase
        .from("project_images")
        .select("*")
        .eq("project_id", projectId);

      if (imagesError) throw imagesError;

      // Fetch collaborators
      const { data: projectCollaborators, error: collaboratorsError } =
        await supabase
          .from("project_collaborators")
          .select("user_id, role_id, roles(role_name)")
          .eq("project_id", projectId);

      if (collaboratorsError) throw collaboratorsError;

      // Fetch profiles
      const collaboratorUserIds = projectCollaborators.map((c) => c.user_id);
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

      const formattedCollaborators = projectCollaborators.map((c) => ({
        id: c.user_id,
        email: collaboratorDetails[c.user_id]?.email || "",
        full_name: collaboratorDetails[c.user_id]?.full_name || "",
        role_id: c.role_id,
        role_name: c.roles?.role_name,
      }));

      return {
        ...completeProject,
        images: projectImages.map((img) => ({
          url: img.image_url,
          is_primary: img.is_primary,
        })),
        collaborators: formattedCollaborators,
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const addCollaborator = createAsyncThunk(
  "projects/addCollaborator",
  async (
    { projectId, userId }: { projectId: number; userId: string },
    { rejectWithValue }
  ) => {
    try {
      // Validate user
      const { data: validUser, error: userError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .single();

      if (userError || !validUser) throw new Error(`Invalid user: ${userId}`);

      // Get Member role
      const { data: memberRole, error: roleError } = await supabase
        .from("roles")
        .select("id")
        .eq("role_name", "Member")
        .single();

      if (roleError) throw roleError;

      // Insert collaborator
      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId,
        user_id: userId,
        role_id: memberRole.id,
      });

      if (error) throw error;

      // Update team_members_count
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("team_members_count")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      const newCount = (project.team_members_count || 0) + 1;
      const { error: countError } = await supabase
        .from("projects")
        .update({ team_members_count: newCount })
        .eq("id", projectId);

      if (countError) throw countError;

      return { projectId, userId };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const removeCollaborator = createAsyncThunk(
  "projects/removeCollaborator",
  async (
    { projectId, userId }: { projectId: number; userId: string },
    { rejectWithValue }
  ) => {
    try {
      // Delete collaborator
      const { error } = await supabase
        .from("project_collaborators")
        .delete()
        .match({ project_id: projectId, user_id: userId });

      if (error) throw error;

      // Update team_members_count
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("team_members_count")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      const newCount = Math.max((project.team_members_count || 0) - 1, 0);
      const { error: countError } = await supabase
        .from("projects")
        .update({ team_members_count: newCount })
        .eq("id", projectId);

      if (countError) throw countError;

      return { projectId, userId };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteProject = createAsyncThunk(
  "projects/deleteProject",
  async (projectId: number, { rejectWithValue }) => {
    try {
      // Check permissions
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("owner_id, project_manager_id")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("roles(role_name)")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      const isAdmin = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Admin"
      );
      const isManager = userRoles?.some(
        (ur: any) => ur.roles.role_name === "Project Manager"
      );
      const isOwner = project.owner_id === user.id;
      const isProjectManager = project.project_manager_id === user.id;

      if (!isAdmin && !isManager && !isOwner && !isProjectManager) {
        throw new Error("You do not have permission to delete this project");
      }

      // Delete project images
      const { error: imagesError } = await supabase
        .from("project_images")
        .delete()
        .eq("project_id", projectId);

      if (imagesError) throw imagesError;

      // Delete project collaborators
      const { error: collaboratorsError } = await supabase
        .from("project_collaborators")
        .delete()
        .eq("project_id", projectId);

      if (collaboratorsError) throw collaboratorsError;

      // Delete project
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (deleteError) throw deleteError;

      return projectId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const projectSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.unshift(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.projects.findIndex(
          (project) => project.id === action.payload.id
        );
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addCollaborator.fulfilled, (state, action) => {
        const project = state.projects.find(
          (p) => p.id === action.payload.projectId
        );
        if (project) {
          project.team_members_count = (project.team_members_count || 0) + 1;
        }
      })
      .addCase(removeCollaborator.fulfilled, (state, action) => {
        const project = state.projects.find(
          (p) => p.id === action.payload.projectId
        );
        if (project) {
          project.team_members_count = Math.max(
            (project.team_members_count || 0) - 1,
            0
          );
        }
      })
      .addCase(deleteProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = state.projects.filter(
          (project) => project.id !== action.payload
        );
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default projectSlice.reducer;
