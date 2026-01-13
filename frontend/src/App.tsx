import "./App.css"
import {useAuth0} from '@auth0/auth0-react';
import LogoutButton from './components/LogoutButton';

import Profile from './pages/Profile';


export function App() {
  const {isAuthenticated, isLoading, error} = useAuth0();
  const companyTitle = import.meta.env.VITE_APP_TITLE || 'Sample0';

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
    <div className="app-container">
      <div className="main-card-wrapper">
        <img
          src="https://cdn.auth0.com/quantum-assets/dist/latest/logos/auth0/auth0-lockup-en-ondark.png"
          alt="Auth0 Logo"
          className="auth0-logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <h1 className="main-title">{companyTitle}</h1>

        <div className="logged-in-section">
          <div className="logged-in-message">✅ Successfully authenticated!</div>
          <h2 className="profile-section-title">Your Profile</h2>
          <div className="profile-card">
            <Profile/>
          </div>
          <LogoutButton/>
        </div>
      </div>
    </div>
  );
}
