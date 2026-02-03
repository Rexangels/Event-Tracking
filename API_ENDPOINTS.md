# Sentinel API Endpoints - Authentication & Users

**Base URL**: `http://localhost:8000/api/v1`

---

## Authentication Endpoints

### Login (Get Token)
**POST** `/auth/login/`

Get JWT access and refresh tokens using username/password.

**Request**:
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response** (200 OK):
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "role": "admin",
  "username": "admin",
  "email": "admin@example.com"
}
```

**cURL**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

---

### Refresh Token
**POST** `/auth/refresh/`

Get a new access token using the refresh token.

**Request**:
```json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Response** (200 OK):
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

---

## User Management Endpoints

### Get Current User Profile
**GET** `/auth/users/me/`

Requires authentication.

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "admin",
  "organization": "Sentinel HQ",
  "date_joined": "2026-02-03T10:00:00Z"
}
```

**cURL**:
```bash
curl -X GET http://localhost:8000/api/v1/auth/users/me/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### Register New User
**POST** `/auth/users/`

Create a new user account.

**Request** (No authentication required):
```json
{
  "username": "officer1",
  "email": "officer@sentinel.local",
  "password": "SecurePass123",
  "password2": "SecurePass123",
  "first_name": "Jane",
  "last_name": "Officer",
  "role": "officer",
  "organization": "Field Ops"
}
```

**Response** (201 Created):
```json
{
  "id": 2,
  "username": "officer1",
  "email": "officer@sentinel.local",
  "first_name": "Jane",
  "last_name": "Officer",
  "role": "officer",
  "organization": "Field Ops",
  "date_joined": "2026-02-03T10:15:00Z"
}
```

**cURL**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "officer1",
    "email": "officer@sentinel.local",
    "password": "SecurePass123",
    "password2": "SecurePass123",
    "role": "officer",
    "organization": "Field Ops"
  }'
```

---

### List All Users
**GET** `/auth/users/`

List all users (Admin only).

**Headers**:
```
Authorization: Bearer {admin_access_token}
```

**Query Parameters**:
- `limit`: Results per page (default 20)
- `offset`: Pagination offset
- `search`: Search by username or email

**Response** (200 OK):
```json
{
  "count": 3,
  "next": "http://localhost:8000/api/v1/auth/users/?limit=20&offset=20",
  "previous": null,
  "results": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      ...
    },
    {
      "id": 2,
      "username": "officer1",
      "email": "officer@sentinel.local",
      "role": "officer",
      ...
    }
  ]
}
```

**cURL**:
```bash
curl -X GET "http://localhost:8000/api/v1/auth/users/?limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### Get User by ID
**GET** `/auth/users/{id}/`

Get specific user details.

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "id": 2,
  "username": "officer1",
  "email": "officer@sentinel.local",
  "first_name": "Jane",
  "last_name": "Officer",
  "role": "officer",
  "organization": "Field Ops",
  "date_joined": "2026-02-03T10:15:00Z"
}
```

---

### Logout
**POST** `/auth/users/logout/`

Logout current user (invalidates token).

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "detail": "Successfully logged out"
}
```

---

## User Roles & Permissions

### Admin Role
```
Permissions:
- View all events
- Create/Edit/Delete events
- Assign officers
- Manage users & roles
- Access analytics
- Access audit logs
```

### Officer Role
```
Permissions:
- View assigned events
- Update event status
- Submit inspection forms
- View reports
- Cannot access admin functions
```

### Public Role
```
Permissions:
- Create reports
- View own reports
- Upload media
- Cannot access admin/officer functions
```

---

## Error Responses

### Invalid Credentials (401)
```json
{
  "detail": "Invalid username or password"
}
```

### Unauthorized (401)
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### Permission Denied (403)
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### Not Found (404)
```json
{
  "detail": "Not found."
}
```

### Validation Error (400)
```json
{
  "username": ["This field is required."],
  "password": ["This field is required."]
}
```

---

## Authentication Flow (JWT)

### 1. User Logs In
```
POST /auth/login/
→ Returns: access_token, refresh_token
```

### 2. Make Authenticated Request
```
GET /auth/users/me/
Header: Authorization: Bearer {access_token}
→ Returns: User profile
```

### 3. Token Expires (1 hour)
```
Try to use expired access_token
→ Returns: 401 Unauthorized
```

### 4. Refresh Token
```
POST /auth/refresh/
Body: { "refresh": "{refresh_token}" }
→ Returns: New access_token
```

### 5. Refresh Token Also Expires (7 days)
```
User must login again
```

---

## Testing with Postman / Insomnia

### Setup Collection

1. **Create New Request** → POST
2. **URL**: `http://localhost:8000/api/v1/auth/login/`
3. **Body** (JSON):
   ```json
   {
     "username": "admin",
     "password": "your-password"
   }
   ```
4. **Send** → Copy `access` token

### Use Token in Requests

1. **Headers Tab** → Add:
   ```
   Authorization: Bearer {paste_access_token_here}
   ```
2. **URL**: `http://localhost:8000/api/v1/auth/users/me/`
3. **Send** → See your user profile

---

## Rate Limiting

Current configuration:
- **Anonymous users**: 100 requests/day
- **Authenticated users**: 1000 requests/day
- **Login attempts**: 5 per minute

Headers on response:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1675336800
```

If rate limited (429):
```json
{
  "detail": "Request was throttled. Expected available in 3600 seconds."
}
```

---

## API Documentation

**Interactive Docs** (Swagger/OpenAPI):
- http://localhost:8000/api/schema/ (ReDoc format)
- http://localhost:8000/api/v1/docs/ (Swagger UI - if configured)

**Download OpenAPI Schema**:
```bash
curl http://localhost:8000/api/schema/openapi.yaml > api_schema.yaml
```

---

**Last Updated**: February 3, 2026
