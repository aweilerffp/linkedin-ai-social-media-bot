# Social Media Poster API Documentation

## Overview

The Social Media Poster API provides comprehensive functionality for managing social media content across multiple platforms including LinkedIn and X/Twitter. This RESTful API supports user authentication, post scheduling, platform integration, analytics, and webhook notifications.

## Base URL

```
https://api.socialmediaposter.com/api/v1
```

## Authentication

The API uses JWT (JSON Web Token) based authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Lifecycle

- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days
- Use the refresh endpoint to obtain new tokens before expiration

## Rate Limits

Rate limits are enforced per user and endpoint:

- **Authentication endpoints**: 5 requests per minute
- **Post endpoints**: 100 requests per hour
- **Platform endpoints**: 50 requests per hour
- **Analytics endpoints**: 200 requests per hour

Rate limit headers are included in responses:
```
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 1640995200
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error message"
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Endpoints

### Authentication

#### Register User

Create a new user account and team.

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "teamName": "My Team"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "owner",
      "teamId": "team-id",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login

Authenticate user and receive tokens.

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "owner",
      "teamId": "team-id"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Refresh Token

Get new access and refresh tokens.

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Profile

Get current user profile information.

```http
GET /auth/profile
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "owner",
    "teamId": "team-id",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "lastLoginAt": "2024-01-20T14:22:00Z"
  }
}
```

#### Change Password

Change user password.

```http
PUT /auth/password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Posts

#### Create Post

Create a new scheduled post.

```http
POST /posts
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "Check out our latest product update! #innovation #tech",
  "platforms": ["linkedin", "twitter"],
  "scheduledAt": "2024-01-20T15:00:00Z",
  "imageUrl": "https://example.com/image.jpg",
  "tags": ["product", "update"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "post-id",
    "content": "Check out our latest product update! #innovation #tech",
    "platforms": ["linkedin", "twitter"],
    "status": "scheduled",
    "scheduledAt": "2024-01-20T15:00:00Z",
    "imageUrl": "https://example.com/image.jpg",
    "tags": ["product", "update"],
    "userId": "user-id",
    "teamId": "team-id",
    "createdAt": "2024-01-15T10:30:00Z",
    "queueJobId": "job-id"
  }
}
```

#### List Posts

Get user's posts with filtering and pagination.

```http
GET /posts?status=scheduled&platform=linkedin&page=1&limit=20
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` - Filter by post status (`scheduled`, `published`, `failed`, `cancelled`)
- `platform` - Filter by platform (`linkedin`, `twitter`)  
- `startDate` - Filter posts from date (ISO 8601)
- `endDate` - Filter posts until date (ISO 8601)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "post-id",
        "content": "Post content...",
        "platforms": ["linkedin"],
        "status": "scheduled",
        "scheduledAt": "2024-01-20T15:00:00Z",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

#### Get Post

Get a specific post by ID.

```http
GET /posts/{postId}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "post-id",
    "content": "Post content...",
    "platforms": ["linkedin", "twitter"],
    "status": "published",
    "scheduledAt": "2024-01-20T15:00:00Z",
    "publishedAt": "2024-01-20T15:00:05Z",
    "imageUrl": "https://example.com/image.jpg",
    "tags": ["product"],
    "userId": "user-id",
    "teamId": "team-id",
    "createdAt": "2024-01-15T10:30:00Z",
    "platformResults": [
      {
        "platform": "linkedin",
        "success": true,
        "platformPostId": "linkedin-post-123",
        "url": "https://linkedin.com/post/123",
        "publishedAt": "2024-01-20T15:00:03Z"
      },
      {
        "platform": "twitter",
        "success": true,
        "platformPostId": "twitter-post-456",
        "url": "https://twitter.com/post/456",
        "publishedAt": "2024-01-20T15:00:05Z"
      }
    ]
  }
}
```

#### Update Post

Update a scheduled post.

```http
PUT /posts/{postId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "Updated post content",
  "scheduledAt": "2024-01-20T16:00:00Z",
  "platforms": ["linkedin"]
}
```

**Note:** Only scheduled posts can be updated.

#### Cancel Post

Cancel a scheduled post.

```http
DELETE /posts/{postId}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Post cancelled successfully"
}
```

### Platform Connections

#### Get Connection Status

Get status of all platform connections.

```http
GET /platforms/connections
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "linkedin": {
      "connected": true,
      "connectedAt": "2024-01-15T10:30:00Z",
      "profileName": "John Doe",
      "profileId": "linkedin-profile-123"
    },
    "twitter": {
      "connected": false,
      "connectedAt": null,
      "profileName": null,
      "profileId": null
    }
  }
}
```

#### LinkedIn Authentication

Start LinkedIn OAuth flow.

```http
GET /platforms/linkedin/auth
Authorization: Bearer <access_token>
```

**Response:** Redirects to LinkedIn OAuth consent page.

#### LinkedIn Callback

Handle LinkedIn OAuth callback (called by LinkedIn).

```http
GET /platforms/linkedin/callback?code=oauth_code&state=state_token
```

#### Twitter Authentication

Start Twitter OAuth flow.

```http
GET /platforms/twitter/auth
Authorization: Bearer <access_token>
```

**Response:** Redirects to Twitter OAuth consent page.

#### Twitter Callback

Handle Twitter OAuth callback (called by Twitter).

```http
GET /platforms/twitter/callback?oauth_token=token&oauth_verifier=verifier
```

#### Disconnect Platform

Disconnect a platform.

```http
DELETE /platforms/{platform}/disconnect
Authorization: Bearer <access_token>
```

### Analytics

#### Dashboard Stats

Get overview statistics for dashboard.

```http
GET /analytics/dashboard
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPosts": 156,
    "scheduledPosts": 12,
    "publishedPosts": 140,
    "failedPosts": 4,
    "platforms": {
      "linkedin": {
        "totalPosts": 89,
        "successRate": 95.5
      },
      "twitter": {
        "totalPosts": 67,
        "successRate": 97.0
      }
    },
    "recentActivity": [
      {
        "id": "post-123",
        "content": "Recent post...",
        "status": "published",
        "platforms": ["linkedin"],
        "publishedAt": "2024-01-20T14:30:00Z"
      }
    ]
  }
}
```

#### Post Analytics

Get detailed analytics for posts.

```http
GET /analytics/posts?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `startDate` - Start date for analytics (ISO 8601)
- `endDate` - End date for analytics (ISO 8601)
- `groupBy` - Group results by (`day`, `week`, `month`)
- `platform` - Filter by platform

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalPosts": 45,
      "publishedPosts": 42,
      "failedPosts": 3,
      "successRate": 93.3
    },
    "timeline": [
      {
        "date": "2024-01-15",
        "totalPosts": 3,
        "publishedPosts": 3,
        "failedPosts": 0
      }
    ],
    "platforms": {
      "linkedin": {
        "posts": 25,
        "success": 24,
        "successRate": 96.0
      },
      "twitter": {
        "posts": 20,
        "success": 18,
        "successRate": 90.0
      }
    }
  }
}
```

### Queue Management

#### Queue Status

Get current queue status and statistics.

```http
GET /queue/status
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 8,
    "delayed": 12,
    "processingRate": {
      "successRate": 94.9,
      "failureRate": 5.1
    }
  }
}
```

#### Retry Failed Job

Retry a failed job.

```http
POST /queue/retry/{jobId}
Authorization: Bearer <access_token>
```

### Webhooks

#### List Webhooks

Get configured webhooks.

```http
GET /webhooks
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "webhook-id",
      "url": "https://example.com/webhook",
      "events": ["post.published", "post.failed"],
      "isActive": true,
      "secret": "webhook-secret",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### Create Webhook

Create a new webhook.

```http
POST /webhooks
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "url": "https://example.com/webhook",
  "events": ["post.published", "post.failed"],
  "secret": "my-webhook-secret"
}
```

#### Test Webhook

Test webhook endpoint.

```http
POST /webhooks/{webhookId}/test
Authorization: Bearer <access_token>
```

### Team Management

#### Team Members

Get team members.

```http
GET /team/members
Authorization: Bearer <access_token>
```

#### Invite Member

Invite user to team.

```http
POST /team/invite
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "newmember@example.com",
  "name": "New Member",
  "role": "member"
}
```

## Webhook Events

The API sends webhook notifications for various events. All webhooks are signed with HMAC-SHA256.

### Event Types

- `post.published` - Post successfully published to all platforms
- `post.failed` - Post failed to publish
- `post.partially_failed` - Post published to some platforms but failed on others
- `user.connected` - User connected a new platform
- `user.disconnected` - User disconnected a platform

### Webhook Payload

```json
{
  "event": "post.published",
  "timestamp": "2024-01-20T15:00:05Z",
  "data": {
    "postId": "post-id",
    "userId": "user-id",
    "teamId": "team-id",
    "content": "Post content...",
    "platforms": ["linkedin", "twitter"],
    "results": [
      {
        "platform": "linkedin",
        "success": true,
        "platformPostId": "linkedin-123",
        "url": "https://linkedin.com/post/123"
      }
    ]
  }
}
```

### Signature Verification

Verify webhook signatures using the secret:

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}
```

## SDKs and Libraries

### JavaScript/Node.js

```javascript
const SocialMediaPosterAPI = require('@socialmediaposter/api-client');

const client = new SocialMediaPosterAPI({
  baseURL: 'https://api.socialmediaposter.com/api/v1',
  accessToken: 'your-access-token'
});

// Create a post
const post = await client.posts.create({
  content: 'Hello world!',
  platforms: ['linkedin', 'twitter'],
  scheduledAt: '2024-01-20T15:00:00Z'
});
```

### cURL Examples

```bash
# Login
curl -X POST https://api.socialmediaposter.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Create post
curl -X POST https://api.socialmediaposter.com/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-token" \
  -d '{
    "content": "Hello from the API!",
    "platforms": ["linkedin"],
    "scheduledAt": "2024-01-20T15:00:00Z"
  }'
```

## Support

For API support and questions:
- Email: api-support@socialmediaposter.com
- Documentation: https://docs.socialmediaposter.com
- Status Page: https://status.socialmediaposter.com