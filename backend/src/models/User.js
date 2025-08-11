import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.name = data.name;
    this.role = data.role;
    this.teamId = data.team_id;
    this.isActive = data.is_active;
    this.lastLogin = data.last_login;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create({ email, password, name, role = 'member', teamId }) {
    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await query(
      'INSERT INTO users (email, password_hash, name, role, team_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [email, passwordHash, name, role, teamId]
    );
    return new User(result.rows[0]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByTeamId(teamId) {
    const result = await query(
      'SELECT * FROM users WHERE team_id = $1 AND is_active = true ORDER BY created_at DESC',
      [teamId]
    );
    return result.rows.map(row => new User(row));
  }

  async validatePassword(password) {
    return bcrypt.compare(password, this.passwordHash);
  }

  async updatePassword(newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *',
      [passwordHash, this.id]
    );
    
    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }
    
    this.passwordHash = passwordHash;
    return this;
  }

  async update({ name, role, isActive }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (fields.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    values.push(this.id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const updatedUser = new User(result.rows[0]);
    Object.assign(this, updatedUser);
    return this;
  }

  async updateLastLogin() {
    const result = await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *',
      [this.id]
    );
    
    if (result.rows.length > 0) {
      this.lastLogin = result.rows[0].last_login;
    }
    return this;
  }

  async getTeam() {
    if (!this.teamId) return null;
    
    const result = await query('SELECT * FROM teams WHERE id = $1', [this.teamId]);
    return result.rows[0] || null;
  }

  hasPermission(requiredRole) {
    const roleHierarchy = { member: 1, manager: 2, admin: 3 };
    return roleHierarchy[this.role] >= roleHierarchy[requiredRole];
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      teamId: this.teamId,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toSafeJSON() {
    const { passwordHash, ...safe } = this.toJSON();
    return safe;
  }
}