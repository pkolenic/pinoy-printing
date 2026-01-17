import {
  cloneElement,
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
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useScrollTrigger
} from '@mui/material';
import { SearchBox } from '../../components';

interface Props {
  children?: ReactElement<{ elevation?: number }>;
  onProfileClick: () => void;
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
    userProfile: user = {name: "User", picture: "/static/images/avatar/2.jpg"},
  } = useAuthSession();
  const companyTitle = import.meta.env.VITE_APP_TITLE || 'Sample0';

  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const settings = {
    'View Profile': () => {
      onProfileClick();
      handleCloseUserMenu();
    },
    'See Orders': () => {
      console.log('Seeing Orders...');
      handleCloseUserMenu();
    },
    'Logout': () => {
      handleLogout();
    }
  }

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
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                  >
                    {Object.entries(settings).map(([settingText, onClickHandler]) => (
                      <MenuItem
                        key={settingText}
                        onClick={onClickHandler}
                      >
                        <Typography sx={{textAlign: 'center'}}>{settingText}</Typography>
                      </MenuItem>
                    ))}
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
          minHeight: {xs: '120px;', lg: '64px'},
        }}
      />
    </Fragment>
  );
}
