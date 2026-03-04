#!/usr/bin/env node

const http = require('http');

const API_BASE = 'http://localhost:5000/api/v1';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  try {
    console.log('\n========== TESTING BILLS API ==========\n');

    // Test 1: Login with test user
    console.log('1. LOGIN TEST');
    const loginRes = await makeRequest('POST', '/auth/login', {
      identifier: 'test@example.com',
      password: 'Test@1234'
    });
    console.log(`   Status: ${loginRes.status}`);
    console.log(`   Response:`, JSON.stringify(loginRes.body, null, 2));
    
    if (loginRes.status === 200 && loginRes.body && loginRes.body.data && loginRes.body.data.token) {
      const token = loginRes.body.data.token;
      console.log(`   ✓ Got token: ${token.substring(0, 20)}...`);

      // Test 2: Get bills
      console.log('\n2. GET BILLS');
      const billsRes = await makeRequest('GET', '/bills', null, token);
      console.log(`   Status: ${billsRes.status}`);
      console.log(`   Response:`, JSON.stringify(billsRes.body, null, 2));
      
      if (billsRes.body && billsRes.body.data) {
        console.log(`   ✓ Bills returned: ${billsRes.body.data.length} items`);
      }

      // Test 3: Get subscriptions
      console.log('\n3. GET SUBSCRIPTIONS');
      const subRes = await makeRequest('GET', '/subscriptions', null, token);
      console.log(`   Status: ${subRes.status}`);
      console.log(`   Response:`, JSON.stringify(subRes.body, null, 2));
      
      if (subRes.body && subRes.body.data) {
        console.log(`   ✓ Subscriptions returned: ${subRes.body.data.length} items`);
      }
    } else {
      console.log('   ✗ Login failed');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

test();
