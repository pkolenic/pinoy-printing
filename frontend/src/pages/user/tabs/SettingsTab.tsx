import {
  useState,
  FormEvent,
  MouseEvent,
  SyntheticEvent, ChangeEvent,
} from 'react';
import { useAuthSession } from "../../../hooks";
import { userFeature } from '../../../features'

import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  LoadingPanel,
  MessagePanel,
} from "../../../components";

interface FormData {
  password: string;
  confirmation: string;
}

export const SettingsTab = () => {
  const [updatePassword, {isLoading: isUpdating}] = userFeature.useUpdatePasswordMutation();

  const {userProfile, isLoading, errorMessage} = useAuthSession();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmation: '',
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleCloseSnackbar = (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar((prev) => ({...prev, open: false}));
  };

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleMouseUpPassword = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const hidePasswordForm = () => {
    setIsEditing(false);
    setShowPassword(false);
    setFormData({password: '', confirmation: ''});
  }

  const handleSetPassword = async (event?: FormEvent) => {
    // Prevent page reload
    if (event) event.preventDefault();

    // Skip if user somehow hasn't loaded by this point
    if (!userProfile?.id) {
      return;
    }

    const {password, confirmation} = formData;

    // 1. Verify that both passwords match
    if (password !== confirmation) {
      setSnackbar({
        open: true,
        message: 'Passwords do not match!',
        severity: 'error',
      });
      return;
    }

    // 2. Verify format of the password
    // At least 8 chars, 1 lowercase, 1 uppercase, 1 number, 1 special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      setSnackbar({
        open: true,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
        severity: 'error',
      });
      return;
    }

    try {
      await updatePassword({
        id: userProfile.id,
        data: {
          password: password,
        },
      }).unwrap();  // .unwrap() allows us to catch error here

      // Explicitly trigger the browser's password save/update dialog
      if (typeof window !== 'undefined' && 'PasswordCredential' in window) {
        try {
          const cred = new PasswordCredential({
            id: userProfile.email || userProfile.id,
            password: password,
          });
          await navigator.credentials.store(cred);
        } catch (apiErr) {
          console.warn('Credential store failed:', apiErr);
        }
      }

      setSnackbar({
        open: true,
        message: 'Password Updated',
        severity: 'success',
      });

      // NOTE: Some browsers need a slight delay before clearing fields
      // to "see" the successful submission.
      setTimeout(() => {
        hidePasswordForm();
      }, 500);
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Failed to update password. Please try again.',
        severity: 'error',
      });
    }
  }

  // Handle loading and error states
  if (isLoading) {
    return (<LoadingPanel message="Loading profile..."/>);
  }

  if (errorMessage) {
    return (<MessagePanel severity="error" title="Error" message={errorMessage}/>);
  }

  return (
    <Box sx={{p: 1, margin: 'auto', bgcolor: 'background.paper'}}>
      <Typography variant="h5" component="h1" fontWeight="bold">
        Account Settings
      </Typography>

      <Box
        sx={{
          p: 2,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: 1,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="bold">Password</Typography>
          <Typography variant="body2" fontWeight="bold">Change your password to keep your account secure</Typography>

          {isEditing ? (
            <Box component="form" onSubmit={handleSetPassword}>
              <Stack spacing={2}>
                {/* Hidden username field for browser detection */}
                <TextField
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={userProfile?.username || userProfile?.email || ''}
                  style={{display: 'none'}}
                  disabled
                />
                <TextField
                  label="Password"
                  name="password"
                  value={formData?.password || ''}
                  onChange={handleChange}
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  autoComplete="new-password"
                  disabled={isUpdating}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowPassword}
                            onMouseDown={handleMouseDownPassword}
                            onMouseUp={handleMouseUpPassword}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff/> : <Visibility/>}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  label="Confirm Password"
                  name="confirmation"
                  value={formData?.confirmation || ''}
                  onChange={handleChange}
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  disabled={isUpdating}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={handleClickShowPassword}
                            onMouseDown={handleMouseDownPassword}
                            onMouseUp={handleMouseUpPassword}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff/> : <Visibility/>}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                {/* Save/Cancel Buttons */}
                <Stack direction="row" spacing={1} mt={2}>
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    variant="outlined"
                    color="primary"
                  >
                    Set Password
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={hidePasswordForm}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Button
              variant="outlined"
              color="primary"
              sx={{width: 160, padding: 1}}
              onClick={() => setIsEditing(true)}
            >
              Change Password
            </Button>
          )}
        </Stack>
      </Box>

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
};
