import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: import.meta.env.VITE_PRIMARY_COLOR || '#007bff',
    },
    secondary: {
      main: import.meta.env.VITE_SECONDARY_COLOR || '#6c757d',
    },
  }
});
export default theme;
