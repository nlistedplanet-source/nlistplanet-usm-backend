import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    const usernames = ['cyber_millionaire_81', 'coolshark339'];
    
    const users = await User.find({
      username: { $in: usernames }
    }).select('username email phone createdAt referredBy addressLine1 city state');

    if (users.length === 0) {
      console.log('\n❌ No users found with these usernames');
      process.exit(0);
    }

    console.log(`\n✅ Found ${users.length} user(s):\n`);
    
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Phone: ${user.phone}`);
      console.log(`  Referred By: ${user.referredBy || 'None'}`);
      console.log(`  City: ${user.city || 'N/A'}`);
      console.log(`  State: ${user.state || 'N/A'}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log('---');
    });

    // Check if they share any common identifiers
    if (users.length === 2) {
      console.log('\n🔍 Comparison Analysis:');
      
      const [user1, user2] = users;
      
      if (user1.email === user2.email) {
        console.log('⚠️  SAME EMAIL: ' + user1.email);
      } else {
        console.log('✓ Different emails');
      }
      
      if (user1.phone === user2.phone) {
        console.log('⚠️  SAME PHONE: ' + user1.phone);
      } else {
        console.log('✓ Different phones');
      }
      
      if (user1.city === user2.city && user1.city) {
        console.log('⚠️  Same city: ' + user1.city);
      }
      
      if (user1.state === user2.state && user1.state) {
        console.log('⚠️  Same state: ' + user1.state);
      }
      
      const timeDiff = Math.abs(new Date(user1.createdAt) - new Date(user2.createdAt));
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      console.log(`\n⏱️  Time between account creations: ${hoursDiff.toFixed(2)} hours`);
      
      if (hoursDiff < 24) {
        console.log('⚠️  Both accounts created within 24 hours!');
      }
      
      // Final verdict
      console.log('\n📊 VERDICT:');
      if (user1.email === user2.email || user1.phone === user2.phone) {
        console.log('🚨 YES - These are DEFINITELY the same user (shared email/phone)');
      } else if (hoursDiff < 24 && user1.city === user2.city) {
        console.log('⚠️  LIKELY the same user (created close together, same location)');
      } else {
        console.log('✓ Appears to be different users');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
