import {
  Alert,
  AlertTitle,
  Box
} from '@mui/material';

interface MessagePanelProps {
  severity: 'error' | 'info' | 'success' | 'warning';
  title?: string;
  message?: string;
}

export const MessagePanel = ({severity = 'success', title, message}: MessagePanelProps) => {
  return (
    <Box sx={{p: 4, maxWidth: 450, margin: 'auto', bgcolor: 'background.paper', boxShadow: 3, borderRadius: 2}}>
      <Alert severity={severity}>
        <AlertTitle>{title}</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
};
