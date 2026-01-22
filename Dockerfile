# ---------- BUILD ----------
FROM node:20-alpine AS build

WORKDIR /app

# Recebe variáveis no build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Torna disponíveis para o Vite
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build


# ---------- RUNTIME ----------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
