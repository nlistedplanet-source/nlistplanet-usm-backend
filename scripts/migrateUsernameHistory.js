import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import UsernameHistory from '../models/UsernameHistory.js';

dotenv.config();

async function migrateExistingUsernames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Get all existing users
    const users = await User.find({}).select('_id username createdAt');
    console.log(`📊 Found ${users.length} users to migrate\n`);

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if username already exists in history
      const existingHistory = await UsernameHistory.findOne({ 
        username: user.username.toLowerCase(),
        userId: user._id 
      });

      if (existingHistory) {
        console.log(`⏩ Skipped: ${user.username} (already in history)`);
        skipped++;
        continue;
      }

      // Add to history
      await UsernameHistory.create({
        username: user.username.toLowerCase(),
        userId: user._id,
        changedAt: user.createdAt,
        reason: 'Migration - Initial username'
      });

      console.log(`✅ Migrated: ${user.username}`);
      migrated++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 Migration Summary:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏩ Skipped: ${skipped}`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    process.exit(1);
  }
}

migrateExistingUsernames();
