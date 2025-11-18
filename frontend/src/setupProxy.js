import { createProxyMiddleware} from "http-proxy-middleware";

// Define a default port in case the environment variable isn't set
const backendPort = process.env.VITE_BACKEND_PORT || 3001;
const targetUrl = `http://localhost:${backendPort}`;

module.exports = function(app) {
  app.use(
    '/api', // Proxy all requests that start with /api
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
    })
  );
  // You can add more proxy routes here if needed
};
