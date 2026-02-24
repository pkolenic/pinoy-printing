import react from "@vitejs/plugin-react";
import basicSsl from '@vitejs/plugin-basic-ssl';
import * as path from "node:path";
import {defineConfig} from "vitest/config";
import packageJson from "./package.json" with {type: "json"};

// Define a default port in case the environment variable isn't set
const backendPort = process.env.VITE_BACKEND_PORT || 3001;
const targetUrl = `http://localhost:${backendPort}`;

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
      react(),
      basicSsl(),
    ],
    build: {
      // Output directly to the backend's public folder
      outDir: '../backend/public',
      // Empty the folder before building to remove old files
      emptyOutDir: true,
    },
    server: {
        // Allow local test domains
        allowedHosts: ['localhost', '.test'],
        open: true,
        port: parseInt(process.env.VITE_FRONTEND_PORT || '5173', 10),
        host: true,
        // Proxy Settings so that the frontend can make requests to the backend
        proxy: {
            "/api": {
                target: targetUrl,
                changeOrigin: true,
            },
            "/site": {
                target: targetUrl,
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
                    });
                },
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
