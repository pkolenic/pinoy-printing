import "./App.css"
import {useAuth0} from '@auth0/auth0-react';

import Shop from './pages/Shop';


export function App() {
  const {isAuthenticated, isLoading, error} = useAuth0();

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-state">
          <div className="loading-text">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="error-state">
          <div className="error-title">Oops!</div>
          <div className="error-message">Something went wrong</div>
          <div className="error-sub-message">{error.message}</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const {loginWithRedirect} = useAuth0();
    loginWithRedirect().then(() => {});
  }

  return (
    <Shop />
  );
}
