import { ElementType } from 'react';
import { SvgIconProps } from '@mui/material';

export type MenuOption = {
  id: string;
  label?: string;
  icon?: ElementType<SvgIconProps>;
  onClick?: () => void;
  color?: string;
  hide?: boolean;
  type?: 'option' | 'divider';
}
