import mongoose from 'mongoose';
import Company from '../models/Company.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const updateCompaniesWithLogos = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Mapping of company names to logos and sectors
    const companyUpdates = [
      {
        name: "National Stock Exchange of",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/NSE_India_logo.svg/1200px-NSE_India_logo.svg.png",
        sector: "Financial Service"
      },
      {
        name: "SBI Funds Management",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/52/SBI_Mutual_Fund_Logo.svg/640px-SBI_Mutual_Fund_Logo.svg.png",
        sector: "Financial Service"
      },
      {
        name: "Zepto Private Limited",
        logo: "https://seeklogo.com/images/Z/zepto-logo-80219A091E-seeklogo.com.png",
        sector: "eCommerce"
      },
      {
        name: "Airtel Payments Bank Limited",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/d/de/Airtel_Payments_Bank_logo.svg/1280px-Airtel_Payments_Bank_logo.svg.png",
        sector: "Bank"
      },
      {
        name: "Goa Shipyard Limited",
        logo: "https://upload.wikimedia.org/wikipedia/commons/5/59/Goa_Shipyard_Limited_Logo.svg",
        sector: "Shipping"
      },
      {
        name: "Acko General Insurance Limited",
        logo: "https://companieslogo.com/img/orig/ACKO.NS-e4187c5c.png",
        sector: "General Insurance"
      },
      {
        name: "Oravel Stays Limited",
        logo: "https://upload.wikimedia.org/wikipedia/commons/a/a6/OYO_logo.svg",
        sector: "Hospitality"
      },
      {
        name: "HDFC Ergo General Insurance Company Limited",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/HDFC_Securities_Logo.svg/512px-HDFC_Securities_Logo.svg.png",
        sector: "General Insurance"
      },
      {
        name: "Hinduja Leyland Finance Limited",
        logo: "https://www.hindujaleidenfinance.com/assets/images/logo.png",
        sector: "NBFC"
      },
      {
        name: "Acevector Limited",
        logo: "https://acevector.com/wp-content/uploads/2023/06/acevector-logo.png",
        sector: "Technology"
      },
      {
        name: "PNB Metlife India Insurance Company Limited",
        logo: "https://www.pnbmetlife.com/content/dam/pnb-metlife/logo/pnb-metlife-logo.png",
        sector: "Life Insurance"
      },
      {
        name: "Emaar India Limited",
        logo: "https://www.emaar.com/wp-content/themes/emaar/assets/images/logo.svg",
        sector: "Real Estate"
      }
    ];

    let updated = 0;
    let notFound = 0;

    for (const update of companyUpdates) {
      const company = await Company.findOne({ name: { $regex: update.name, $options: 'i' } });
      
      if (company) {
        company.logo = update.logo;
        company.sector = update.sector;
        await company.save();
        console.log(`✅ Updated: ${company.name}`);
        updated++;
      } else {
        console.log(`❌ Not found: ${update.name}`);
        notFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Updated: ${updated} companies`);
    console.log(`  ❌ Not found: ${notFound} companies`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

updateCompaniesWithLogos();
