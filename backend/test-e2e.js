const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    let bodyStr = null;
    if (data) {
      bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    options.headers = headers;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch(e) { parsed = body; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });
    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log('--- Starting HTTP E2E Auth & API Tests ---');
  const testUser = {
    name: 'Priya Patel',
    email: `priya_${Date.now()}@mumbai-tech.edu`,
    password: 'SecurePassword2026!',
    branch: 'Computer Science',
    year: '1st Year'
  };

  // 1. Register User
  console.log('1. Testing POST /api/auth/register...');
  const regRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, testUser);

  console.log('   Status:', regRes.statusCode);
  if (regRes.statusCode !== 201 || !regRes.data.success) {
    throw new Error('Registration failed: ' + JSON.stringify(regRes.data));
  }
  console.log('   Registered user:', regRes.data.user.name, regRes.data.user.email);

  // Extract Session Cookie
  const setCookie = regRes.headers['set-cookie'];
  if (!setCookie || !setCookie.some(c => c.startsWith('interviewace_session='))) {
    throw new Error('Missing interviewace_session cookie in registration response. Got: ' + JSON.stringify(setCookie));
  }
  const sessionCookie = setCookie.find(c => c.startsWith('interviewace_session=')).split(';')[0];
  console.log('   Session Cookie received:', sessionCookie.substring(0, 30) + '...');

  // 2. Test GET /api/auth/me with Cookie
  console.log('\n2. Testing GET /api/auth/me with session cookie...');
  const meRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Status:', meRes.statusCode);
  if (meRes.statusCode !== 200 || !meRes.data.authenticated) {
    throw new Error('Auth check failed: ' + JSON.stringify(meRes.data));
  }
  console.log('   Authenticated as:', meRes.data.user.name);

  // 3. Test Dashboard initially empty
  console.log('\n3. Testing GET /api/dashboard...');
  const dashRes1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Total sessions:', dashRes1.data.totalSessions);
  console.log('   Best score:', dashRes1.data.bestScore);

  // 4. Record an interview session to DB
  console.log('\n4. Testing POST /api/history (recording completed interview session)...');
  const sessionPayload = {
    role: 'Web Developer',
    difficulty: 'Entry-level / Junior',
    totalQuestions: 5,
    finalScore: 84,
    verdict: 'Almost ready',
    categoryScores: {
      'HR': 8.5,
      'Technical': 8.2,
      'Situational': 8.5
    },
    strengths: ['Clear articulate answers on web fundamentals', 'Solid STAR method in situational answer'],
    weaknesses: ['Add deeper examples of CSS grid and flexbox'],
    questions: [
      {
        number: 1,
        type: 'HR',
        question: 'Tell me about yourself.',
        answer: 'I am a first-year computer science engineering student passionate about frontend web development.',
        score: 8,
        filler_words: []
      },
      {
        number: 2,
        type: 'Technical',
        question: 'Explain the difference between let, const, and var.',
        answer: 'let and const are block-scoped introduced in ES6, whereas var is function-scoped. const cannot be reassigned.',
        score: 9,
        filler_words: []
      }
    ]
  };

  const saveRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/history',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  }, sessionPayload);
  console.log('   Status:', saveRes.statusCode);
  if (saveRes.statusCode !== 200 || !saveRes.data.id) {
    throw new Error('Save session failed: ' + JSON.stringify(saveRes.data));
  }
  console.log('   Saved session ID:', saveRes.data.id);

  // 5. Test Dashboard after recording session
  console.log('\n5. Testing GET /api/dashboard after interview session...');
  const dashRes2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Total sessions:', dashRes2.data.totalSessions);
  console.log('   Best score:', dashRes2.data.bestScore);
  console.log('   Avg score:', dashRes2.data.avgScore);
  console.log('   Strongest category:', dashRes2.data.strongestCategory);
  if (dashRes2.data.totalSessions !== 1 || dashRes2.data.bestScore !== 84) {
    throw new Error('Dashboard did not reflect database records properly!');
  }

  // 6. Test Bookmarks
  console.log('\n6. Testing POST and GET /api/bookmarks...');
  const bmAdd = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookmarks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  }, { questionId: 'tech-2', note: 'Revise let vs const' });
  console.log('   Add Bookmark Status:', bmAdd.statusCode);

  const bmGet = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookmarks',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Bookmarks retrieved:', bmGet.data.bookmarks.length, bmGet.data.bookmarks);
  const firstBm = bmGet.data.bookmarks[0];
  const firstId = typeof firstBm === 'string' ? firstBm : (firstBm ? firstBm.question_id : null);
  if (bmGet.data.bookmarks.length !== 1 || firstId !== 'tech-2') {
    throw new Error('Bookmarks sync failed: ' + JSON.stringify(bmGet.data));
  }

  // 7. Test 7-Day Plan Progress
  console.log('\n7. Testing PUT and GET /api/plan...');
  const planPut = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/plan',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  }, { completedDays: [0, 1, 2] });
  console.log('   Plan PUT status:', planPut.statusCode);

  const planGet = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/plan',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Plan completed days:', planGet.data.plan.completedDays);
  if (!planGet.data.plan.completedDays.includes(1)) {
    throw new Error('Plan sync failed!');
  }

  // 8. Test Data Export
  console.log('\n8. Testing GET /api/data/export...');
  const exportRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/data/export',
    method: 'GET',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Export status:', exportRes.statusCode);
  console.log('   Exported user:', exportRes.data.user.email);
  console.log('   Exported sessions count:', exportRes.data.sessions.length);
  console.log('   Exported bookmarks count:', exportRes.data.bookmarks.length);

  // 9. Test Logout & Re-login
  console.log('\n9. Testing POST /api/auth/logout and POST /api/auth/login...');
  const logoutRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/logout',
    method: 'POST',
    headers: { 'Cookie': sessionCookie }
  });
  console.log('   Logout status:', logoutRes.statusCode);

  // Re-login with credentials
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testUser.email, password: testUser.password });
  console.log('   Login status:', loginRes.statusCode);
  if (loginRes.statusCode !== 200 || !loginRes.data.success) {
    throw new Error('Re-login failed: ' + JSON.stringify(loginRes.data));
  }
  const newSetCookie = loginRes.headers['set-cookie'].find(c => c.startsWith('interviewace_session=')).split(';')[0];

  // 10. Test Account Deletion with Password Confirmation
  console.log('\n10. Testing DELETE /api/auth/account (cascading wipeout)...');
  const deleteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/account',
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': newSetCookie
    }
  }, { password: testUser.password });
  console.log('   Delete Account status:', deleteRes.statusCode);
  if (deleteRes.statusCode !== 200 || !deleteRes.data.success) {
    throw new Error('Account deletion failed: ' + JSON.stringify(deleteRes.data));
  }

  // Verify re-login is impossible
  const deadLoginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testUser.email, password: testUser.password });
  console.log('   Login after deletion status (should fail 401):', deadLoginRes.statusCode);
  if (deadLoginRes.statusCode !== 401) {
    throw new Error('User was still able to login after account deletion!');
  }

  console.log('\n>>> ALL 10 HTTP END-TO-END TESTS PASSED WITH 100% SUCCESS! <<<');
}

runE2ETests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
