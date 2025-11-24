import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected...');

    // Admin credentials
    const adminData = {
      username: 'admin',
      email: 'admin@unlistedhub.com',
      password: 'Admin@123456', // Must be 12+ chars, alphanumeric only
      fullName: 'Admin User',
      phone: '9999999999',
      role: 'admin',
      isVerified: true
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [{ email: adminData.email }, { username: adminData.username }] 
    });

    if (existingAdmin) {
      console.log('❌ Admin user already exists!');
      console.log('Username:', existingAdmin.username);
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      
      // Update existing user to admin if needed
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        existingAdmin.isVerified = true;
        await existingAdmin.save();
        console.log('✅ User updated to admin role');
      }
    } else {
      // Create new admin user
      const admin = await User.create(adminData);
      console.log('✅ Admin user created successfully!');
      console.log('Username:', admin.username);
      console.log('Email:', admin.email);
      console.log('Password:', adminData.password);
      console.log('Role:', admin.role);
    }

    console.log('\n📋 Login Credentials:');
    console.log('Username: admin');
    console.log('Password: Admin@123456');
    console.log('\nNote: Password must be alphanumeric (letters + numbers only)');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createAdmin();
