import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';

interface LoadingPanelProps {
  message?: string;
  showProgress?: boolean;
}

export const LoadingPanel = ({message = "Loading...", showProgress = true}: LoadingPanelProps) => {

  return (
    <Box sx={{
      p: 4,
      maxWidth: 450,
      margin: 'auto',
      bgcolor: 'background.paper',
      boxShadow: 3,
      borderRadius: 2,
      textAlign: 'center'
    }}>
      {showProgress && <CircularProgress sx={{ mb: 2 }} />}
      <Typography>{message}</Typography>
    </Box>
  );
}
