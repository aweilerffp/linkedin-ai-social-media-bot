import { jest } from '@jest/globals';
import request from 'supertest';
import { TestUtils } from '../helpers/testUtils.js';

// Mock dependencies
jest.mock('../../config/database.js', () => ({
  query: jest.fn(),
}));

jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => TestUtils.createMockRedisClient()),
}));

jest.mock('../../utils/logger.js', () => ({
  logger: TestUtils.createMockLogger(),
}));

// Create app after mocks are set up
async function createTestApp() {
  const { default: app } = await import('../../server.js');
  return app;
}

describe('API Integration Tests', () => {
  let app;
  let authToken;
  let testUser;
  let testTeam;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    testUser = TestUtils.createMockUser();
    testTeam = TestUtils.createMockTeam();
    authToken = TestUtils.generateTestJWT(testUser);
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const registerData = {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          teamName: 'Test Team',
        };

        const { query } = await import('../../config/database.js');
        
        query
          .mockResolvedValueOnce(TestUtils.createMockQueryResult([testTeam])) // Create team
          .mockResolvedValueOnce(TestUtils.createMockQueryResult([testUser])); // Create user

        const response = await request(app)
          .post('/api/auth/register')
          .send(registerData)
          .expect(201);

        expect(response.body).toEqual({
          success: true,
          data: {
            user: expect.objectContaining({
              id: testUser.id,
              email: testUser.email,
              name: testUser.name,
            }),
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          },
        });
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            // Missing password, name, teamName
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      });

      it('should handle duplicate email', async () => {
        const { query } = await import('../../config/database.js');
        query.mockRejectedValue({ code: '23505' }); // Unique constraint violation

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'existing@example.com',
            password: 'password123',
            name: 'Test User',
            teamName: 'Test Team',
          })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('already exists');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login user successfully', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'password123',
        };

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([testUser]));

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            user: expect.objectContaining({
              id: testUser.id,
              email: testUser.email,
            }),
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          },
        });
      });

      it('should reject invalid credentials', async () => {
        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([]));

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'wrong@example.com',
            password: 'wrongpassword',
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid credentials');
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh tokens successfully', async () => {
        const refreshToken = TestUtils.generateTestJWT(testUser, 'refresh');

        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          },
        });
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/auth/profile', () => {
      it('should get user profile when authenticated', async () => {
        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([testUser]));

        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
          }),
        });
      });

      it('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Posts Endpoints', () => {
    describe('POST /api/posts', () => {
      it('should create a scheduled post successfully', async () => {
        const postData = {
          content: 'Test post content',
          platforms: ['linkedin', 'twitter'],
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        };

        const mockPost = TestUtils.createMockPost({
          ...postData,
          userId: testUser.id,
          teamId: testUser.teamId,
        });

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));

        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(postData)
          .expect(201);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: mockPost.id,
            content: postData.content,
            platforms: postData.platforms,
            status: 'scheduled',
          }),
        });
      });

      it('should validate post content', async () => {
        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // Missing content
            platforms: ['linkedin'],
            scheduledAt: new Date(Date.now() + 3600000).toISOString(),
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Content is required');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/posts')
          .send({
            content: 'Test post',
            platforms: ['linkedin'],
            scheduledAt: new Date(Date.now() + 3600000).toISOString(),
          })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/posts', () => {
      it('should get user posts', async () => {
        const mockPosts = [
          TestUtils.createMockPost({ userId: testUser.id }),
          TestUtils.createMockPost({ userId: testUser.id }),
        ];

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult(mockPosts));

        const response = await request(app)
          .get('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            posts: expect.arrayContaining([
              expect.objectContaining({ id: mockPosts[0].id }),
              expect.objectContaining({ id: mockPosts[1].id }),
            ]),
            total: 2,
            page: 1,
            limit: 20,
          },
        });
      });

      it('should filter posts by status', async () => {
        const mockScheduledPosts = [
          TestUtils.createMockPost({ userId: testUser.id, status: 'scheduled' }),
        ];

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult(mockScheduledPosts));

        const response = await request(app)
          .get('/api/posts?status=scheduled')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.posts).toHaveLength(1);
        expect(response.body.data.posts[0].status).toBe('scheduled');
      });
    });

    describe('GET /api/posts/:id', () => {
      it('should get specific post', async () => {
        const mockPost = TestUtils.createMockPost({ userId: testUser.id });

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));

        const response = await request(app)
          .get(`/api/posts/${mockPost.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: mockPost.id,
            content: mockPost.content,
          }),
        });
      });

      it('should return 404 for non-existent post', async () => {
        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([]));

        const response = await request(app)
          .get('/api/posts/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Post not found');
      });
    });

    describe('PUT /api/posts/:id', () => {
      it('should update scheduled post', async () => {
        const postId = 'test-post-id';
        const updateData = {
          content: 'Updated post content',
          scheduledAt: new Date(Date.now() + 7200000).toISOString(),
        };

        const mockPost = TestUtils.createMockPost({
          id: postId,
          userId: testUser.id,
          status: 'scheduled',
        });

        const updatedPost = { ...mockPost, ...updateData };

        const { query } = await import('../../config/database.js');
        query
          .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
          .mockResolvedValueOnce(TestUtils.createMockQueryResult([updatedPost])); // Update post

        const response = await request(app)
          .put(`/api/posts/${postId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.content).toBe(updateData.content);
      });

      it('should not allow updating published posts', async () => {
        const postId = 'test-post-id';
        const mockPost = TestUtils.createMockPost({
          id: postId,
          userId: testUser.id,
          status: 'published',
        });

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([mockPost]));

        const response = await request(app)
          .put(`/api/posts/${postId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ content: 'New content' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('cannot be updated');
      });
    });

    describe('DELETE /api/posts/:id', () => {
      it('should cancel scheduled post', async () => {
        const postId = 'test-post-id';
        const mockPost = TestUtils.createMockPost({
          id: postId,
          userId: testUser.id,
          status: 'scheduled',
        });

        const { query } = await import('../../config/database.js');
        query
          .mockResolvedValueOnce(TestUtils.createMockQueryResult([mockPost])) // Get post
          .mockResolvedValueOnce(TestUtils.createMockQueryResult([{ ...mockPost, status: 'cancelled' }])); // Update post

        const response = await request(app)
          .delete(`/api/posts/${postId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('cancelled');
      });
    });
  });

  describe('Platform Connections', () => {
    describe('GET /api/platforms/linkedin/auth', () => {
      it('should redirect to LinkedIn OAuth', async () => {
        const response = await request(app)
          .get('/api/platforms/linkedin/auth')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(302);

        expect(response.headers.location).toContain('linkedin.com/oauth');
      });
    });

    describe('GET /api/platforms/connections', () => {
      it('should get platform connections status', async () => {
        const mockUserWithConnections = {
          ...testUser,
          linkedinTokens: { access_token: 'linkedin-token' },
          twitterTokens: null,
        };

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([mockUserWithConnections]));

        const response = await request(app)
          .get('/api/platforms/connections')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            linkedin: {
              connected: true,
              connectedAt: expect.any(String),
            },
            twitter: {
              connected: false,
              connectedAt: null,
            },
          },
        });
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/analytics/dashboard', () => {
      it('should get dashboard analytics', async () => {
        const mockStats = {
          totalPosts: 50,
          scheduledPosts: 10,
          publishedPosts: 35,
          failedPosts: 5,
        };

        const { query } = await import('../../config/database.js');
        query.mockResolvedValue(TestUtils.createMockQueryResult([mockStats]));

        const response = await request(app)
          .get('/api/analytics/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            totalPosts: expect.any(Number),
            scheduledPosts: expect.any(Number),
            publishedPosts: expect.any(Number),
            failedPosts: expect.any(Number),
          }),
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const { query } = await import('../../config/database.js');
      query.mockRejectedValue(new Error('Database connection error'));

      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limits to endpoints', async () => {
      // Make multiple rapid requests
      const requests = Array(6).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123',
          })
      );

      const responses = await Promise.all(requests);
      
      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});