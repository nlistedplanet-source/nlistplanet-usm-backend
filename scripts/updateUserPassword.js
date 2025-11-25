import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../.env') });

const updatePassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const email = 'praveensingh1@hotmail.com';
    const newPassword = 'Div@10390';

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found with email:', email);
      process.exit(1);
    }

    console.log('✅ User found:', user.email);
    console.log('Current username:', user.username);

    // Update password (pre-save hook will hash it automatically)
    user.password = newPassword;
    await user.save();

    console.log('✅ Password updated successfully!');
    console.log('\n📋 Login credentials:');
    console.log('Email:', user.email);
    console.log('Password:', newPassword);
    console.log('Username:', user.username);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

updatePassword();
