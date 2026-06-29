# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: 鏋勫缓鍓嶇 (React + Vite)
# 鍓嶇浜х墿鏄函闈欐€佹枃浠讹紝鍙渶鏋勫缓涓€娆★紝涓庣洰鏍囧钩鍙版棤鍏?
# ============================================================
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder

ARG BUILD_VERSION=dev

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY frontend/ .
RUN VITE_APP_VERSION=${BUILD_VERSION} npm run build

# ============================================================
# Stage 2: 鏋勫缓 Go 鍚庣
# 浣跨敤 BUILDPLATFORM 鍘熺敓杩愯 + TARGETARCH 浜ゅ弶缂栬瘧
# ============================================================
FROM --platform=$BUILDPLATFORM golang:1.26.4-alpine AS go-builder

ARG TARGETARCH

WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
COPY --from=frontend-builder /frontend/dist ./frontend/dist

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-s -w" -o /codex2api .

# ============================================================
# Stage 3: 鏈€缁堣繍琛岄暅鍍?
# ============================================================
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

COPY --from=go-builder /codex2api /usr/local/bin/codex2api

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/codex2api"]
