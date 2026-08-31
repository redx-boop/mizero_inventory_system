# ============================================
# Mizero Inventory Hub — Frontend Dockerfile
# ============================================

# ---- Build Stage ----
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
# Use npm install instead of npm ci to avoid EBADPLATFORM errors
# from platform-specific optional esbuild packages in the lockfile
RUN npm install

COPY . ./
RUN npm run build

# ---- Production Stage (Nginx) ----
FROM nginx:1.27-alpine AS production

# Nginx architecture: master process runs as root (required to bind port 80
# and manage worker processes). Worker processes drop privileges to the
# "nginx" user defined in the base image's nginx.conf. This is the standard,
# secure approach for the official nginx Docker image.

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Pre-create nginx cache directories with correct permissions for the nginx user
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx

# Create uploads directory placeholder and set permissions
RUN touch /usr/share/nginx/html/.env && \
    chown -R nginx:nginx /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
