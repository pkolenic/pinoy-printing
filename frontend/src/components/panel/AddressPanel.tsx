import {
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  Address,
} from '../../features/models.ts';

interface AddressPanelProps {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

export const AddressPanel = ({
                               address,
                               onEdit,
                               onDelete,
                               onSetDefault,
                             }: AddressPanelProps) => {
  return (
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
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <Typography variant="subtitle1" fontWeight="bold">{address.name}</Typography>
            {address.isPrimary && (
              <Box
                sx={{
                  bgcolor: 'action.active',
                  color: 'background.paper',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 5,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                }}
              >
                Default
              </Box>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">{address.street}</Typography>
          {address.street2 && (
            <Typography variant="body2" color="text.secondary">{address.street2}</Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {address.city}, {address.region} {address.postalCode}
          </Typography>
        </Box>

        {/* Action Buttons (Edit/Delete) */}
        <Stack direction="row" spacing={0.5}>
          <IconButton onClick={onEdit} aria-label="edit address" size="small">
            <EditIcon fontSize="small"/>
          </IconButton>
          <IconButton onClick={onDelete} aria-label="delete address" size="small">
            <DeleteIcon fontSize="small" color="error"/>
          </IconButton>
        </Stack>
      </Stack>

      {/* Set as Default Button */}
      {!address.isPrimary && (
        <Box mt={2}>
          <Button
            variant="outlined"
            onClick={onSetDefault}
            size="small"
            sx={{
              borderRadius: 5,
              textTransform: 'none'
            }}
          >
            Set as Default
          </Button>
        </Box>
      )}
    </Box>
  );
};
