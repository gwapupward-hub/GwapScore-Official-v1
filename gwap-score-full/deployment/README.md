# GwapScore Deployment Guide

This directory contains deployment configurations for the GwapScore Trust Protocol.

## Quick Start with Docker Compose

1. Copy the environment template:
```bash
cp ../.env.example .env
```

2. Edit `.env` with your configuration:
```bash
# IMPORTANT: Change these in production!
DB_PASSWORD=your_secure_password
JWT_SECRET=your_long_random_secret_string
```

3. Start the services:
```bash
docker-compose up -d
```

4. Check the health:
```bash
curl http://localhost:3000/v1/system/health
```

## Production Deployment

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- PostgreSQL 14+ (if not using Docker for database)

### Environment Variables

Required variables for production:

```env
NODE_ENV=production
DB_PASSWORD=<secure-password>
JWT_SECRET=<long-random-string>
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=warn
```

### Database Setup

If using external PostgreSQL:

```bash
# Run schema migration
psql -h localhost -U gwapscore_user -d gwapscore -f ../database/schema.sql
```

### SSL/TLS Configuration

For production, use a reverse proxy (nginx/Caddy) with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name api.gwapscore.xyz;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Kubernetes Deployment

Example Kubernetes manifests:

```yaml
# See k8s/ directory for complete examples
```

## Monitoring

The API exposes the following endpoints for monitoring:

- `/v1/system/health` - Health check endpoint
- `/v1/system/version` - Version information

Integrate with your monitoring stack (Prometheus, Datadog, etc.).

## Backup

Database backups should be automated:

```bash
# Backup
docker-compose exec db pg_dump -U gwapscore_user gwapscore > backup.sql

# Restore
docker-compose exec -T db psql -U gwapscore_user gwapscore < backup.sql
```

## Scaling

For horizontal scaling:

1. Use external PostgreSQL with connection pooling (PgBouncer)
2. Deploy multiple API instances behind a load balancer
3. Consider Redis for session/cache storage
4. Use read replicas for read-heavy workloads

## Security Checklist

- [ ] Change default passwords
- [ ] Generate strong JWT secret
- [ ] Configure CORS appropriately
- [ ] Enable SSL/TLS
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Enable database connection encryption
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Implement API key rotation policy

## Troubleshooting

### Database Connection Issues

```bash
# Check database is running
docker-compose ps db

# View database logs
docker-compose logs db

# Test connection
docker-compose exec api node -e "require('./dist/database/client.js').healthCheck().then(console.log)"
```

### API Not Responding

```bash
# View API logs
docker-compose logs api

# Check health endpoint
curl http://localhost:3000/v1/system/health

# Restart API
docker-compose restart api
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/gwapupward-hub/GwapScore-Official-v1/issues
- Documentation: See `/docs` directory
