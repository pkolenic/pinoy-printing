import {
  Box,
  CssBaseline,
  Divider,
  Drawer as MuiDrawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  styled,
  Theme,
  CSSObject,
} from '@mui/material/styles';

import { SvgIconComponent } from "@mui/icons-material";

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
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

export const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    variants: [
      {
        props: ({ open }) => open,
        style: {
          ...openedMixin(theme),
          '& .MuiDrawer-paper': openedMixin(theme),
        },
      },
      {
        props: ({ open }) => !open,
        style: {
          ...closedMixin(theme),
          '& .MuiDrawer-paper': closedMixin(theme),
        },
      },
    ],
  }),
);

export type MiniVariantDrawerProps = {
  listItems: [{
    id: string,
    label: string,
    icon: SvgIconComponent,
    onClick: () => void,
    color: string,
  }],
}

export const MiniVariantDrawer = ({ listItems } : MiniVariantDrawerProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Drawer variant="permanent" open={!isMobile}>
        <List>
          {listItems.map((item) => (
            item.id === 'divider' ? (<Divider/>) : (
              <ListItem key={item.id} disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  sx={[
                    {
                      minHeight: 48,
                      px: 2.5,
                    },
                    isMobile ? {
                      justifyContent: 'center',
                    } : {
                      justifyContent: 'initial',
                    }
                  ]}
                  onClick={item.onClick}
                >
                  <ListItemIcon
                    color={item.color || 'primary'}
                    sx={[
                      {
                        minWidth: 0,
                        justifyContent: 'center',
                      },
                      isMobile ? {
                        mr: 'auto',
                      } : {
                        mr: 3,
                      }
                    ]}
                  >
                    <item.icon />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        color: item.color || 'primary',
                      },
                    }}
                    sx={[
                      isMobile ? {
                        opacity: 0,
                      } : {
                        opacity: 1,
                      }
                    ]}
                  />
                </ListItemButton>
              </ListItem>
            )
          ))}
        </List>
      </Drawer>
    </Box>
  );
};
