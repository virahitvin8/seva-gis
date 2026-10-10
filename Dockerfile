# ==========================================
# SEVA·GIS Production Cloud Run Container
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml* package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Set live Cloud Run Earth Engine Backend URL for production build
ENV VITE_EE_API_URL=https://seva-gis-backend-419602015618.us-central1.run.app

# Build optimized production bundle
RUN npm run build

# ==========================================
# Stage 2: Ultra-lightweight Node Production Runner
# ==========================================
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY server.js ./

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

# Cloud Run container startup command
CMD ["node", "server.js"]
