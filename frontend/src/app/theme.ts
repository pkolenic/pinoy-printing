import { createTheme } from '@mui/material/styles';
import {
  blue,
  blueGrey,
  grey,
  red,
} from '@mui/material/colors';
import { IThemeColors } from "../types";

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

export const getDynamicTheme = (theme: IThemeColors) => {
  const themeConfig = {
    palette: {
      primary: {
        main: theme.primaryColor || import.meta.env.VITE_THEME_PRIMARY_COLOR || blue["400"],
      },
      secondary: {
        main: theme.secondaryColor || import.meta.env.VITE_THEME_SECONDARY_COLOR || grey["400"],
      },
      error: {
        main: theme.errorColor || import.meta.env.VITE_THEME_ERROR_COLOR || red["500"],
      },
      background: {
        default: '#FFF',
        paper: theme.paperColor || import.meta.env.VITE_THEME_PAPER_COLOR || blueGrey["50"],
      },
      selected: {
        main: theme.selectedColor || import.meta.env.VITE_THEME_SELECTED_COLOR || '#0A001F',
      },
      selectedHover: {
        main: theme.selectedHoverColor || import.meta.env.VITE_THEME_SELECTED_HOVER_COLOR || '#2C2A4A',
      },
    },
    typography: {
      // Customize fonts, sizes, etc.
    }
  };
  return createTheme(themeConfig);
};
