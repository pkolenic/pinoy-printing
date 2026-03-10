import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth0 } from '@auth0/auth0-react';
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useAppDispatch, useAppSelector } from './index.ts'
import { authFeature, userFeature } from "../features";
import { User, DEFAULT_USER } from "../features/models.ts";
import { getTenantId } from "../utils/domain.ts";

export const useAuthSession = (requireAuth: boolean = false) => {
  const {
    isAuthenticated,
    isLoading: auth0Loading,
    user: auth0User,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 1. Unified Logout Handler
  const handleLogout = useCallback(() => {
    setIsLoggingOut(true);
    // Clear the Redux state immediately
    dispatch(authFeature.clearToken());
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout, dispatch]);

  // 2. Sync Token
  useEffect(() => {
    // If we are logged into Auth0 but don't have a Redux token yet, get it.
    if (isAuthenticated && !token && !isLoggingOut) {
      getAccessTokenSilently()
        .then(t => dispatch(authFeature.setToken(t)))
        .catch(() => {
          if (requireAuth) {
            handleLogout();
          } else {
            dispatch(authFeature.clearToken());
          }
        });
    }
  }, [isAuthenticated, token, getAccessTokenSilently, isLoggingOut, dispatch, handleLogout, requireAuth]);

  // 3. Fetch Backend Profile
  const userId = auth0User?.account?.id;
  const profile = userFeature.useGetUserQuery(
    (isAuthenticated && userId && token) ? userId : skipToken
  );

  // 4. Derive Loading & Active States

  // Active means we have the full set of data
  const isSessionActive = !!(isAuthenticated && token && profile.data);

  // We are "Busy" if we are authenticated but haven't finished the data chain yet.
  const isBusy = auth0Loading || isLoggingOut || (isAuthenticated && (!token || profile.isLoading));

  // 5. Redirect Logic
  useEffect(() => {
    // Only redirect if Auth0 has finished its initial check and we aren't already handling a code
    const isHandlingCallback = window.location.search.includes("code=");

    if (!auth0Loading && requireAuth && !isAuthenticated && !isHandlingCallback && !isLoggingOut) {
      loginWithRedirect({
        authorizationParams: { 'ext-tenant_id': getTenantId() }
      });
    }
  }, [auth0Loading, requireAuth, isAuthenticated, loginWithRedirect, isLoggingOut]);

  // 6. Logout on Missing Profile (Strictly for requireAuth mode)
  useEffect(() => {
    if (requireAuth && profile.isSuccess && !profile.data && !isLoggingOut) {
      handleLogout();
    }
  }, [requireAuth, profile.isSuccess, profile.data, isLoggingOut, handleLogout]);

  // Sync Profile Data with default data
  const userProfile: User = useMemo(() => ({
    ...DEFAULT_USER,
    ...profile.data
  }), [profile.data]);

  return {
    isLoading: isBusy,
    isAuthenticated,
    isSessionActive,
    handleLogout,
    loginWithRedirect,
    userProfile,
    token
  };
};
