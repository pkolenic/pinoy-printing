import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { SvgIconComponent } from "@mui/icons-material";
import {
  styled,
  CSSObject,
  Theme
} from "@mui/material/styles";

export type DialogSidebarProps = {
  listItems: {
    id: string,
    label: string,
    icon: SvgIconComponent,
    onClick: () => void,
  }[],
  activeTab?: string,
}

const sidebarWidth = 240;

const desktopMixin = (theme: Theme): CSSObject => ({
  width: sidebarWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const mobileMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const SidebarContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open'
})<{ open?: boolean }>(({theme}) => ({
  borderRight: 1,
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.grey[50],
  height: '100%',
  boxSizing: 'border-box',
  variants: [
    {
      props: ({open}) => open,
      style: desktopMixin(theme),
    },
    {
      props: ({open}) => !open,
      style: mobileMixin(theme),
    },
  ],
}));

export const DialogSidebar = ({listItems, activeTab}: DialogSidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <SidebarContainer open={!isMobile} p={isMobile ? 1 : 2}>
      <List>
        {listItems.map(({id, icon: itemIcon, label, onClick}) => {
          // Converty to Capitalized variable
          const Icon = itemIcon;

          return (
            <ListItemButton
              key={id}
              onClick={onClick}
              selected={activeTab === id}
              sx={{
                borderRadius: 1,
                minHeight: 48,
                px: isMobile ? 0 : 2.5,
                justifyContent: 'center',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {bgcolor: 'primary.dark'}
                },
                '&:hover': {bgcolor: 'grey.200'}
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isMobile ? 0 : 3,
                  justifyContent: 'center',
                  color: activeTab === id ? 'primary.contrastText' : 'inherit',
                  px: isMobile ? 1.5 : 0,
                }}
              >
                <Icon />
              </ListItemIcon>
              <ListItemText
                primary={label}
                sx={{
                  opacity: isMobile ? 0 : 1,
                  display: isMobile ? 'none' : 'block',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </SidebarContainer>
  );
};