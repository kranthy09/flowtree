FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies into the image — node_modules stays in the container
COPY package.json ./
RUN npm install

# ── Dev stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app

# Copy pre-built node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all project files (src/ & public/ are overridden by volume in dev)
COPY . .

# WSL2 + Docker requires polling for file-change detection
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
