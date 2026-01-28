# Sentinel Core API Reference

Enterprise-grade API documentation for the real-time global event intelligence system.

## Versioning & Base URL

This API uses namespace-based versioning. The current stable version is **v1**.

**Base URL**: `http://localhost:8000/api/v1/`

## Authentication & Security

### Authentication
The API uses Token-based authentication. Include the token in the `Authorization` header.

**Header**: `Authorization: Token <your_token>`

### Rate Limiting (Throttling)
To ensure system stability, the following limits are enforced:
- **Public Endpoints**: 100 requests / day (Anonymous)
- **Private Endpoints**: 1,000 requests / day (Authenticated User)
- **Login Endpoint**: 5 attempts / minute (Scoped)

---

## Intelligence & Reporting

### [POST] Submit Event Report (Public)
**Endpoint**: `/reports/`

Submit a new intelligence report. Supports multi-part form data for media attachments.

---

## Event Management (Admin)

### [GET] List Events
**Endpoint**: `/admin/events/`

**Pagination**: This endpoint is paginated.
- `page`: Page number (integer)
- `limit`: Number of results per page (integer)

**Query Parameters**:
- `bbox`: minLon,minLat,maxLon,maxLat
- `severity`: low, medium, high, critical
- `status`: pending, verified, escalated, archived

### [POST] Action on Event
**Endpoint**: `/admin/events/{id}/{action}/`
- **Actions**: `verify`, `escalate`, `archive`

---

## Interactive Documentation

- **Swagger UI**: `/api/v1/schema/swagger-ui/`
- **Redoc**: `/api/v1/schema/redoc/`
