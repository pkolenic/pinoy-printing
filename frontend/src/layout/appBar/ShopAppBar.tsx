import {
  cloneElement,
  Fragment,
  ReactElement,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  useAuthSession,
  useElementSize,
  useSiteConfig,
} from "../../hooks";

import {
  AppBar,
  Avatar,
  Box,
  Container,
  IconButton,
  Menu,
  Toolbar,
  Tooltip,
  Typography,
  useScrollTrigger
} from '@mui/material';
import {
  Dashboard,
  Login,
  Logout,
  PersonOutline,
  ReceiptLong
} from "@mui/icons-material";
import { SearchBox } from '../../components';
import { NavMenuItem, MenuOption } from "../menu";

interface Props {
  children?: ReactElement<{ elevation?: number }>;
  onProfileClick: () => void;
}

function ElevationScroll({ children }: { children: ReactElement<{ elevation?: number }> }) {
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

export const ShopAppBar = ({ children, onProfileClick }: Props) => {
  const [appBarRef, { height }] = useElementSize();
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const {
    loginWithRedirect,
    handleLogout,
    isSessionActive,
    userProfile: user = { name: "User", picture: "/images/avatar/default.png", role: "customer" },
  } = useAuthSession();

  const isStaff = ['admin', 'staff', 'owner'].includes(user.role);
  const handleCloseUserMenu = useCallback(() => setAnchorElUser(null), []);

  const menuConfig = {
    id: "menu-appbar",
    sx: { mt: '5px' },
    anchorEl: anchorElUser,
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' } as const,
    transformOrigin: { vertical: 'top', horizontal: 'left' } as const,
    keepMounted: true,
  };

  const visibleOptions = useMemo(() => {
    const allOptions: MenuOption[] = [
      {
        id: 'profile',
        label: 'View Profile',
        icon: PersonOutline,
        onClick: onProfileClick,
        hide: !isSessionActive,
      },
      {
        id: 'orders',
        label: 'See Orders',
        icon: ReceiptLong,
        onClick: () => console.log('Orders'),
        hide: isStaff || !isSessionActive
      },
      {
        id: 'dashboard',
        label: 'Show Dashboard',
        icon: Dashboard,
        onClick: () => console.log('Dashboard'),
        hide: !isStaff
      },
      {
        id: 'sep',
        type: 'divider',
        hide: !isSessionActive,
      },
      {
        id: 'login',
        label: 'Login',
        icon: Login,
        onClick: loginWithRedirect,
        hide: isSessionActive,
      },
      {
        id: 'logout',
        label: 'Logout',
        icon: Logout,
        onClick: handleLogout,
        color: 'error.main',
        hide: !isSessionActive
      },
    ];
    return allOptions.filter(opt => !opt.hide);
  }, [isSessionActive, isStaff, onProfileClick, handleLogout, loginWithRedirect]);

  return (
    <Fragment>
      <ElevationScroll>
        <AppBar
          ref={appBarRef}
          color="inherit"
          sx={{
            backgroundColor: '#fff',
            pt: { xs: 2, lg: 0 },
            pb: { xs: 2, lg: 0 },
          }}
        >
          <Container
            maxWidth="lg"
            sx={{
              borderColor: 'divider',
              borderBottomStyle: 'solid',
              borderBottomWidth: { xs: 0, md: '1px' },
            }}
          >
            <Toolbar
              disableGutters
              sx={{
                flexDirection: { xs: 'column', lg: 'row' },
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <Tooltip title="Open settings">
                  <IconButton onClick={(e) => setAnchorElUser(e.currentTarget)} sx={{ p: 0 }}>
                    <Avatar
                      alt={user.name}
                      src={user.picture}
                      sx={{ width: 32, height: 32 }}
                    />
                  </IconButton>
                </Tooltip>
                <Menu
                  {...menuConfig}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  {visibleOptions.map((opt) => (
                    <NavMenuItem
                      key={opt.id}
                      option={opt}
                      onAction={() => {
                        opt.onClick?.();
                        handleCloseUserMenu();
                      }}
                    />
                  ))}
                </Menu>
                <Typography variant="h6" sx={{ ml: 2, mr: 2 }}>
                  { useSiteConfig('siteName', 'Sample0')}
                </Typography>
              </Box>
              <SearchBox sx={{ mt: { xs: 2, lg: 0 } }}/>
            </Toolbar>
          </Container>
          {children}
        </AppBar>
      </ElevationScroll>
      <Toolbar
        sx={{
          pt: { xs: 2, lg: 0 },
          pb: { xs: 2, lg: 0 },
          minHeight: `${height}px !important`,
        }}
      />
    </Fragment>
  );
}
