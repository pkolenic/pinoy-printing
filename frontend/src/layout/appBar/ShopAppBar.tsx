import {
  cloneElement,
  ElementType,
  Fragment,
  MouseEvent,
  ReactElement,
  useState,
} from 'react';
import { useAuthSession } from "../../hooks";

import {
  AppBar,
  Avatar,
  Box,
  Container,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  SvgIconProps,
  Toolbar,
  Tooltip,
  Typography,
  useScrollTrigger
} from '@mui/material';
import {
  Dashboard,
  Logout,
  PersonOutline,
  ReceiptLong
} from "@mui/icons-material";
import { SearchBox } from '../../components';

interface Props {
  children?: ReactElement<{ elevation?: number }>;
  onProfileClick: () => void;
}

type MenuOption = {
  id: string;
  label?: string;
  icon?: ElementType<SvgIconProps>;
  onClick?: () => void;
  color?: string;
  hide?: boolean;
  type?: 'option' | 'divider';
}

function ElevationScroll(props: Props) {
  const {children} = props;
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return children
    ? cloneElement(children, {
      elevation: trigger ? 4 : 0,
    })
    : null;
}

export const ShopAppBar = (props: Props) => {
  const {onProfileClick} = props;

  const {
    handleLogout,
    userProfile: user = {name: "User", picture: "/static/images/avatar/2.jpg", role: "customer"},
  } = useAuthSession();
  const companyTitle = import.meta.env.VITE_APP_TITLE || 'Sample0';

  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const isStaff = ['admin', 'staff', 'owner'].includes(user.role);

  const options: MenuOption[] = [
    {
      id: 'profile' as const,
      label: 'View Profile',
      icon: PersonOutline,
      onClick: () => {
        onProfileClick();
        handleCloseUserMenu();
      },
      color: 'primary.main',
    },
    {
      id: 'orders' as const,
      type: 'option',
      label: 'See Orders',
      icon: ReceiptLong,
      onClick: () => {
        console.log('Seeing Orders...');
        handleCloseUserMenu();
      },
      color: 'primary.main',
      hide: isStaff,
    },
    {
      id: 'dashboard' as const,
      type: 'option',
      label: 'Show Dashboard',
      icon: Dashboard,
      onClick: () => {
        console.log('Show Dashboard...');
        handleCloseUserMenu();
      },
      color: 'primary.main',
      hide: !isStaff,
    },
    {
      id: 'divider' as const,
      type: 'divider',
    },
    {
      id: 'logout' as const,
      type: 'option',
      label: 'Logout',
      icon: Logout,
      onClick: () => {
        handleLogout();
      },
      color: 'error.main',
    }
  ]

  // Filter out options that are hidden
  const visibleOptions: MenuOption[] = options.filter(option => !option.hasOwnProperty('hide') || !option.hide);

  const handleOpenUserMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <Fragment>
      <ElevationScroll {...props}>
        <AppBar
          color="inherit"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            pt: {xs: 2, lg: 0},
            pb: {xs: 2, lg: 0},
          }}
        >
          <Container maxWidth="lg">
            <Toolbar
              disableGutters
              sx={{
                flexDirection: {xs: 'column', lg: 'row'},
                justifyContent: {xs: 'flex-start', lg: 'space-between'},
                alignItems: {xs: 'flex-start', lg: 'center'},
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexGrow: {xs: 0, lg: 1},
                  mb: {xs: 1, lg: 0},
                }}
              >
                <Box sx={{flexGrow: 0}}>
                  <Tooltip title="Open settings">
                    <IconButton onClick={handleOpenUserMenu} sx={{p: 0}}>
                      <Avatar
                        alt={user.name}
                        src={user.picture}
                        sx={{width: 32, height: 32}}
                      />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    sx={{mt: '45px'}}
                    id="menu-appbar"
                    anchorEl={anchorElUser}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                  >
                    {visibleOptions.map((option) => {
                      // Handle Divider
                      if (option.type === 'divider') {
                        return <Divider key={option.id}/>;
                      }

                      // Converty to Capitalized variable
                      const Icon = option.icon;

                      return (
                        <MenuItem
                          key={option.id}
                          onClick={option.onClick}
                          sx={{
                            color: option.color || 'primary.main',
                            '& .MuiListItemIcon-root': {
                              color: option.color || 'primary.main',
                            },
                          }}
                        >
                          <ListItemIcon>
                            {/* Render only if Icon exists */}
                            {Icon && <Icon fontSize="small"/>}
                          </ListItemIcon>
                          <Typography sx={{textAlign: 'center'}}>{option.label}</Typography>
                        </MenuItem>
                      );
                    })}
                  </Menu>
                </Box>
                <Typography
                  variant="h6"
                  component="div"
                  sx={{ml: 2, mr: 2}}
                >
                  {companyTitle}
                </Typography>
              </Box>
              <SearchBox/>
            </Toolbar>
          </Container>
        </AppBar>
      </ElevationScroll>
      <Toolbar
        sx={{
          pt: {xs: 2, lg: 0},
          pb: {xs: 2, lg: 0},
          minHeight: {xs: '136px;', lg: '64px'},
        }}
      />
    </Fragment>
  );
}
