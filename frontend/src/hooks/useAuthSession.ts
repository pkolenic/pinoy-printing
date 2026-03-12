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

  // Unified Logout Handler
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    // Clear the Redux state immediately
    dispatch(authFeature.clearToken());
    await logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout, dispatch]);

  // Unified Login Handler
  const handleLogin = useCallback(async () => {
    await loginWithRedirect({
      authorizationParams: {
        'ext-tenant_id': getTenantId(),
      }
    });
  }, [loginWithRedirect]);

  // 1. Sync Token
  useEffect(() => {
    // If we are logged into Auth0 but don't have a Redux token yet, get it.
    if (isAuthenticated && !token && !isLoggingOut) {
      getAccessTokenSilently()
        .then(t => dispatch(authFeature.setToken(t)))
        .catch(async () => {
          if (requireAuth) {
            await handleLogout();
          } else {
            dispatch(authFeature.clearToken());
          }
        });
    }
  }, [isAuthenticated, token, getAccessTokenSilently, isLoggingOut, dispatch, handleLogout, requireAuth]);

  // 2. Fetch Backend Profile
  const userId = auth0User?.account?.id;
  const profile = userFeature.useGetUserQuery(
    (isAuthenticated && userId && token) ? userId : skipToken
  );

  // 3. Derive Loading & Active States

  // Active means we have the full set of data
  const isSessionActive = !!(isAuthenticated && token && profile.data);

  // We are "Busy" if we are authenticated but haven't finished the data chain yet.
  const isBusy = auth0Loading || isLoggingOut || (isAuthenticated && (!token || profile.isLoading));

  // 4. Redirect Logic
  useEffect(() => {
    // Only redirect if Auth0 has finished its initial check and we aren't already handling a code
    const isHandlingCallback = window.location.search.includes("code=");

    if (!auth0Loading && requireAuth && !isAuthenticated && !isHandlingCallback && !isLoggingOut) {
      handleLogin();
    }
  }, [auth0Loading, requireAuth, isAuthenticated, loginWithRedirect, isLoggingOut]);

  // 5. Logout on Missing Profile (Strictly for requireAuth mode)
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
    handleLogin,
    userProfile,
    token
  };
};
