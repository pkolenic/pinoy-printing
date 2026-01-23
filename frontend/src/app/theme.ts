import { createTheme } from '@mui/material/styles';
import {
  blue,
  blueGrey,
  grey,
  red,
} from '@mui/material/colors';

const theme = createTheme({
  palette: {
    primary: {
      main: import.meta.env.VITE_PRIMARY_COLOR || blue["400"],
    },
    secondary: {
      main: import.meta.env.VITE_SECONDARY_COLOR || grey["400"],
    },
    error: {
      main: import.meta.env.VITE_ERROR_COLOR || red["500"],
    },
    background: {
      default: '#FFF',
      paper: import.meta.env.VITE_PAPER_COLOR || blueGrey["50"],
    }
  },
  typography: {
     // Customize fonts, sizes, etc.
  }
});
export default theme;
