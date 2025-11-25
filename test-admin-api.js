import axios from 'axios';

const API_URL = 'https://nlistplanet-usm-api.onrender.com/api';

// Test admin companies endpoint
async function testAdminAPI() {
  try {
    console.log('Testing admin companies endpoint...\n');

    // First login as admin to get token
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin@unlistedhub.com',
      password: 'Admin@123456'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('Token:', token.substring(0, 50) + '...\n');

    // Now test companies endpoint
    const companiesResponse = await axios.get(`${API_URL}/admin/companies`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('✅ Companies fetch successful');
    console.log('Total companies:', companiesResponse.data.count);
    console.log('\nFirst 5 companies:');
    companiesResponse.data.companies.slice(0, 5).forEach(company => {
      console.log(`  - ${company.name} (${company.sector}) - Listings: ${company.listingsCount}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config.url);
    }
  }
}

testAdminAPI();
