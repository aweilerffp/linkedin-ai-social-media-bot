import { jest } from '@jest/globals';
import { SlackApprovalService } from '../../services/slack/SlackApprovalService.js';

// Mock Slack Web API
const mockSlackClient = {
  chat: {
    postMessage: jest.fn(),
    update: jest.fn(),
    postEphemeral: jest.fn()
  },
  views: {
    open: jest.fn()
  },
  auth: {
    test: jest.fn()
  }
};

// Mock Redis
const mockRedisClient = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn()
};

jest.unstable_mockModule('@slack/web-api', () => ({
  WebClient: jest.fn(() => mockSlackClient)
}));

jest.unstable_mockModule('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => mockRedisClient)
}));

describe('SlackApprovalService', () => {
  let slackService;
  let mockLinkedInPost;
  let mockImageData;
  let mockCompanyProfile;
  let mockUserInfo;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set required environment variables
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.APP_URL = 'http://localhost:3001';
    
    slackService = new SlackApprovalService();
    
    mockLinkedInPost = {
      hookId: 'test-hook-1',
      post: 'This is a test LinkedIn post that meets the character requirements and includes engaging content about our software solutions.',
      metadata: {
        characterCount: 1654,
        estimatedReadingLevel: 6.2,
        contentPillar: 'Software Solutions'
      }
    };

    mockImageData = {
      imageUrl: 'https://example.com/generated-image.png',
      altText: 'Professional software dashboard illustration',
      metadata: {
        generation_cost: 0.04
      }
    };

    mockCompanyProfile = {
      id: 'test-company-id',
      team_id: 'test-team-id',
      company_name: 'TestCorp',
      slack_channel: '#social-media',
      slack_approvers: ['U1234567890', 'U0987654321']
    };

    mockUserInfo = {
      id: 'test-user-id',
      name: 'Test User'
    };
  });

  describe('sendPostForApproval', () => {
    beforeEach(() => {
      mockSlackClient.chat.postMessage.mockResolvedValue({
        channel: 'C1234567890',
        ts: '1234567890.123456',
        ok: true
      });
      mockRedisClient.setex.mockResolvedValue('OK');
    });

    it('should send approval message to Slack successfully', async () => {
      const result = await slackService.sendPostForApproval(
        mockLinkedInPost,
        mockImageData,
        mockCompanyProfile,
        mockUserInfo
      );

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: '#social-media',
          text: '🎯 New LinkedIn Post Ready for Review',
          blocks: expect.any(Array)
        })
      );

      expect(result).toHaveProperty('approvalId');
      expect(result).toHaveProperty('slackChannel');
      expect(result).toHaveProperty('slackMessageTs');
      expect(result.status).toBe('pending');
    });

    it('should store approval data in Redis', async () => {
      await slackService.sendPostForApproval(
        mockLinkedInPost,
        mockImageData,
        mockCompanyProfile,
        mockUserInfo
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^approval:/),
        86400, // 24 hours in seconds
        expect.stringContaining('pending')
      );
    });

    it('should notify approvers when specified', async () => {
      await slackService.sendPostForApproval(
        mockLinkedInPost,
        mockImageData,
        mockCompanyProfile,
        mockUserInfo
      );

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledTimes(2); // Main message + approver notification
    });

    it('should throw error when Slack channel not configured', async () => {
      const profileWithoutChannel = { ...mockCompanyProfile, slack_channel: null };

      await expect(
        slackService.sendPostForApproval(
          mockLinkedInPost,
          mockImageData,
          profileWithoutChannel,
          mockUserInfo
        )
      ).rejects.toThrow('Slack channel not configured for company');
    });

    it('should handle Slack API errors', async () => {
      mockSlackClient.chat.postMessage.mockRejectedValue(new Error('Slack API Error'));

      await expect(
        slackService.sendPostForApproval(
          mockLinkedInPost,
          mockImageData,
          mockCompanyProfile,
          mockUserInfo
        )
      ).rejects.toThrow('Slack API Error');
    });
  });

  describe('buildApprovalMessage', () => {
    it('should build interactive approval message with all components', async () => {
      const approvalId = 'test-approval-id';
      const message = await slackService.buildApprovalMessage(
        mockLinkedInPost,
        mockImageData,
        mockCompanyProfile,
        approvalId
      );

      expect(message.blocks).toBeDefined();
      expect(message.blocks.length).toBeGreaterThan(3);
      
      // Check for header
      expect(message.blocks[0].type).toBe('header');
      expect(message.blocks[0].text.text).toContain('LinkedIn Post Ready for Review');
      
      // Check for action buttons
      const actionBlock = message.blocks.find(block => block.type === 'actions');
      expect(actionBlock).toBeDefined();
      expect(actionBlock.elements).toHaveLength(3); // Approve, Edit, Reject
    });

    it('should include image when provided', async () => {
      const message = await slackService.buildApprovalMessage(
        mockLinkedInPost,
        mockImageData,
        mockCompanyProfile,
        'test-id'
      );

      const imageBlock = message.blocks.find(block => block.type === 'image');
      expect(imageBlock).toBeDefined();
      expect(imageBlock.image_url).toBe(mockImageData.imageUrl);
    });

    it('should handle missing image gracefully', async () => {
      const message = await slackService.buildApprovalMessage(
        mockLinkedInPost,
        null,
        mockCompanyProfile,
        'test-id'
      );

      const imageBlock = message.blocks.find(block => block.type === 'image');
      expect(imageBlock).toBeUndefined();
    });

    it('should truncate long post content', async () => {
      const longPost = {
        ...mockLinkedInPost,
        post: 'a'.repeat(1000)
      };

      const message = await slackService.buildApprovalMessage(
        longPost,
        mockImageData,
        mockCompanyProfile,
        'test-id'
      );

      const contentSection = message.blocks.find(
        block => block.text?.text?.includes('Post Content')
      );
      expect(contentSection.text.text.length).toBeLessThan(600);
    });
  });

  describe('handleApproval', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        linkedInPost: mockLinkedInPost,
        companyProfile: mockCompanyProfile,
        status: 'pending'
      }));
      mockSlackClient.chat.update.mockResolvedValue({ ok: true });
      mockSlackClient.chat.postEphemeral.mockResolvedValue({ ok: true });
    });

    it('should handle approval successfully', async () => {
      const user = { id: 'U1234567890' };
      const channel = { id: 'C1234567890' };
      const message = { ts: '1234567890.123456' };

      const result = await slackService.handleApproval(
        'test-approval-id',
        user,
        channel,
        message
      );

      expect(result.status).toBe('approved');
      expect(mockSlackClient.chat.update).toHaveBeenCalled();
      expect(mockSlackClient.chat.postEphemeral).toHaveBeenCalled();
    });

    it('should update approval data with approver info', async () => {
      const user = { id: 'U1234567890' };
      const channel = { id: 'C1234567890' };
      const message = { ts: '1234567890.123456' };

      await slackService.handleApproval('test-approval-id', user, channel, message);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'approval:test-approval-id',
        86400,
        expect.stringContaining('approved')
      );
    });

    it('should handle missing approval data', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        slackService.handleApproval('nonexistent-id', {}, {}, {})
      ).rejects.toThrow('Approval data not found');
    });
  });

  describe('handleEditRequest', () => {
    it('should open edit request modal', async () => {
      mockSlackClient.views.open.mockResolvedValue({ ok: true });

      const result = await slackService.handleEditRequest(
        'test-approval-id',
        { id: 'U123' },
        { id: 'C123' },
        { trigger_id: 'trigger123' }
      );

      expect(mockSlackClient.views.open).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_id: 'trigger123',
          view: expect.objectContaining({
            type: 'modal',
            callback_id: 'edit_request_modal'
          })
        })
      );

      expect(result.status).toBe('edit_requested');
    });

    it('should handle modal opening errors', async () => {
      mockSlackClient.views.open.mockRejectedValue(new Error('Modal error'));

      await expect(
        slackService.handleEditRequest('test-id', {}, {}, {})
      ).rejects.toThrow('Modal error');
    });
  });

  describe('handleRejection', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        linkedInPost: mockLinkedInPost,
        companyProfile: mockCompanyProfile,
        status: 'pending'
      }));
      mockSlackClient.chat.update.mockResolvedValue({ ok: true });
    });

    it('should handle rejection successfully', async () => {
      const user = { id: 'U1234567890' };
      const channel = { id: 'C1234567890' };
      const message = { ts: '1234567890.123456' };

      const result = await slackService.handleRejection(
        'test-approval-id',
        user,
        channel,
        message
      );

      expect(result.status).toBe('rejected');
      expect(mockSlackClient.chat.update).toHaveBeenCalled();
    });

    it('should update approval data with rejection info', async () => {
      const user = { id: 'U1234567890' };

      await slackService.handleRejection(
        'test-approval-id',
        user,
        { id: 'C123' },
        { ts: '123' }
      );

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'approval:test-approval-id',
        86400,
        expect.stringContaining('rejected')
      );
    });
  });

  describe('buildEditRequestModal', () => {
    it('should build modal with feedback input', () => {
      const modal = slackService.buildEditRequestModal('test-approval-id');

      expect(modal.type).toBe('modal');
      expect(modal.callback_id).toBe('edit_request_modal');
      expect(modal.private_metadata).toBe('test-approval-id');
      expect(modal.blocks).toHaveLength(2); // Feedback input + checkboxes
    });

    it('should include edit categories checkboxes', () => {
      const modal = slackService.buildEditRequestModal('test-approval-id');
      
      const checkboxBlock = modal.blocks.find(
        block => block.element?.type === 'checkboxes'
      );
      expect(checkboxBlock).toBeDefined();
      expect(checkboxBlock.element.options.length).toBeGreaterThan(0);
    });
  });

  describe('storeApprovalData and getApprovalData', () => {
    it('should store and retrieve approval data correctly', async () => {
      const testData = { test: 'data' };
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      await slackService.storeApprovalData('test-id', testData);
      const retrieved = await slackService.getApprovalData('test-id');

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'approval:test-id',
        86400,
        JSON.stringify(testData)
      );
      expect(retrieved).toEqual(testData);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));

      await expect(
        slackService.storeApprovalData('test-id', { test: 'data' })
      ).rejects.toThrow('Redis error');
    });

    it('should return null for missing approval data', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await slackService.getApprovalData('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('notifyApprovers', () => {
    it('should send notification to all approvers', async () => {
      mockSlackClient.chat.postMessage.mockResolvedValue({ ok: true });

      await slackService.notifyApprovers(
        ['U123', 'U456'],
        '#social-media',
        '1234567890.123456',
        'TestCorp'
      );

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: '#social-media',
          thread_ts: '1234567890.123456',
          text: expect.stringContaining('<@U123>, <@U456>')
        })
      );
    });

    it('should handle notification errors gracefully', async () => {
      mockSlackClient.chat.postMessage.mockRejectedValue(new Error('Notification error'));

      // Should not throw error
      await expect(
        slackService.notifyApprovers(['U123'], '#test', '123', 'TestCorp')
      ).resolves.not.toThrow();
    });
  });

  describe('getApprovalStats', () => {
    beforeEach(() => {
      mockRedisClient.keys.mockResolvedValue(['approval:1', 'approval:2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({
          companyProfile: { id: 'test-company-id' },
          status: 'approved'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          companyProfile: { id: 'test-company-id' },
          status: 'rejected'
        }));
    });

    it('should calculate approval statistics correctly', async () => {
      const stats = await slackService.getApprovalStats('test-company-id');

      expect(stats.total).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });

    it('should handle Redis errors in stats calculation', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await slackService.getApprovalStats('test-company-id');
      expect(stats.error).toBeTruthy();
    });
  });

  describe('testConnection', () => {
    it('should return connection info when successful', async () => {
      mockSlackClient.auth.test.mockResolvedValue({
        ok: true,
        user_id: 'B123456789',
        team_id: 'T123456789',
        team: 'Test Team'
      });

      const result = await slackService.testConnection();

      expect(result.connected).toBe(true);
      expect(result.botId).toBe('B123456789');
      expect(result.teamId).toBe('T123456789');
    });

    it('should return error info when connection fails', async () => {
      mockSlackClient.auth.test.mockRejectedValue(new Error('Invalid token'));

      const result = await slackService.testConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('addToPostingQueue', () => {
    it('should log queue addition intent', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const approvalData = {
        approvalId: 'test-id',
        companyProfile: { id: 'company-123' },
        linkedInPost: { post: 'Test post content' }
      };

      const result = await slackService.addToPostingQueue(approvalData);

      expect(result.queued).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle missing environment variables', () => {
      delete process.env.SLACK_BOT_TOKEN;

      expect(() => new SlackApprovalService()).toThrow(
        'SLACK_BOT_TOKEN environment variable is required'
      );
    });

    it('should handle interaction payload errors gracefully', async () => {
      const invalidPayload = { actions: [] }; // Missing required fields

      await expect(
        slackService.handleInteraction(invalidPayload)
      ).rejects.toThrow();
    });
  });
});