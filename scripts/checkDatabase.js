import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Listing from '../models/Listing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const checkDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Check Companies
    const companies = await Company.find({});
    console.log(`📊 Companies in database: ${companies.length}`);
    if (companies.length > 0) {
      console.log('\nSample companies:');
      companies.slice(0, 5).forEach(c => {
        console.log(`  - ${c.name} (${c.sector}) - Logo: ${c.logo ? 'Yes' : 'No'}`);
      });
    }

    // Check Users
    const users = await User.find({});
    const admins = await User.find({ role: 'admin' });
    console.log(`\n👥 Users in database: ${users.length}`);
    console.log(`👑 Admin users: ${admins.length}`);
    if (admins.length > 0) {
      console.log('\nAdmin users:');
      admins.forEach(u => {
        console.log(`  - ${u.username} (${u.email}) - Role: ${u.role}`);
      });
    }

    // Check Listings
    const listings = await Listing.find({}).populate('companyId');
    console.log(`\n📝 Listings in database: ${listings.length}`);
    if (listings.length > 0) {
      console.log('\nSample listings:');
      listings.slice(0, 3).forEach(l => {
        console.log(`  - ${l.companyId?.name || 'Unknown Company'} - ₹${l.price} x ${l.quantity}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkDatabase();
