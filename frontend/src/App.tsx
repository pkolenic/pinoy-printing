import { Fragment, useState } from 'react';
import { CssBaseline } from '@mui/material';
import { LoadingPanel, MessagePanel } from './components';
import { ShopAppBar  } from './layout';
import { Profile, Shop} from './pages';
import { useAuthSession } from "./hooks";
import "./App.css"

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
      return <LoadingPanel />;
    }

    if (errorMessage) {
      return <MessagePanel severity="error" title="Something went wrong" message={errorMessage} />;
    }

    if (isAuthenticated && token && userProfile) {
      return (
        <Fragment>
          <ShopAppBar
            onProfileClick={() => setIsProfileOpen(true)}
          />
          <Shop/>

          {isProfileOpen && (
            <Profile
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
