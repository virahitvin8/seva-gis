# ==========================================
# SEVA·GIS Production Cloud Run Container (nginx + Node.js)
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
# Stage 2: Production Runner with nginx + Node.js
# ==========================================
FROM node:22-alpine

WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx

COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY nginx.conf /etc/nginx/http.d/default.conf

# Cloud Run defaults to port 8080
ENV PORT=8080
EXPOSE 8080

# Start both nginx and Node.js
COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
