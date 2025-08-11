import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export class Team {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.plan = data.plan;
    this.quotaLimit = data.quota_limit;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create({ name, plan = 'free', quotaLimit = 100 }) {
    const result = await query(
      'INSERT INTO teams (name, plan, quota_limit) VALUES ($1, $2, $3) RETURNING *',
      [name, plan, quotaLimit]
    );
    return new Team(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM teams WHERE id = $1', [id]);
    return result.rows[0] ? new Team(result.rows[0]) : null;
  }

  static async findAll() {
    const result = await query('SELECT * FROM teams ORDER BY created_at DESC');
    return result.rows.map(row => new Team(row));
  }

  async update({ name, plan, quotaLimit }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (plan !== undefined) {
      fields.push(`plan = $${paramCount++}`);
      values.push(plan);
    }
    if (quotaLimit !== undefined) {
      fields.push(`quota_limit = $${paramCount++}`);
      values.push(quotaLimit);
    }

    if (fields.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    values.push(this.id);
    const result = await query(
      `UPDATE teams SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Team not found');
    }

    const updatedTeam = new Team(result.rows[0]);
    Object.assign(this, updatedTeam);
    return this;
  }

  async delete() {
    const result = await query('DELETE FROM teams WHERE id = $1 RETURNING *', [this.id]);
    if (result.rows.length === 0) {
      throw new ApiError(404, 'Team not found');
    }
  }

  async getUsers() {
    const result = await query('SELECT * FROM users WHERE team_id = $1', [this.id]);
    return result.rows;
  }

  async getPlatformCredentials() {
    const result = await query(
      'SELECT * FROM platform_credentials WHERE team_id = $1 AND is_active = true',
      [this.id]
    );
    return result.rows;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      plan: this.plan,
      quotaLimit: this.quotaLimit,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}