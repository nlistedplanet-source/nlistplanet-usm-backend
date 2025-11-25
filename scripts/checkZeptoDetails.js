import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from '../models/Company.js';

dotenv.config();

const checkZeptoUpdate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    const zepto = await Company.findOne({ name: /zepto/i });
    
    if (!zepto) {
      console.log('❌ Zepto company not found');
      return;
    }

    console.log('📊 Zepto Company Details:');
    console.log('==========================');
    console.log('ID:', zepto._id);
    console.log('Name:', zepto.name);
    console.log('Script Name:', zepto.scriptName || 'N/A');
    console.log('Sector:', zepto.sector);
    console.log('ISIN:', zepto.isin || 'N/A');
    console.log('CIN:', zepto.cin || 'N/A');
    console.log('PAN:', zepto.pan || 'N/A');
    console.log('Logo:', zepto.logo ? `${zepto.logo.substring(0, 50)}...` : 'N/A');
    console.log('Description:', zepto.description || 'N/A');
    console.log('\nLast Updated:', zepto.updatedAt);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkZeptoUpdate();
