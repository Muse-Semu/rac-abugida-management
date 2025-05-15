import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Avatar,
  Chip,
  Tooltip,
  InputAdornment,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchUsers,
  fetchRoles,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} from '../../store/slices/userSlice';

interface User {
  id: string;
  email: string;
  full_name: string;
  designation: string;
  is_active: boolean;
  role?: {
    id: number;
    role_name: string;
  } | null;
}

interface Role {
  id: number;
  role_name: string;
  description: string;
}

export const UserList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, roles, loading, error } = useAppSelector((state) => state.users);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    designation: '',
    role_id: '',
    is_active: true,
  });

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchRoles());
  }, [dispatch]);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        designation: user.designation,
        role_id: user.role?.id?.toString() || '',
        is_active: user.is_active,
      });
    } else {
      setSelectedUser(null);
      setFormData({
        email: '',
        full_name: '',
        designation: '',
        role_id: '',
        is_active: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | 
    React.ChangeEvent<{ name?: string; value: string }> |
    { target: { name?: string; value: string } }
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name as string]: value,
    }));
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    dispatch(toggleUserStatus({ userId, currentStatus }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        // Update existing user
        dispatch(updateUser({
          userId: selectedUser.id,
          userData: {
            full_name: formData.full_name,
            designation: formData.designation,
            role_id: formData.role_id,
            is_active: formData.is_active,
          },
        }));
      } else {
        // Create new user
        dispatch(createUser({
          email: formData.email,
          full_name: formData.full_name,
          designation: formData.designation,
          role_id: formData.role_id,
          is_active: formData.is_active,
        }));
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      dispatch(deleteUser(userId));
    }
  };

  const filteredUsers = users.filter(user => {
    if (!user) return false;
    
    const searchLower = searchQuery.toLowerCase();
    const fullName = (user.full_name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const designation = (user.designation || '').toLowerCase();
    const roleName = (user.role?.role_name || '').toLowerCase();

    return (
      fullName.includes(searchLower) ||
      email.includes(searchLower) ||
      designation.includes(searchLower) ||
      roleName.includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add User
        </Button>
      </Box>

      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search users..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {filteredUsers.map((user) => (
        <Paper
          key={user.id}
          sx={{
            p: 2,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">{user.full_name}</Typography>
              <Typography color="textSecondary">{user.email}</Typography>
              <Typography variant="body2">{user.designation}</Typography>
              {user.role && (
                <Chip
                  label={user.role.role_name}
                  color={user.role.role_name === 'Admin' ? 'error' : 'primary'}
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={user.is_active}
                  onChange={() => handleToggleActive(user.id, user.is_active)}
                  color="primary"
                />
              }
              label={user.is_active ? 'Active' : 'Inactive'}
            />
            <Tooltip title="Edit">
              <IconButton onClick={() => handleOpenDialog(user)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton onClick={() => handleDelete(user.id)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      ))}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            {!selectedUser && (
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                sx={{ mb: 2 }}
              />
            )}
            <TextField
              fullWidth
              label="Full Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Designation"
              name="designation"
              value={formData.designation}
              onChange={handleInputChange}
              required
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                name="role_id"
                value={formData.role_id}
                onChange={handleInputChange}
                label="Role"
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.role_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  name="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {selectedUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 