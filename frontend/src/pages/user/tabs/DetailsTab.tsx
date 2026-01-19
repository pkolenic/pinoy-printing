import {
  useState,
  useEffect,
  Fragment,
  ChangeEvent,
  SyntheticEvent,
} from 'react';
import { useAuthSession } from "../../../hooks";
import { userFeature } from '../../../features'

import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import {
  LoadingPanel,
  MessagePanel,
  PhoneNumberInput,
} from "../../../components";

interface UserProfileData {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  picture?: string;
}

export function DetailsTab() {
  const [updateUser, {isLoading: isUpdating}] = userFeature.useUpdateUserMutation();
  const {userProfile, isLoading, errorMessage} = useAuthSession();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [formData, setFormData] = useState<UserProfileData | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [isPhoneValid, setIsPhoneValid] = useState(true);

  // Sync local state when the authenticated user profile
  useEffect(() => {
    if (userProfile) {
      // Map the `User` type from the hook to our internal structure
      const mappedUserData: UserProfileData = {
        username: userProfile.username,
        fullName: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        picture: userProfile.picture,
      };
      setUserData(mappedUserData);
      setFormData(mappedUserData);
    }
  }, [userProfile]);

  const handleCloseSnackbar = (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar((prev) => ({...prev, open: false}));
  };

  const handleEditToggle = () => {
    setIsEditing((prev) => !prev);
    if (isEditing) {
      setFormData(userData); // Reset form data to current saved data
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    setFormData((prev) => prev && ({...prev, [name]: value}));
  };

  const handleSave = async () => {
    if (!isPhoneValid) {
      return;
    }

    if (!formData || !userProfile?.id) {
      return;
    }

    try {
      await updateUser({
        id: userProfile.id,
        data: {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
      }).unwrap();  // .unwrap() allows us to catch errors here

      setSnackbar({
        open: true,
        message: 'Profile updated successfully!',
        severity: 'success',
      });

      setUserData(formData);
      setIsEditing(false);
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Failed to update profile. Please try again.',
        severity: 'error',
      });
    }
  };

  // Handle loading and error states
  if (isLoading) {
    return (<LoadingPanel message="Loading profile..."/>);
  }

  if (errorMessage) {
    return (<MessagePanel severity="error" title="Error" message={errorMessage}/>);
  }

  if (!userData || !formData) {
    return (<MessagePanel severity="info" message="No user data found."/>);
  }

  return (
    <Box sx={{p: 1, margin: 'auto', bgcolor: 'background.paper'}}>

      {/* Header with the Edit button */}
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3}}>
        <Typography variant="h5" component="h1" fontWeight="bold">
          Personal Information
        </Typography>
        {!isEditing && (
          <IconButton onClick={handleEditToggle} color="primary" aria-label="toggle edit mode">
            <EditIcon/>
            <Typography variant="button" sx={{ml: 1}}>Edit</Typography>
          </IconButton>
        )}
      </Box>

      {/* Profile Picture */}
      <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4}}>
        <Avatar sx={{width: 100, height: 100, mb: 2}} src={userData.picture}>
          {userData.fullName.charAt(0)}
        </Avatar>
      </Box>

      {/* User Details / Form Fields */}
      <Stack divider={<Divider flexItem/>} spacing={2}>
        {isEditing ? (
          <Fragment>
            {/* Form fields */}
            <TextField
              label="Username"
              name="username"
              value={formData.username}
              fullWidth
              disabled // As username cannot be changed
              variant="outlined"
            />
            <Typography variant="caption" color="text.secondary" sx={{mt: -1.5}}>
              Username cannot be changed
            </Typography>

            <TextField
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              fullWidth
              variant="outlined"
              disabled={isUpdating}
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              variant="outlined"
              disabled={isUpdating}
            />
            <PhoneNumberInput
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              onValidationChange={(isValid) => setIsPhoneValid(isValid)}
              disabled={isUpdating}
              fullWidth
              variant="outlined"
              helperText="Format: +[CountryCode][Number]"
            />
            {/* Buttons positioned at the bottom */}
            <Stack
              direction={{xs: 'column', md: 'row'}}
              spacing={2}
              sx={{mt: 3}}
            >
              <Button
                variant="contained"
                onClick={handleSave}
                color="primary"
                disabled={isUpdating || !isPhoneValid}
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                {isUpdating ? <CircularProgress size={24} color={"inherit"}/> : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleEditToggle}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
            </Stack>
          </Fragment>
        ) : (
          <Fragment>
            {/* View Mode Fields */}
            <div>
              <Typography variant="subtitle2" color="text.secondary">Username</Typography>
              <Typography variant="body1" fontWeight="medium">{userData.username}</Typography>
            </div>
            <div>
              <Typography variant="subtitle2" color="text.secondary">Full Name</Typography>
              <Typography variant="body1" fontWeight="medium">{userData.fullName}</Typography>
            </div>
            <div>
              <Typography variant="subtitle2" color="text.secondary">Email</Typography>
              <Typography variant="body1" fontWeight="medium">{userData.email}</Typography>
            </div>
            <div>
              <Typography variant="subtitle2" color="text.secondary">Phone</Typography>
              <Typography variant="body1" fontWeight="medium">{userData.phone}</Typography>
            </div>
          </Fragment>
        )}
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{width: '100%'}}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
