import "./App.css"
import {
  Fragment,
  useState,
} from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import ShopAppBar from './layout/ShopAppBar.tsx';
import { StatusPanel } from "./layout/StatusPanel";
import Shop from './pages/Shop';
import ProfileDialog from './pages/userProfile/ProfileDialog.tsx';

import { useAuthSession } from "./hooks/useAuthSession";


export function App() {
  const {
    isAuthenticated,
    isLoading,
    errorMessage,
    userProfile,
    token,
    loginWithRedirect
  } = useAuthSession();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Redirect if not authenticated
  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().then();
    return null;
  }

  const renderContent = () => {
    if (isLoading) {
      return <StatusPanel title="Loading..." isLoading/>;
    }

    if (errorMessage) {
      return <StatusPanel title="Oops!" message="Something went wrong" subMessage={errorMessage}/>;
    }

    if (isAuthenticated && token && userProfile) {
      return (
        <Fragment>
          <ShopAppBar
            onProfileClick={() => setIsProfileOpen(true)}
          />
          <Shop/>

          {isProfileOpen && (
            <ProfileDialog
              onClose={() => setIsProfileOpen(false)}
            />
          )}
        </Fragment>
      )
    }

    return null;
  };

  return (
    <Fragment>
      <CssBaseline />
      {renderContent()}
    </Fragment>
  );
}
