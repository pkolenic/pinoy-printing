import { createTheme } from '@mui/material/styles';
import {
  blue,
  blueGrey,
  grey,
  red,
} from '@mui/material/colors';

// Augment the palette to include custom colors
declare module '@mui/material/styles' {
  interface Palette {
    selected: Palette['primary'];
    selectedHover: Palette['primary'];
  }

  interface PaletteOptions {
    selected?: PaletteOptions['primary'];
    selectedHover?: PaletteOptions['primary'];
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    selected: true;
    selectedHover: true;
  }
}

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
    },
    selected: {
      main: '#0A001F',
    },
    selectedHover: {
      main: '#2C2A4A',
    },
  },
  typography: {
     // Customize fonts, sizes, etc.
  }
});
export default theme;
