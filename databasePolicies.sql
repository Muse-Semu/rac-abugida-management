
-- Policies for profiles table
CREATE POLICY profiles_select ON profiles
    FOR SELECT
    USING (auth.uid() = user_id OR get_user_role(auth.uid()) = 'Admin');
CREATE POLICY profiles_insert ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR get_user_role(auth.uid()) = 'Admin');
CREATE POLICY profiles_update ON profiles
    FOR UPDATE
    USING (auth.uid() = user_id OR get_user_role(auth.uid()) IN ('Admin', 'Organizer'));
CREATE POLICY profiles_delete ON profiles
    FOR DELETE
    USING (get_user_role(auth.uid()) = 'Admin');

-- Policies for roles table
CREATE POLICY roles_select ON roles
    FOR SELECT
    USING (true); -- Everyone can view roles
CREATE POLICY roles_insert ON roles
    FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY roles_update ON roles
    FOR UPDATE
    USING (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY roles_delete ON roles
    FOR DELETE
    USING (get_user_role(auth.uid()) = 'Admin');

-- Policies for user_roles table
CREATE POLICY user_roles_select ON user_roles
    FOR SELECT
    USING (auth.uid() = user_id OR get_user_role(auth.uid()) = 'Admin');
CREATE POLICY user_roles_insert ON user_roles
    FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY user_roles_update ON user_roles
    FOR UPDATE
    USING (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY user_roles_delete ON user_roles
    FOR DELETE
    USING (get_user_role(auth.uid()) = 'Admin');

-- Policies for events table
CREATE POLICY events_select ON events
    FOR SELECT
    USING (true); -- Any authenticated user can view all events
CREATE POLICY events_insert ON events
    FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) IN ('Admin', 'Organizer'));
CREATE POLICY events_update ON events
    FOR UPDATE
    USING (auth.uid() = owner_id OR get_user_role(auth.uid()) = 'Admin');
CREATE POLICY events_delete ON events
    FOR DELETE
    USING (auth.uid() = owner_id OR get_user_role(auth.uid()) = 'Admin');

-- Policies for event_images table
CREATE POLICY event_images_select ON event_images
    FOR SELECT
    USING (true); -- Any authenticated user can view event images
CREATE POLICY event_images_insert ON event_images
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_images.event_id
            AND (e.owner_id = auth.uid() OR get_user_role(auth.uid()) = 'Admin')
        )
    );
CREATE POLICY event_images_update ON event_images
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_images.event_id
            AND (e.owner_id = auth.uid() OR get_user_role(auth.uid()) = 'Admin')
        )
    );
CREATE POLICY event_images_delete ON event_images
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_images.event_id
            AND (e.owner_id = auth.uid() OR get_user_role(auth.uid()) = 'Admin')
        )
    );

-- Policies for projects table
CREATE POLICY projects_select ON projects
    FOR SELECT
    USING (true); -- Any authenticated user can view all projects
CREATE POLICY projects_insert ON projects
    FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) IN ('Admin', 'Organizer'));
CREATE POLICY projects_update ON projects
    FOR UPDATE
    USING (auth.uid() = owner_id OR get_user_role(auth.uid()) = 'Admin');
CREATE POLICY projects_delete ON projects
    FOR DELETE
    USING (auth.uid() = owner_id OR get_user_role(auth.uid()) = 'Admin');

-- Policies for project_images table
CREATE POLICY project_images_select ON project_images
    FOR SELECT
    USING (true); -- Any authenticated user can view project images
CREATE POLICY project_images_insert ON project_images
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_images.project_id
            AND (p.owner_id = auth.uid() OR get_user_role(auth.uid()) = 'Admin')
        )
    );
CREATE POLICY project_images_update ON project_images
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_images.project_id
            AND (p.owner_id = auth.uid() OR get_user_role(auth.uid()) = 'Admin')
        )
    );
CREATE POLICY project_images_delete ON project_images
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_images.project_id
            AND (p.owner_id = auth.uid() OR get_user_role(auth.uid()) = 'Admin')
        )
    );

-- Policies for event_collaborators table
CREATE POLICY event_collaborators_select ON event_collaborators
    FOR SELECT
    USING (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_collaborators.event_id AND e.owner_id = auth.uid()
        )
    );
CREATE POLICY event_collaborators_insert ON event_collaborators
    FOR INSERT
    WITH CHECK (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_collaborators.event_id AND e.owner_id = auth.uid()
        )
    );
CREATE POLICY event_collaborators_update ON event_collaborators
    FOR UPDATE
    USING (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_collaborators.event_id AND e.owner_id = auth.uid()
        )
    );
CREATE POLICY event_collaborators_delete ON event_collaborators
    FOR DELETE
    USING (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_collaborators.event_id AND e.owner_id = auth.uid()
        )
    );

-- Policies for project_collaborators table
CREATE POLICY project_collaborators_select ON project_collaborators
    FOR SELECT
    USING (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_collaborators.project_id AND p.owner_id = auth.uid()
        )
    );
CREATE POLICY project_collaborators_insert ON project_collaborators
    FOR INSERT
    WITH CHECK (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_collaborators.project_id AND p.owner_id = auth.uid()
        )
    );
CREATE POLICY project_collaborators_update ON project_collaborators
    FOR UPDATE
    USING (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_collaborators.project_id AND p.owner_id = auth.uid()
        )
    );
CREATE POLICY project_collaborators_delete ON project_collaborators
    FOR DELETE
    USING (
        get_user_role(auth.uid()) = 'Admin'
        OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_collaborators.project_id AND p.owner_id = auth.uid()
        )
    );

-- Policies for dashboard_metrics table
CREATE POLICY dashboard_metrics_select ON dashboard_metrics
    FOR SELECT
    USING (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY dashboard_metrics_insert ON dashboard_metrics
    FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY dashboard_metrics_update ON dashboard_metrics
    FOR UPDATE
    USING (get_user_role(auth.uid()) = 'Admin');
CREATE POLICY dashboard_metrics_delete ON dashboard_metrics
    FOR DELETE
    USING (get_user_role(auth.uid()) = 'Admin');