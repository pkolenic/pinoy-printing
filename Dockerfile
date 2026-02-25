# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
# Build TypeScript to generate the 'dist' folder
RUN npx tsc

# --- Stage 3: Final Production Runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# 1. Copy only the built backend files
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package*.json ./

# 2. Copy the built frontend into the backend's static folder
COPY --from=frontend-builder /app/frontend/dist ./public

# 3. Install ONLY production dependencies (no tsc, no dev-tools)
RUN npm install --only=production

EXPOSE 3001
CMD ["node", "dist/index.js"]
