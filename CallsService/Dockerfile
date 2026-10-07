FROM golang:1.25-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/calls-server .

FROM alpine:latest
WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/calls-server /app/calls-server
COPY --from=builder /app/index.html /app/index.html

EXPOSE 8000
EXPOSE 50000-50050/udp
CMD ["/app/calls-server"]
