# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# State 2: Build Backend
FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm install --prefix backend
COPY backend/ ./backend/
# Copy frontend build into the backend's public/dist folder
# (Adjust 'backend/public' to wherever your Express app serves static files from)
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Build TypeScript
RUN cd backend && npx tsc

EXPOSE 3001
CMD ["npm", "start", "--prefix", "backend"]
