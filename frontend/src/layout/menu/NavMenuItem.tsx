import {
  Divider,
  ListItemIcon,
  MenuItem,
  Typography,
} from '@mui/material';
import { MenuOption } from "./types.ts";

export const NavMenuItem = ({ option, onAction }: { option: MenuOption, onAction: () => void }) => {
  if (option.type === 'divider') {
    return <Divider key={option.id} />;
  }

  const Icon = option.icon;
  return (
    <MenuItem
      key={option.id}
      onClick={onAction}
      sx={{
        color: option.color || 'primary.main',
        '& .MuiListItemIcon-root': { color: option.color || 'primary.main' },
      }}
    >
      <ListItemIcon>{Icon && <Icon fontSize="small" />}</ListItemIcon>
      <Typography textAlign="center">{option.label}</Typography>
    </MenuItem>
  );
};
