# 📚 Social Media Poster User Guide

Welcome to the Social Media Poster! This comprehensive guide will help you get started with managing your social media content across LinkedIn and X/Twitter from a single, powerful dashboard.

## 🚀 Getting Started

### First-Time Setup

1. **Create Your Account**
   - Visit the login page and click "Register"
   - Provide your email, password, name, and team name
   - Verify your email address (check your inbox)
   - You'll be automatically logged in after registration

2. **Complete Your Profile**
   - Add your profile picture
   - Set your timezone for accurate scheduling
   - Configure notification preferences

3. **Connect Social Media Platforms**
   - Navigate to Settings → Platform Connections
   - Click "Connect LinkedIn" and authorize your account
   - Click "Connect X/Twitter" and authorize your account
   - Your platforms will appear as "Connected" with profile information

## 🎯 Core Features

### Dashboard Overview

The dashboard provides a real-time overview of your social media activity:

- **Post Statistics**: Total, scheduled, published, and failed posts
- **Platform Performance**: Success rates for each connected platform
- **Queue Health**: Current queue status and processing rates
- **Recent Activity**: Latest post updates and status changes

### Creating and Scheduling Posts

#### Basic Post Creation

1. **Navigate to Posts → Create New Post**
2. **Write Your Content**
   - Enter your post text (respects platform character limits)
   - Add hashtags and mentions as needed
   - Preview how your post will appear on each platform

3. **Select Platforms**
   - Choose LinkedIn, X/Twitter, or both
   - Platform-specific previews show formatting differences

4. **Schedule Your Post**
   - Choose "Post Now" for immediate publishing
   - Select "Schedule" to pick a specific date and time
   - Use the timezone selector to ensure accurate timing

5. **Add Media (Optional)**
   - Upload images (JPG, PNG, GIF supported)
   - Images are automatically optimized for each platform
   - Preview image placement and sizing

6. **Review and Submit**
   - Review post content and scheduling details
   - Click "Create Post" to add to the publishing queue

#### Advanced Scheduling

- **Bulk Scheduling**: Create multiple posts with staggered timing
- **Optimal Timing**: Get suggestions for best posting times
- **Recurring Posts**: Set up regular content (coming soon)
- **Team Approval**: Require manager approval for posts (team feature)

### Managing Your Posts

#### Post Status Overview

Navigate to **Posts → All Posts** to see your complete post history:

- **Scheduled** 📅 - Waiting to be published
- **Published** ✅ - Successfully posted to all platforms
- **Partially Failed** ⚠️ - Posted to some platforms, failed on others
- **Failed** ❌ - Failed to post to any platform
- **Cancelled** 🚫 - Cancelled before publishing

#### Post Actions

For each post, you can:

- **View Details**: See full content, platform results, and engagement
- **Edit** (Scheduled posts only): Modify content or timing
- **Reschedule**: Change the publishing time
- **Cancel**: Remove from publishing queue
- **Retry**: Attempt to republish failed posts
- **Analytics**: View performance metrics (published posts)

#### Filtering and Search

Use the filter options to find specific posts:

- **Status Filter**: Show only scheduled, published, or failed posts
- **Platform Filter**: View posts for specific platforms
- **Date Range**: Filter by creation or publishing date
- **Search**: Find posts by content keywords or hashtags

### Team Collaboration

#### Team Management

**Team Owners and Managers** can:

1. **Invite Team Members**
   - Go to Settings → Team Management
   - Click "Invite Member"
   - Enter email, name, and role (Member, Manager, Owner)
   - Send invitation email

2. **Manage Permissions**
   - **Members**: Create and edit own posts, view team posts
   - **Managers**: All member permissions + approve posts, invite members
   - **Owners**: All permissions + billing, platform connections, team settings

3. **Team Settings**
   - Configure approval workflows
   - Set posting guidelines and templates
   - Manage team branding and voice

#### Collaboration Features

- **Shared Content Calendar**: View all team posts in calendar format
- **Post Approval Workflow**: Require manager approval for sensitive content
- **Team Analytics**: Combined performance metrics for the entire team
- **Comment System**: Internal comments on posts for collaboration

### Analytics and Reporting

#### Dashboard Analytics

**Overview Metrics**:
- Total posts published this month
- Success rate across all platforms
- Average engagement rates
- Top performing content types

**Platform Breakdown**:
- Individual platform performance
- Platform-specific engagement metrics
- Posting frequency and success rates

#### Detailed Post Analytics

For published posts, view:

- **Engagement Metrics**: Likes, comments, shares, clicks
- **Reach Statistics**: Impressions, unique viewers
- **Performance Comparison**: Cross-platform performance
- **Historical Trends**: Performance over time

#### Reporting

Generate custom reports:

- **Date Range Reports**: Performance over specific periods
- **Platform Reports**: Deep dive into individual platform metrics
- **Team Reports**: Aggregated team performance
- **Export Options**: PDF, CSV, or Excel formats

### Webhook Integration

#### Setting Up Webhooks

For developers and advanced users:

1. **Navigate to Settings → Webhooks**
2. **Add Webhook URL**
   - Enter your webhook endpoint URL
   - Select events to subscribe to
   - Configure authentication if required

3. **Test Webhooks**
   - Use the "Test Webhook" button to verify connectivity
   - Check webhook logs for debugging

#### Available Events

- `post.published` - Post successfully published to all platforms
- `post.failed` - Post failed to publish
- `post.partially_failed` - Post published to some platforms, failed on others
- `user.connected` - User connected a new platform
- `user.disconnected` - User disconnected a platform

### Platform-Specific Features

#### LinkedIn

**Content Optimization**:
- Up to 3,000 characters for posts
- Professional tone suggestions
- LinkedIn-specific hashtag recommendations
- Image optimization for LinkedIn's format

**Advanced Features**:
- LinkedIn company page posting (coming soon)
- LinkedIn article publishing (coming soon)
- LinkedIn event promotion (coming soon)

#### X/Twitter

**Content Optimization**:
- 280 character limit with counter
- Thread creation for longer content (coming soon)
- Twitter-specific hashtag and mention handling
- Optimal image cropping for Twitter format

**Advanced Features**:
- Twitter Spaces integration (coming soon)
- Poll creation (coming soon)
- Reply management (coming soon)

## 🔧 Settings and Configuration

### Account Settings

#### Profile Settings
- Update personal information
- Change password
- Configure two-factor authentication
- Set timezone and language preferences

#### Notification Settings
- Email notifications for post status updates
- Browser notifications for real-time updates
- Webhook notifications for developers
- Daily/weekly summary emails

### Platform Settings

#### Connection Management
- View connected platforms and account details
- Refresh expired tokens automatically
- Disconnect and reconnect platforms
- Troubleshoot connection issues

#### Platform-Specific Settings
- Default hashtags for each platform
- Platform-specific content templates
- Posting frequency limits
- Content approval workflows

### Team Settings (Managers/Owners Only)

#### Team Configuration
- Update team name and description
- Set team posting guidelines
- Configure approval workflows
- Manage team branding

#### Billing and Subscription
- View current plan and usage
- Upgrade or downgrade subscription
- Download invoices and receipts
- Manage payment methods

## 🛠️ Troubleshooting

### Common Issues

#### Posts Not Publishing

**Possible Causes**:
- Platform connection expired or revoked
- Content violates platform policies
- Service temporarily unavailable

**Solutions**:
1. Check platform connection status
2. Reconnect platforms if needed
3. Review content for policy violations
4. Try republishing the post
5. Contact support if issue persists

#### Platform Connection Issues

**LinkedIn Connection Problems**:
- Clear browser cache and cookies
- Use an incognito/private browser window
- Ensure you're logged into the correct LinkedIn account
- Check LinkedIn's app permissions

**X/Twitter Connection Problems**:
- Verify your Twitter account is active
- Check if Twitter API access is working
- Ensure two-factor authentication is properly configured
- Try reconnecting from a different browser

#### Image Upload Issues

**Common Solutions**:
- Ensure images are under 10MB
- Use supported formats (JPG, PNG, GIF)
- Check your internet connection
- Try refreshing the page and uploading again

### Getting Help

#### Self-Help Resources
- **Knowledge Base**: Searchable help articles
- **Video Tutorials**: Step-by-step video guides
- **Community Forum**: Connect with other users
- **API Documentation**: For developers

#### Contact Support
- **In-App Chat**: Real-time support during business hours
- **Email Support**: support@socialmediaposter.com
- **Priority Support**: Available for Pro and Enterprise plans
- **Phone Support**: Enterprise customers only

#### Status Updates
- **System Status**: status.socialmediaposter.com
- **Maintenance Notifications**: Advance notice of scheduled maintenance
- **Platform Issues**: Real-time updates on platform API issues

## 📈 Best Practices

### Content Strategy

#### Writing Effective Posts
- **Keep it concise**: Respect platform character limits
- **Use relevant hashtags**: Research trending and industry-specific tags
- **Include call-to-actions**: Encourage engagement and interaction
- **Add visuals**: Posts with images get higher engagement
- **Maintain brand voice**: Consistent tone across all platforms

#### Timing and Frequency
- **Optimal posting times**: Use analytics to find when your audience is most active
- **Consistent schedule**: Regular posting maintains audience engagement
- **Platform differences**: Different platforms have different peak times
- **Quality over quantity**: Better to post less frequently with high-quality content

### Team Coordination

#### Workflow Management
- **Content calendar**: Plan posts in advance using the calendar view
- **Review process**: Implement approval workflows for quality control
- **Content templates**: Create templates for consistent formatting
- **Role assignments**: Clearly define who creates, reviews, and approves content

#### Communication
- **Post comments**: Use internal comments for feedback and collaboration
- **Team meetings**: Regular sync meetings to discuss content strategy
- **Performance reviews**: Analyze team metrics together
- **Guidelines**: Establish clear posting guidelines and brand voice

### Security and Privacy

#### Account Security
- **Strong passwords**: Use unique, complex passwords
- **Two-factor authentication**: Enable 2FA for additional security
- **Regular audits**: Review team member access and permissions
- **Platform permissions**: Regularly check and update platform app permissions

#### Content Safety
- **Review before posting**: Always review content before scheduling
- **Backup important posts**: Save copies of important content
- **Monitor analytics**: Watch for unusual activity or engagement patterns
- **Compliance**: Ensure content meets all platform and industry guidelines

---

**Need more help?** Visit our [Knowledge Base](https://docs.socialmediaposter.com) or contact our support team at support@socialmediaposter.com