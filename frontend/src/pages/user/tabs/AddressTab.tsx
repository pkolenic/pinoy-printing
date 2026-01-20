import {
  useState,
  useEffect,
  Fragment,
  ChangeEvent,
  SyntheticEvent,
} from "react";
import { useAuthSession } from "../../../hooks";
import { userFeature } from "../../../features";

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
  const [updateAddress, {isLoading: isUpdating}] = userFeature.useUpdateAddressMutation();
  const [createAddress, {isLoading: isCreating}] = userFeature.useCreateAddressMutation();
  const [deleteAddress] = userFeature.useDeleteAddressMutation();
  const {userProfile, isLoading, errorMessage} = useAuthSession();
  const [isEditing, setIsEditing] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);
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
    setAddressId(null);
    setFormData(null);
  };

  const handleOpenEdit = (index: number | null = null) => {
    setIsEditing(true);
    if (index !== null) {
      setFormData(addressData[index]);
      setAddressId(addressData[index].id);
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

  const handleDelete = async (index: number) => {
    if (!userProfile?.id) {
      return;
    }

    try {
      await deleteAddress({
        id: userProfile.id,
        addressId: addressData[index].id
      }).unwrap(); // .unwrap() allows us to catch errors here

      setSnackbar({
        open: true,
        message: 'Address deleted successfully!',
        severity: 'success',
      })
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Failed to delete address. Please try again',
        severity: 'error',
      });
    }
  };

  const handleSetDefault = async (index: number) => {
    if (!userProfile?.id) {
      return;
    }

    try {
      await updateAddress({
        id: userProfile.id,
        addressId: addressData[index].id,
        data: {...addressData[index], isPrimary: true},
      }).unwrap(); // .unwrap() allows us to catch errors here

      setSnackbar({
        open: true,
        message: 'Default address updated!',
        severity: 'success',
      })
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Failed to update address. Please try again',
        severity: 'error',
      })
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const {name, value, type, checked} = e.target;
    // Handle checkbox input correctly
    const newValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => prev && ({...prev, [name]: newValue}));
  }

  const handleSave = async () => {
    if (!formData || !userProfile?.id) {
      return;
    }

    // Validate that there are no duplicate name/labels
    const isDuplicateLabel = addressData.some((address: Address) => {
      // Check if the name matches (case-insensitive)
      const matchesLabel = address.name.toLowerCase() === formData.name.toLowerCase();

      // If editing, exclude the current address from the check
      if (addressId != null) {
        return matchesLabel && address.id !== addressId;
      }

      return matchesLabel;
    })

    if (isDuplicateLabel) {
      setSnackbar({
        open: true,
        message: `An address with the label "${formData.name}" already exists.`,
        severity: 'error',
      });
      return;
    }


    try {
      if (addressId != null) {
        await updateAddress({
          id: userProfile.id,
          addressId: addressId,
          data: formData,
        }).unwrap(); // .unwrap() allows us to catch errors here
      } else {
        await createAddress({
          id: userProfile.id,
          data: formData,
        }).unwrap(); // .unwrap() allows us to catch errors here
      }

      setSnackbar({
        open: true,
        message: addressId ? 'Address updated successfully!' : 'Address created successfully!',
        severity: 'success',
      });
      handleCloseEdit();
    } catch (err) {
      setSnackbar({
        open: true,
        message: addressId ? 'Failed to update address. Please try again' : 'Failed to create address. Please try again',
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
                name="name"
                value={formData?.name}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isUpdating || isCreating}
              />

              <TextField
                label="Street Address"
                name="street"
                value={formData?.street}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isUpdating || isCreating}
              />
              <TextField
                label="Street Address Line 2 (Optional)"
                name="street2"
                value={formData?.street2}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                disabled={isUpdating || isCreating}
              />

              {/* City, State, ZIP in a single row stack */}
              <Stack direction="row" spacing={2}>
                <TextField
                  label="City"
                  name="city"
                  value={formData?.city}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  disabled={isUpdating || isCreating}
                />
                <TextField
                  label="Region"
                  name="region"
                  value={formData?.region}
                  onChange={handleChange}
                  sx={{width: 160}}
                  variant="outlined"
                  disabled={isUpdating || isCreating}
                />
                <TextField
                  label="Postal Code"
                  name="postalCode"
                  value={formData?.postalCode}
                  onChange={handleChange}
                  sx={{width: 160}}
                  variant="outlined"
                  disabled={isUpdating || isCreating}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData?.isPrimary}
                    onChange={handleChange}
                    name="isPrimary"
                    disabled={isUpdating || isCreating}
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