import {
  Fragment,
  useEffect,
  useState,
} from 'react';
import {
  CssBaseline
} from '@mui/material';
import { LoadingPanel, MessagePanel } from './components';
import {
  CategoryFilterBar,
  ShopAppBar,
  Footer,
} from './layout';
import { Profile, Shop } from './pages';
import { useAuthSession, useEnv } from "./hooks";
import "./App.css"

export function App() {
  const {
    isAuthenticated,
    isLoading,
    errorMessage,
    isSessionActive,
    loginWithRedirect
  } = useAuthSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const authenticationRequired = useEnv(import.meta.env.VITE_REQUIRE_AUTHENTICATION, false);

  useEffect(() => {
    if (authenticationRequired && !isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isLoading) {
    return <LoadingPanel/>;
  }

  if (errorMessage) {
    return <MessagePanel severity="error" title="Something went wrong" message={errorMessage}/>;
  }

  const hasAccess = !authenticationRequired || isSessionActive;
  if (!hasAccess) {
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
