import { StrictMode, useEffect, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { App } from "./App"
import { store } from "./app/store"
import { Auth0Provider } from '@auth0/auth0-react';
import { ThemeProvider } from '@mui/material/styles';
import { getDynamicTheme } from "./app/theme";
import {
  IThemeColors,
  IAuth0Settings,
  ISiteConfig,
} from "./types";
import { isPrimaryDomain } from "./utils/domain.ts";

import { siteFeature } from "./features/";

const AppBootstrap = () => {
  const skipQuery = useMemo(() => isPrimaryDomain(), []);

  // Fetch site configuration from the server, unless it's a primary domain
  const { data: siteConfig, isLoading, isError } = siteFeature.siteApiSlice.useGetSiteConfigQuery(
    undefined,
    { skip: skipQuery }
  );

  // Update the document title once siteConfig is loaded
  useEffect(() => {
    if (siteConfig?.site?.name) {
      document.title = siteConfig.site.name;
    }
  }, [siteConfig]);

  const { auth0Domain, auth0ClientId, auth0Audience, theme } = useMemo(() => {
    const {
      auth0 = {} as IAuth0Settings,
      theme: configTheme = {} as IThemeColors
    } = siteConfig || {} as ISiteConfig;

    const themeValue = getDynamicTheme(configTheme);

    return {
      auth0Domain: auth0.domain || import.meta.env.VITE_AUTH0_DOMAIN,
      auth0ClientId: auth0.clientId || import.meta.env.VITE_AUTH0_CLIENT_ID,
      auth0Audience: auth0.audience || import.meta.env.VITE_AUTH0_AUDIENCE,
      theme: themeValue,
    };
  }, [siteConfig]);

  // Handle Loading and Error State
  if (isLoading && !skipQuery) {
    return null;
  }

  if (isError) {
    return <div>Site Failed to Load</div>;
  }

  // Render Auth0Provider only after siteConfig is available
  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      useRefreshTokens={true} // Enables silent token renewal
      cacheLocation="localstorage" // Persists tokens across refreshes
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: auth0Audience,
        scope: "openid profile email offline_access", // Required for refresh tokens
      }}
    >
      <ThemeProvider theme={theme}>
        <App/>
      </ThemeProvider>
    </Auth0Provider>
  );
};

const container = document.getElementById("root")

// Need to fetch site configuration from the server before rendering the app.
// This is done in the `getServerSideProps` function in `pages/_app.tsx`.

if (container) {
  const root = createRoot(container)
  root.render(
    <StrictMode>
      <Provider store={store}>
        <AppBootstrap/>
      </Provider>
    </StrictMode>,
  )
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file.",
  )
}
