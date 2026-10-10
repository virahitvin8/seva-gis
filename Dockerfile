# ==========================================
# SEVA·GIS Production Cloud Run Container
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Set live Cloud Run Earth Engine Backend URL for production build
ENV VITE_EE_API_URL=https://seva-gis-backend-419602015618.us-central1.run.app

RUN pnpm build

# ==========================================
# Stage 2: Ultra-lightweight Nginx Web Server
# ==========================================
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# Cloud Run injects $PORT (default 8080); dynamically substitute in nginx config and start immediately
CMD ["sh", "-c", "sed -i 's/listen [0-9]*;/listen '\"${PORT:-8080}\"';/g' /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
