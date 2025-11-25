import axios from 'axios';

const API_URL = 'https://nlistplanet-usm-api.onrender.com/api';

async function testUpdate() {
  try {
    // Login first
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin@unlistedhub.com',
      password: 'Admin@123456'
    });

    const token = loginRes.data.token;
    console.log('✅ Login successful\n');

    // Try to update API Holdings
    const formData = new FormData();
    formData.append('name', 'API Holdings Ltd');
    formData.append('scriptName', 'PharmEasy');
    formData.append('sector', 'eCommerce');
    formData.append('isin', 'INE0DJ201029');
    formData.append('cin', 'U60100MH2019PLC323444');
    formData.append('pan', 'AASCAI201E');

    const updateRes = await axios.put(
      `${API_URL}/admin/companies/691ea5dfa3b3f996c62318a9`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    console.log('✅ Update successful:', updateRes.data);

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testUpdate();
