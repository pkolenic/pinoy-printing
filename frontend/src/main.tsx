import {StrictMode} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {App} from "./App"
import {store} from "./app/store"
import "./index.css"
import {Auth0Provider} from '@auth0/auth0-react';


const container = document.getElementById("root")

if (container) {
    const root = createRoot(container)
    root.render(
        <StrictMode>
            <Auth0Provider
                domain={import.meta.env.VITE_AUTH0_DOMAIN}
                clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
                authorizationParams={{
                    redirect_uri: window.location.origin,
                    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                }}
            >
                <Provider store={store}>
                    <App/>
                </Provider>
            </Auth0Provider>
        </StrictMode>,
    )
} else {
    throw new Error(
        "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file.",
    )
}
