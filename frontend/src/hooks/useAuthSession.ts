import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth0 } from '@auth0/auth0-react';
import { skipToken } from "@reduxjs/toolkit/query/react";
import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { useAppDispatch, useAppSelector } from './index.ts'
import { authFeature, userFeature } from "../features";

export const useAuthSession = () => {
  const {
    isAuthenticated,
    isLoading,
    error,
    user: auth0User,
    getAccessTokenSilently,
    loginWithRedirect,
    logout
  } = useAuth0();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);

  // Add a simple state to track logout status
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(() => {
    setIsLoggingOut(true);
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  useEffect(() => {
    if (isAuthenticated && !token && !isLoggingOut) {
      getAccessTokenSilently()
        .then(t => dispatch(authFeature.setToken(t)))
        .catch(err => {
          // Specifically, check for the 'missing_refresh_token' error
          if (err.error === 'missing_refresh_token' || err.message?.includes('Missing Refresh Token')) {
            console.warn("Silent token acquisition skipped: Session already ended.");
            return; // Exit silently without triggering handleLogout
          }

          // Handle other legitimate failures
          console.error("Token acquisition failed, logging out:", err);
          handleLogout();
        });
    }
  }, [isAuthenticated, token, dispatch, getAccessTokenSilently, isLoggingOut, handleLogout]);

  const profile = userFeature.useGetUserQuery(
    (isAuthenticated && token && auth0User?.account?.id) ? auth0User.account.id : skipToken
  );

  const isSessionActive = useMemo(() =>
      !!(isAuthenticated && token && profile.data),
    [isAuthenticated, token, profile.data]
  );
  const isFullyLoaded = isAuthenticated ? isSessionActive : !isLoading;

  const getErrorMessage = (err: FetchBaseQueryError | SerializedError | Error | undefined): string => {
    if (!err) return "";
    if ('status' in err) return JSON.stringify(err.data); // FetchBaseQueryError
    if ('message' in err) return err.message || "An unknown error occurred"; // SerializedError or Error
    return "An unknown error occurred";
  };

  return {
    isAuthenticated,
    isSessionActive,
    handleLogout,
    loginWithRedirect,
    isLoading: !isFullyLoaded || profile.isLoading || isLoading || isLoggingOut,
    errorMessage: getErrorMessage(error),
    userProfile: profile.data,
    token,
  };
};
