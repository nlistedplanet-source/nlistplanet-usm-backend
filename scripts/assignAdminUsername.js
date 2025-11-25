import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const assignAdminUsername = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    const adminUser = await User.findOne({ email: 'admin@unlistedhub.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log('Current admin details:');
    console.log(`Email: ${adminUser.email}`);
    console.log(`Username: ${adminUser.username}`);
    console.log(`Full Name: ${adminUser.fullName}`);

    // Update admin username to something meaningful
    adminUser.username = 'nlist_admin';
    adminUser.fullName = 'NList Platform Admin';
    await adminUser.save();

    console.log('\n✅ Admin username updated!');
    console.log(`New Username: ${adminUser.username}`);
    console.log(`Full Name: ${adminUser.fullName}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

assignAdminUsername();
