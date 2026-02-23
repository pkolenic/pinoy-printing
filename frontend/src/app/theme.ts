import { createTheme } from '@mui/material/styles';
import {
  blue,
  blueGrey,
  grey,
  red,
} from '@mui/material/colors';
import { SiteConfig } from "../features/models.ts";

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

export const getDynamicTheme = (config: SiteConfig) => createTheme({
  palette: {
    primary: {
      main: config.primaryColor || import.meta.env.VITE_PRIMARY_COLOR || blue["400"],
    },
    secondary: {
      main: config.secondaryColor || import.meta.env.VITE_SECONDARY_COLOR || grey["400"],
    },
    error: {
      main: config.errorColor || import.meta.env.VITE_ERROR_COLOR || red["500"],
    },
    background: {
      default: '#FFF',
      paper: config.paperColor || import.meta.env.VITE_PAPER_COLOR || blueGrey["50"],
    },
    selected: {
      main: config.selectedColor || import.meta.env.VITE_SELECTED_COLOR || '#0A001F',
    },
    selectedHover: {
      main: config.selectedHoverColor || import.meta.env.VITE_SELECTED_HOVER_COLOR || '#2C2A4A',
    },
  },
  typography: {
    // Customize fonts, sizes, etc.
  }
});
