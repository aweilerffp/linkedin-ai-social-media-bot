import { AuthService } from '../src/services/auth/AuthService.js';
import { initializeDatabase } from '../src/config/database.js';

// Set up environment variables
process.env.JWT_SECRET = 'prod-jwt-secret-key-change-in-real-production-2024';
process.env.JWT_REFRESH_SECRET = 'prod-refresh-secret-key-change-in-real-production-2024';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'social_media_poster';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';

async function createTestUser() {
  try {
    console.log('Initializing database connection...');
    await initializeDatabase();
    
    console.log('Creating test users...');
    const authService = new AuthService();
    
    // Create test user 1
    const user1 = await authService.register({
      email: 'alice@example.com',
      password: 'testpass123',
      name: 'Alice Johnson',
      teamName: 'Alice Team'
    });
    console.log('✅ Created user:', user1.user.email);
    
    // Create test user 2
    const user2 = await authService.register({
      email: 'bob@example.com', 
      password: 'testpass456',
      name: 'Bob Smith',
      teamName: 'Bob Team'
    });
    console.log('✅ Created user:', user2.user.email);
    
    console.log('\n🎉 Test users created successfully!');
    console.log('You can now test login with:');
    console.log('- alice@example.com / testpass123');
    console.log('- bob@example.com / testpass456');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestUser();