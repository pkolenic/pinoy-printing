import { Fragment, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { LoadingPanel } from './components';
import {
  CategoryFilterBar,
  ShopAppBar,
  Footer,
} from './layout';
import { Profile, Shop } from './pages';
import { useAuthSession, useSiteConfig } from "./hooks";
import "./App.css"

export function App() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const requireAuthentication = useSiteConfig('settings.requireAuthentication', false);

  // Pass the requirement directly to the hook
  const { isLoading, isSessionActive } = useAuthSession(requireAuthentication);

  if (isLoading) {
    return <LoadingPanel/>;
  }

  // Final Gate: If auth is required, we must be active.
  // Otherwise, we just need to not be "loading".
  const canAccess = !requireAuthentication || isSessionActive;
  if (!canAccess) {
    return null;
  }

  return (
    <Fragment>
      <CssBaseline/>
      <ShopAppBar onProfileClick={() => setIsProfileOpen(true)}>
        <CategoryFilterBar sx={{ display: { xs: 'none', md: 'block' } }}/>
      </ShopAppBar>
      <Shop/>
      <Footer/>

      {isProfileOpen && (<Profile onClose={() => setIsProfileOpen(false)}/>)}
    </Fragment>
  );
}
