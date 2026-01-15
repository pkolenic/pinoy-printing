import "./App.css"
import { useAuthSession } from "./hooks/useAuthSession";
import { StatusPanel } from "./layout/StatusPanel";
import Shop from './pages/Shop';

export function App() {
  const {isAuthenticated, isLoading, errorMessage, userProfile, token, loginWithRedirect} = useAuthSession();

  if (isLoading) {
    return <StatusPanel title="Loading..." isLoading/>;
  }

  if (errorMessage) {
    return <StatusPanel title="Oops!" message="Something went wrong" subMessage={errorMessage}/>;
  }

  if (isAuthenticated && token && userProfile) {
    return <Shop/>;
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    loginWithRedirect().then();
  }

  return null;
}
