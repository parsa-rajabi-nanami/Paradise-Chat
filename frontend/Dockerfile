FROM node:20.19.0-alpine AS build
WORKDIR /app

# The Vite toolchain is a devDependency, but it is required while building the
# static bundle. Keep npm from inheriting a production-only install policy.
ENV NODE_ENV=development

ARG VITE_API_URL=http://localhost/api
ARG VITE_WS_HOST=localhost
ARG VITE_SITE_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_HOST=$VITE_WS_HOST \
    VITE_SITE_URL=$VITE_SITE_URL

COPY frontend/package*.json ./
# Vite and the React plugin are build-time devDependencies.
RUN npm config set registry "https://registry.npmjs.org/" \
    && npm ci --include=dev --ignore-scripts --no-audit --no-fund \
    && test -x node_modules/.bin/vite
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
