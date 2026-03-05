// Test script to check if challenges API is working
const API_BASE_URL = 'http://localhost:5000/api/v1';

async function testChallengesAPI() {
  try {
    // Get token from localStorage (assuming user is logged in)
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ No auth token found. Please log in first.');
      alert('Please log in to the app first');
      return;
    }

    console.log('🔍 Testing Challenges API...');
    console.log('Token:', token.substring(0, 20) + '...');

    // Test 1: Get all challenges
    console.log('\n📋 Test 1: GET /challenges');
    const res1 = await fetch(`${API_BASE_URL}/challenges`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data1 = await res1.json();
    console.log('Status:', res1.status);
    console.log('Response:', data1);

    // Test 2: Get active challenges
    console.log('\n📋 Test 2: GET /challenges/active');
    const res2 = await fetch(`${API_BASE_URL}/challenges/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data2 = await res2.json();
    console.log('Status:', res2.status);
    console.log('Response:', data2);

    // Test 3: Get stats
    console.log('\n📋 Test 3: GET /challenges/stats');
    const res3 = await fetch(`${API_BASE_URL}/challenges/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data3 = await res3.json();
    console.log('Status:', res3.status);
    console.log('Response:', data3);

    console.log('\n✅ API tests complete. Check results above.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run immediately
testChallengesAPI();
