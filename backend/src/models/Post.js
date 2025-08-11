import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export class Post {
  constructor(data) {
    this.id = data.id;
    this.teamId = data.team_id;
    this.userId = data.user_id;
    this.content = data.content;
    this.mediaUrls = data.media_urls || [];
    this.platforms = data.platforms || [];
    this.status = data.status;
    this.scheduledAt = data.scheduled_at;
    this.postedAt = data.posted_at;
    this.errorLog = data.error_log;
    this.retryCount = data.retry_count || 0;
    this.metadata = data.metadata || {};
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create({
    teamId,
    userId,
    content,
    mediaUrls = [],
    platforms = [],
    scheduledAt = null,
    metadata = {}
  }) {
    const result = await query(
      `INSERT INTO posts (team_id, user_id, content, media_urls, platforms, scheduled_at, metadata, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        teamId,
        userId,
        content,
        mediaUrls,
        platforms,
        scheduledAt,
        JSON.stringify(metadata),
        scheduledAt ? 'scheduled' : 'draft'
      ]
    );
    return new Post(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM posts WHERE id = $1', [id]);
    return result.rows[0] ? new Post(result.rows[0]) : null;
  }

  static async findByTeamId(teamId, { limit = 50, offset = 0, status = null } = {}) {
    let queryText = 'SELECT * FROM posts WHERE team_id = $1';
    const values = [teamId];

    if (status) {
      queryText += ' AND status = $2';
      values.push(status);
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows.map(row => new Post(row));
  }

  static async findScheduled(beforeTime = new Date()) {
    const result = await query(
      'SELECT * FROM posts WHERE status = $1 AND scheduled_at <= $2 ORDER BY scheduled_at ASC',
      ['scheduled', beforeTime]
    );
    return result.rows.map(row => new Post(row));
  }

  static async findByStatus(status) {
    const result = await query(
      'SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows.map(row => new Post(row));
  }

  async update({
    content,
    mediaUrls,
    platforms,
    status,
    scheduledAt,
    postedAt,
    errorLog,
    retryCount,
    metadata
  }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (content !== undefined) {
      fields.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (mediaUrls !== undefined) {
      fields.push(`media_urls = $${paramCount++}`);
      values.push(mediaUrls);
    }
    if (platforms !== undefined) {
      fields.push(`platforms = $${paramCount++}`);
      values.push(platforms);
    }
    if (status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (scheduledAt !== undefined) {
      fields.push(`scheduled_at = $${paramCount++}`);
      values.push(scheduledAt);
    }
    if (postedAt !== undefined) {
      fields.push(`posted_at = $${paramCount++}`);
      values.push(postedAt);
    }
    if (errorLog !== undefined) {
      fields.push(`error_log = $${paramCount++}`);
      values.push(JSON.stringify(errorLog));
    }
    if (retryCount !== undefined) {
      fields.push(`retry_count = $${paramCount++}`);
      values.push(retryCount);
    }
    if (metadata !== undefined) {
      fields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(metadata));
    }

    if (fields.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    values.push(this.id);
    const result = await query(
      `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Post not found');
    }

    const updatedPost = new Post(result.rows[0]);
    Object.assign(this, updatedPost);
    return this;
  }

  async delete() {
    const result = await query('DELETE FROM posts WHERE id = $1 RETURNING *', [this.id]);
    if (result.rows.length === 0) {
      throw new ApiError(404, 'Post not found');
    }
  }

  async markAsPosted(platform, platformPostId = null) {
    const metadata = { ...this.metadata };
    if (!metadata.platformPosts) {
      metadata.platformPosts = {};
    }
    metadata.platformPosts[platform] = {
      id: platformPostId,
      postedAt: new Date().toISOString()
    };

    // Check if all platforms have been posted to
    const allPosted = this.platforms.every(p => metadata.platformPosts[p]);
    const newStatus = allPosted ? 'posted' : 'posting';

    return this.update({
      status: newStatus,
      postedAt: allPosted ? new Date() : this.postedAt,
      metadata,
      errorLog: null // Clear any previous errors
    });
  }

  async markAsFailed(platform, error) {
    const errorLog = this.errorLog || {};
    errorLog[platform] = {
      error: error.message,
      timestamp: new Date().toISOString(),
      retryCount: this.retryCount
    };

    return this.update({
      status: 'failed',
      errorLog,
      retryCount: this.retryCount + 1
    });
  }

  canRetry() {
    return this.status === 'failed' && this.retryCount < 3;
  }

  isScheduled() {
    return this.status === 'scheduled' && this.scheduledAt && new Date(this.scheduledAt) > new Date();
  }

  isReadyToPost() {
    return this.status === 'scheduled' && this.scheduledAt && new Date(this.scheduledAt) <= new Date();
  }

  toJSON() {
    return {
      id: this.id,
      teamId: this.teamId,
      userId: this.userId,
      content: this.content,
      mediaUrls: this.mediaUrls,
      platforms: this.platforms,
      status: this.status,
      scheduledAt: this.scheduledAt,
      postedAt: this.postedAt,
      errorLog: this.errorLog,
      retryCount: this.retryCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}