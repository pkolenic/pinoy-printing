import {
  useState,
  useEffect,
  Fragment,
  ChangeEvent,
  SyntheticEvent,
} from "react";
import { useAuthSession } from "../../../hooks";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
  AddressPanel,
  LoadingPanel,
  MessagePanel,
} from "../../../components";
import { Address } from "../../../features/models";

export const AddressTab = () => {
  const {userProfile, isLoading, errorMessage} = useAuthSession();
  const [isEditing, setIsEditing] = useState(false);
  const [addressData, setAddressData] = useState<Address[]>([]);
  const [formData, setFormData] = useState<Address | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Sync local state when the authenticated user profile
  useEffect(() => {
    if (userProfile) {
      setAddressData(userProfile.addresses);
    }
  }, [userProfile])

  const handleCloseSnackbar = (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar((prev) => ({...prev, open: false}));
  };

  const handleCloseEdit = () => {
    setIsEditing(false);
    setFormData(null);
  };

  const handleOpenEdit = (addressIndex: number | null = null) => {
    setIsEditing(true);
    if (addressIndex !== null) {
      setFormData(addressData[addressIndex]);
    } else {
      // Reset form for a new address
      setFormData({
        name: '',
        street: '',
        street2: '',
        city: '',
        region: '',
        postalCode: '',
        isPrimary: false
      } as Address);
    }
  };

  /* TODO */
  const handleDelete = (index: number) => {
    console.log('Delete address', index);
    setSnackbar({
      open: true,
      message: 'Address deleted successfully!',
      severity: 'success',
    })
  };

  /* TODO */
  const handleSetDefault = (index: number) => {
    console.log('Set default address', index);
    setSnackbar({
      open: true,
      message: 'Default address updated!',
      severity: 'success',
    })
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const {name, value, type, checked} = e.target;
    // Handle checkbox input correctly
    const newValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => prev && ({...prev, [name]: newValue}));
  }

  /* TODO */
  const handleSave = async () => {
    setSnackbar({
      open: true,
      message: 'Address updated successfully!',
      severity: 'success',
    });

    handleCloseEdit();
  }

  // Handle loading and error states
  if (isLoading) {
    return (<LoadingPanel message="Loading profile..."/>);
  }

  if (errorMessage) {
    return (<MessagePanel severity="error" title="Error" message={errorMessage}/>);
  }

  if (!addressData) {
    return (<MessagePanel severity="info" message="No user data found."/>);
  }

  return (
    <Box sx={{p: 1, margin: 'auto', bgcolor: 'background.paper'}}>
      {/* Header with the Add Address Button */}
      <Stack
        direction={{xs: 'column', md: 'row'}}
        spacing={2}
        sx={{
          mb: 1,
          alignItems: {xs: 'flex-start', md: 'center'},
          justifyContent: {md: 'space-between'},
        }}
      >
        <Typography variant="h5" component="h1" fontWeight="bold">
          Shipping Addresses
        </Typography>
        {!isEditing && (
          <Button
            variant="outlined"
            onClick={() => handleOpenEdit()}
            color="primary"
            aria-label="toggle edit mode"
            startIcon={<AddIcon fontSize="small"/>}
            sx={{
              borderRadius: 5,
              paddingX: 1.5,
              textTransform: 'none'
            }}
          >
            Add Address
          </Button>
        )}
      </Stack>

      {/* Form Fields */}
      {isEditing && (
        <Fragment>
          <Box sx={{p: 2, borderRadius: 4, border: '1px solid divider', boxShadow: 1, mb: 2}}>
            <Typography variant="h6" gutterBottom>
              Edit Address
            </Typography>
            <Stack spacing={2}>
              {/* Label Field placeholder */}
              <TextField
                label="Label (e.g., Home, Work)"
                name="label"
                value={formData?.name}
                fullWidth
              />

              <TextField
                label="Street Address"
                name="street"
                value={formData?.street}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Street Address Line 2 (Optional)"
                name="street2"
                value={formData?.street2}
                onChange={handleChange}
                fullWidth
              />

              {/* City, State, ZIP in a single row stack */}
              <Stack direction="row" spacing={2}>
                <TextField
                  label="City"
                  name="city"
                  value={formData?.city}
                  onChange={handleChange}
                  fullWidth
                />
                <TextField
                  label="Region"
                  name="region"
                  value={formData?.region}
                  onChange={handleChange}
                  sx={{width: 160}}
                />
                <TextField
                  label="Postal Code"
                  name="postalCode"
                  value={formData?.postalCode}
                  onChange={handleChange}
                  sx={{width: 160}}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData?.isPrimary}
                    onChange={handleChange}
                    name="isPrimary"
                  />
                }
                label="Set as default address"
              />

              {/* Save/Cancel Buttons */}
              <Stack direction="row" spacing={1} mt={2}>
                <Button variant="contained" onClick={handleSave} color="primary">
                  Save Address
                </Button>
                <Button variant="outlined" onClick={() => handleCloseEdit()} color="secondary">
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Fragment>
      )}

      {/* Address Details */}
      <Stack spacing={2}>
        {addressData.map((address, index) => (
          <AddressPanel
            key={index}
            address={address}
            onEdit={() => handleOpenEdit(index)}
            onDelete={() => handleDelete(index)}
            onSetDefault={() => handleSetDefault(index)}
          />
        ))}
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
};