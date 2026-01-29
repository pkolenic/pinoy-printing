import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';

const GhostButton = styled(Button)(({ theme }) => ({
  backgroundColor: 'transparent',
  color: theme.palette.text.primary, // Uses your theme's default text color
  boxShadow: 'none',
  '&:hover': {
    backgroundColor: theme.palette.action.hover, // Uses your theme's hover color
    boxShadow: 'none',
  },
}));

export default GhostButton;
