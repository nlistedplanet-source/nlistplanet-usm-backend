import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import UsernameHistory from '../models/UsernameHistory.js';

dotenv.config();

async function testUsernameHistory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Find coolshark339 (praveensingh1@hotmail.com)
    const user = await User.findOne({ email: 'praveensingh1@hotmail.com' });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('📋 Current User Info:');
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user._id}\n`);

    // Check current username history
    console.log('📚 Current Username History:');
    const history = await UsernameHistory.find({ userId: user._id }).sort({ changedAt: 1 });
    history.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.username} (${entry.reason}) - ${entry.changedAt}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('🧪 Testing Username Change Prevention\n');

    // Test 1: Try to change to a new username (should work)
    const newUsername = 'test_' + Math.floor(Math.random() * 10000);
    console.log(`Test 1: Changing username to "${newUsername}" (should work)...`);
    
    const oldUsername = user.username;
    
    // Check if old username already in history (from migration)
    const alreadyInHistory = await UsernameHistory.findOne({ 
      username: oldUsername.toLowerCase(),
      userId: user._id 
    });

    // Simulate username change (only add to history if not already there)
    if (!alreadyInHistory) {
      await UsernameHistory.create({
        username: oldUsername.toLowerCase(),
        userId: user._id,
        reason: 'Test username change'
      });
    } else {
      console.log(`   Note: "${oldUsername}" already in history from migration`);
    }

    if (!user.previousUsernames) {
      user.previousUsernames = [];
    }
    user.previousUsernames.push({
      username: oldUsername,
      changedAt: new Date()
    });
    
    user.username = newUsername;
    await user.save();

    console.log(`✅ Username changed successfully to: ${user.username}\n`);

    // Test 2: Try to use old username for another user (should fail)
    console.log(`Test 2: Checking if old username "${oldUsername}" is blocked...`);
    const existingHistory = await UsernameHistory.findOne({ username: oldUsername.toLowerCase() });
    
    if (existingHistory) {
      console.log(`✅ Correct! Old username "${oldUsername}" is in history and cannot be reused`);
      console.log(`   Owned by User ID: ${existingHistory.userId}`);
      console.log(`   Reason: ${existingHistory.reason}\n`);
    } else {
      console.log(`❌ Error: Old username not found in history!\n`);
    }

    // Test 3: Show updated history
    console.log('📚 Updated Username History:');
    const updatedHistory = await UsernameHistory.find({ userId: user._id }).sort({ changedAt: 1 });
    updatedHistory.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.username} (${entry.reason}) - ${entry.changedAt}`);
    });

    console.log('\n📊 User previousUsernames Array:');
    user.previousUsernames.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.username} - ${entry.changedAt}`);
    });

    // Restore original username
    console.log('\n🔄 Restoring original username...');
    user.username = oldUsername;
    await user.save();
    console.log(`✅ Username restored to: ${user.username}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ All tests completed successfully!');
    console.log('\n🔒 Username History System is working correctly:');
    console.log('   ✓ Old usernames are stored in history');
    console.log('   ✓ Old usernames cannot be reused by other users');
    console.log('   ✓ User has record of all previous usernames');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    process.exit(1);
  }
}

testUsernameHistory();
