import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const removeAdminRole = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Remove admin role from praveensingh1@hotmail.com
    const userEmail = 'praveensingh1@hotmail.com';
    const user = await User.findOne({ email: userEmail.toLowerCase() });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log(`Current user: ${user.username}`);
    console.log(`Current role: ${user.role}`);

    // Make regular user
    user.role = 'user';
    await user.save();

    console.log(`\n✅ User role changed back to regular user!`);
    console.log(`Email: ${user.email}`);
    console.log(`Username: ${user.username}`);
    console.log(`Role: ${user.role}`);

    // Verify admin user still exists
    const adminUser = await User.findOne({ email: 'admin@unlistedhub.com' });
    if (adminUser) {
      console.log(`\n✅ Default admin (unchanged):`);
      console.log(`Email: ${adminUser.email}`);
      console.log(`Username: ${adminUser.username}`);
      console.log(`Role: ${adminUser.role}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

removeAdminRole();
