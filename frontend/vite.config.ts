import react from "@vitejs/plugin-react"
import * as path from "node:path"
import {defineConfig} from "vitest/config"
import packageJson from "./package.json" with {type: "json"}

// Define a default port in case the environment variable isn't set
const backendPort = process.env.VITE_BACKEND_PORT || 3001;
const targetUrl = `http://localhost:${backendPort}`;

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    server: {
        open: true,
        port: parseInt(process.env.VITE_FRONTEND_PORT || '5173', 10),
        // Proxy Settings so that the frontend can make requests to the backend
        proxy: {
            "/api": {
                target: targetUrl,
                changeOrigin: true,
            },
        },
    },

    test: {
        root: import.meta.dirname,
        name: packageJson.name,
        environment: "jsdom",

        typecheck: {
            enabled: true,
            tsconfig: path.join(import.meta.dirname, "tsconfig.json"),
        },

        globals: true,
        watch: false,
        setupFiles: ["./src/setupTests.ts"],
    },
})
