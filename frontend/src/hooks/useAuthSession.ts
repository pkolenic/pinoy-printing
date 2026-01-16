import { useEffect, useState } from "react";
import { useAuth0 } from '@auth0/auth0-react';
import { skipToken } from "@reduxjs/toolkit/query/react";
import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setToken, clearToken } from "../features/auth/auth.ts";
import { useGetUserQuery } from '../features/user/user.ts';

export const useAuthSession = () => {
  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    getAccessTokenSilently,
    loginWithRedirect,
    logout
  } = useAuth0();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);

  // Add a simple state to track logout status
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout({logoutParams: {returnTo: window.location.origin}})
      .then(() => {
        dispatch(clearToken());
      });
  };

  useEffect(() => {
    if (isAuthenticated && !token && !isLoggingOut) {
      getAccessTokenSilently()
        .then(t => dispatch(setToken(t)))
        .catch(err => {
          // Only log errors that aren't expected during logout
          if (err.error !== 'missing_refresh_token') {
            console.error("Token error", err);
          }
        });
    }
  }, [isAuthenticated, token, dispatch, getAccessTokenSilently]);

  const profile = useGetUserQuery(
    (isAuthenticated && token && user?.account?.id) ? user.account.id : skipToken
  );

  const getErrorMessage = (err: FetchBaseQueryError | SerializedError | Error | undefined): string => {
    if (!err) return "";
    if ('status' in err) return JSON.stringify(err.data); // FetchBaseQueryError
    if ('message' in err) return err.message || "An unknown error occurred"; // SerializedError or Error
    return "An unknown error occurred";
  };

  return {
    isAuthenticated,
    handleLogout,
    loginWithRedirect,
    isLoading: isLoading || profile.isLoading,
    errorMessage: getErrorMessage(error),
    userProfile: profile.data,
    token,
  };
};
