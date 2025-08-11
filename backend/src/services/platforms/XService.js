import axios from 'axios';
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import { BasePlatform } from './BasePlatform.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export class XService extends BasePlatform {
  constructor(credentials) {
    super(credentials);
    this.baseURL = 'https://api.twitter.com/2';
    this.uploadURL = 'https://upload.twitter.com/1.1';
    this.maxContentLength = 280;
    this.maxThreadLength = 25; // Max tweets in a thread
    
    // OAuth 1.0a configuration for Twitter API v2
    this.oauth = OAuth({
      consumer: {
        key: process.env.TWITTER_CLIENT_ID,
        secret: process.env.TWITTER_CLIENT_SECRET,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha1', key)
          .update(base_string)
          .digest('base64');
      },
    });

    this.token = {
      key: this.credentials.access_token,
      secret: this.credentials.token_secret,
    };
  }

  async authenticate() {
    try {
      const profile = await this.getProfile();
      
      logger.info('X (Twitter) authentication successful', {
        userId: profile.data.id,
        username: profile.data.username,
        name: profile.data.name,
      });
      
      return true;
    } catch (error) {
      return this.handleApiError(error, 'authentication');
    }
  }

  async refreshToken() {
    // OAuth 1.0a doesn't use refresh tokens
    // Tokens don't expire unless revoked by user
    logger.info('X (Twitter) tokens do not require refresh');
    return this.credentials;
  }

  async validateCredentials() {
    try {
      await this.getProfile();
      return true;
    } catch (error) {
      logger.warn('X (Twitter) credentials validation failed:', error.message);
      return false;
    }
  }

  async getProfile() {
    try {
      const requestData = {
        url: `${this.baseURL}/users/me?user.fields=id,name,username,profile_image_url,public_metrics`,
        method: 'GET',
      };

      const response = await axios.get(requestData.url, {
        headers: this.oauth.toHeader(this.oauth.authorize(requestData, this.token)),
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'get profile');
    }
  }

  async post(content, options = {}) {
    this.validatePostContent(content, options.mediaUrls);
    
    try {
      // Handle long content by creating threads
      const tweets = this.splitIntoTweets(content);
      const results = [];
      
      // Upload media first if provided
      let mediaIds = [];
      if (options.mediaUrls?.length > 0) {
        mediaIds = await Promise.all(
          options.mediaUrls.map(url => this.uploadMediaFromUrl(url))
        );
      }

      // Post first tweet with media
      let previousTweetId = null;
      for (let i = 0; i < tweets.length; i++) {
        const tweetData = {
          text: tweets[i],
        };

        // Add media to first tweet only
        if (i === 0 && mediaIds.length > 0) {
          tweetData.media = {
            media_ids: mediaIds,
          };
        }

        // Add reply reference for thread
        if (previousTweetId) {
          tweetData.reply = {
            in_reply_to_tweet_id: previousTweetId,
          };
        }

        const result = await this.postSingleTweet(tweetData);
        results.push(result);
        
        previousTweetId = result.platformPostId;
        
        // Small delay between tweets to avoid rate limits
        if (i < tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      await this.logPostAttempt(results[0].platformPostId, true);
      
      return {
        platform: 'twitter',
        platformPostId: results[0].platformPostId,
        url: results[0].url,
        postedAt: new Date().toISOString(),
        threadInfo: results.length > 1 ? {
          isThread: true,
          tweetCount: results.length,
          allTweets: results,
        } : undefined,
      };
    } catch (error) {
      await this.logPostAttempt(null, false, error);
      return this.handleApiError(error, 'create post');
    }
  }

  async postSingleTweet(tweetData) {
    const requestData = {
      url: `${this.baseURL}/tweets`,
      method: 'POST',
    };

    const response = await this.retryWithBackoff(async () => {
      return await axios.post(requestData.url, tweetData, {
        headers: {
          ...this.oauth.toHeader(this.oauth.authorize(requestData, this.token)),
          'Content-Type': 'application/json',
        },
      });
    });

    const tweetId = response.data.data.id;
    const username = await this.getUsername();
    
    return {
      platform: 'twitter',
      platformPostId: tweetId,
      url: `https://twitter.com/${username}/status/${tweetId}`,
      postedAt: new Date().toISOString(),
    };
  }

  splitIntoTweets(content) {
    if (content.length <= this.maxContentLength) {
      return [content];
    }

    const tweets = [];
    const words = content.split(' ');
    let currentTweet = '';

    for (const word of words) {
      const testTweet = currentTweet ? `${currentTweet} ${word}` : word;
      
      if (testTweet.length <= this.maxContentLength) {
        currentTweet = testTweet;
      } else {
        if (currentTweet) {
          tweets.push(currentTweet);
          currentTweet = word;
        } else {
          // Single word longer than limit, truncate it
          tweets.push(word.substring(0, this.maxContentLength));
        }
      }
    }

    if (currentTweet) {
      tweets.push(currentTweet);
    }

    // Limit to max thread length
    if (tweets.length > this.maxThreadLength) {
      return tweets.slice(0, this.maxThreadLength);
    }

    return tweets;
  }

  async uploadMediaFromUrl(mediaUrl) {
    try {
      // Download the media
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      const mediaBuffer = Buffer.from(mediaResponse.data);
      const mimeType = mediaResponse.headers['content-type'];
      
      return await this.uploadMedia(mediaBuffer, mimeType);
    } catch (error) {
      return this.handleApiError(error, 'media download');
    }
  }

  async uploadMedia(mediaBuffer, mimeType) {
    this.validateMediaType(mimeType);
    
    if (mediaBuffer.length > this.getMaxImageSize()) {
      throw new ApiError(400, 'Media file too large');
    }

    try {
      // Step 1: Initialize upload
      const initData = {
        command: 'INIT',
        media_type: mimeType,
        total_bytes: mediaBuffer.length,
      };

      const initRequest = {
        url: `${this.uploadURL}/media/upload.json`,
        method: 'POST',
      };

      const initResponse = await axios.post(initRequest.url, initData, {
        headers: {
          ...this.oauth.toHeader(this.oauth.authorize(initRequest, this.token)),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const mediaId = initResponse.data.media_id_string;

      // Step 2: Upload media chunks
      const chunkSize = 1024 * 1024; // 1MB chunks
      let segmentIndex = 0;

      for (let i = 0; i < mediaBuffer.length; i += chunkSize) {
        const chunk = mediaBuffer.slice(i, i + chunkSize);
        
        const appendData = new FormData();
        appendData.append('command', 'APPEND');
        appendData.append('media_id', mediaId);
        appendData.append('segment_index', segmentIndex);
        appendData.append('media', chunk);

        const appendRequest = {
          url: `${this.uploadURL}/media/upload.json`,
          method: 'POST',
        };

        await axios.post(appendRequest.url, appendData, {
          headers: {
            ...this.oauth.toHeader(this.oauth.authorize(appendRequest, this.token)),
            ...appendData.getHeaders(),
          },
        });

        segmentIndex++;
      }

      // Step 3: Finalize upload
      const finalizeData = {
        command: 'FINALIZE',
        media_id: mediaId,
      };

      const finalizeRequest = {
        url: `${this.uploadURL}/media/upload.json`,
        method: 'POST',
      };

      await axios.post(finalizeRequest.url, finalizeData, {
        headers: {
          ...this.oauth.toHeader(this.oauth.authorize(finalizeRequest, this.token)),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return mediaId;
    } catch (error) {
      return this.handleApiError(error, 'media upload');
    }
  }

  async deletePost(postId) {
    try {
      const requestData = {
        url: `${this.baseURL}/tweets/${postId}`,
        method: 'DELETE',
      };

      await axios.delete(requestData.url, {
        headers: this.oauth.toHeader(this.oauth.authorize(requestData, this.token)),
      });
      
      logger.info('X (Twitter) post deleted successfully', { postId });
      return true;
    } catch (error) {
      return this.handleApiError(error, 'delete post');
    }
  }

  async getUsername() {
    try {
      if (this._cachedUsername) {
        return this._cachedUsername;
      }

      const profile = await this.getProfile();
      this._cachedUsername = profile.data.username;
      return this._cachedUsername;
    } catch (error) {
      return 'unknown';
    }
  }

  getRateLimitInfo() {
    return {
      requests: 300,
      window: '15min',
      burst: 25,
      postsPerDay: 2400,
      postsPerHour: 100,
    };
  }

  getSupportedImageTypes() {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  }

  getSupportedVideoTypes() {
    return ['video/mp4', 'video/quicktime'];
  }

  getMaxImageSize() {
    return 5 * 1024 * 1024; // 5MB for images
  }

  getMaxVideoSize() {
    return 512 * 1024 * 1024; // 512MB for videos
  }

  async getPostAnalytics(postId) {
    try {
      const requestData = {
        url: `${this.baseURL}/tweets/${postId}?tweet.fields=public_metrics`,
        method: 'GET',
      };

      const response = await axios.get(requestData.url, {
        headers: this.oauth.toHeader(this.oauth.authorize(requestData, this.token)),
      });
      
      const metrics = response.data.data.public_metrics;
      
      return {
        platform: 'twitter',
        postId,
        impressions: metrics.impression_count || 0,
        engagements: (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0),
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        replies: metrics.reply_count || 0,
        quotes: metrics.quote_count || 0,
      };
    } catch (error) {
      return this.handleApiError(error, 'get analytics');
    }
  }

  async searchTweets(query, options = {}) {
    try {
      const params = new URLSearchParams({
        query,
        max_results: options.maxResults || 10,
        'tweet.fields': 'created_at,author_id,public_metrics,context_annotations',
        'user.fields': 'name,username,profile_image_url',
        expansions: 'author_id',
      });

      const requestData = {
        url: `${this.baseURL}/tweets/search/recent?${params.toString()}`,
        method: 'GET',
      };

      const response = await axios.get(requestData.url, {
        headers: this.oauth.toHeader(this.oauth.authorize(requestData, this.token)),
      });

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'search tweets');
    }
  }

  async getTrends(woeid = 1) { // 1 = worldwide
    try {
      const requestData = {
        url: `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`,
        method: 'GET',
      };

      const response = await axios.get(requestData.url, {
        headers: this.oauth.toHeader(this.oauth.authorize(requestData, this.token)),
      });

      return response.data[0].trends.map(trend => ({
        name: trend.name,
        url: trend.url,
        tweetVolume: trend.tweet_volume,
      }));
    } catch (error) {
      return this.handleApiError(error, 'get trends');
    }
  }
}