// test-call-trigger.js
// Run this script to test the doctor call system without needing LangGraph

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Wait utility
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Check if server is running
async function testServerHealth() {
  log('blue', '\n🔍 Test 1: Checking server health...');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    log('green', '✅ Server is running!');
    console.log('   Connected doctors:', response.data.connectedDoctors);
    console.log('   Doctor IDs:', response.data.doctors || []);
    console.log('   Active calls:', response.data.activeRealtimeCalls);
    return response.data;
  } catch (error) {
    log('red', '❌ Server is not running!');
    console.log('   Error:', error.message);
    console.log('   Make sure to start the server with: node server.js');
    return null;
  }
}

// Check connected doctors
async function checkDoctors() {
  log('blue', '\n👥 Checking connected doctors...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/doctors`);
    
    if (response.data.count === 0) {
      log('yellow', '⚠️  No doctors currently connected');
      log('cyan', '   Please make sure:');
      console.log('   1. React frontend is running (npm start)');
      console.log('   2. Open the doctor UI in your browser (http://localhost:3000)');
      console.log('   3. Wait for the WebSocket to connect');
      console.log('   4. Check browser console for "Connected to server" message');
      return false;
    } else {
      log('green', `✅ ${response.data.count} doctor(s) connected`);
      console.log('   Doctors:', response.data.connectedDoctors.join(', '));
      return true;
    }
  } catch (error) {
    log('red', '❌ Could not check doctors');
    console.log('   Error:', error.message);
    return false;
  }
}

// Wait for doctor to connect
async function waitForDoctor(maxWaitTime = 30000) {
  log('yellow', '\n⏳ Waiting for doctor to connect...');
  console.log(`   Will wait up to ${maxWaitTime/1000} seconds`);
  
  const startTime = Date.now();
  let dots = 0;
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/doctors`);
      
      if (response.data.count > 0) {
        log('green', '\n✅ Doctor connected!');
        console.log('   Doctor ID:', response.data.connectedDoctors[0]);
        return response.data.connectedDoctors[0];
      }
      
      // Show progress
      process.stdout.write(`\r   Waiting${'.'.repeat(dots % 4)}${' '.repeat(3 - (dots % 4))}`);
      dots++;
      
      await wait(1000);
      
    } catch (error) {
      log('red', '\n❌ Error while waiting');
      return null;
    }
  }
  
  log('red', '\n❌ Timeout - no doctor connected');
  return null;
}

// Test 2: Trigger an incoming call
async function testIncomingCall(doctorId = 'dr_sarah_123') {
  log('blue', '\n📞 Test 2: Triggering incoming call...');
  
  const callData = {
    doctorId: doctorId,
    patientName: 'احمد خان',  // Ahmed Khan in Urdu
    appointmentType: 'عام معائنہ',  // General Consultation
    symptoms: 'بخار، سر درد اور کھانسی تین دن سے',  // Fever, headache, and cough for 3 days
    callId: `test_call_${Date.now()}`
  };
  
  console.log('   Sending call to:', doctorId);
  console.log('   Patient:', callData.patientName);
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/initiate-call`, callData);
    
    if (response.data.success) {
      log('green', '✅ Call initiated successfully!');
      console.log('   Call ID:', response.data.callId);
      log('magenta', '   🔔 CHECK YOUR BROWSER NOW!');
      log('magenta', '   You should see an incoming call notification');
      return response.data.callId;
    } else {
      log('red', '❌ Call initiation failed');
      console.log('   Response:', response.data);
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      log('yellow', '⚠️  Doctor not connected to the system');
      console.log('   Response:', error.response.data);
      if (error.response.data.availableDoctors) {
        console.log('   Available doctors:', error.response.data.availableDoctors);
      }
    } else {
      log('red', '❌ Error triggering call');
      console.log('   Error:', error.message);
      if (error.response) {
        console.log('   Response:', error.response.data);
      }
    }
    return null;
  }
}

// Test 3: Simulate appointment confirmation
async function testAppointmentConfirmation(callId) {
  log('blue', '\n📅 Test 3: Simulating appointment confirmation...');
  
  const appointmentData = {
    callId: callId,
    patientName: 'Ahmed Khan',
    doctorName: 'Dr. Sarah',
    appointmentTime: '2025-11-18T14:00:00',
    appointmentType: 'General Consultation',
    notes: 'Patient prefers afternoon appointments. Follow-up needed in 2 weeks.'
  };
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/confirm-appointment`, appointmentData);
    
    if (response.data.success) {
      log('green', '✅ Appointment confirmed successfully!');
      console.log('   Message:', response.data.message);
      log('cyan', '   📤 Appointment data would be sent to LangGraph');
      return true;
    } else {
      log('red', '❌ Appointment confirmation failed');
      console.log('   Response:', response.data);
      return false;
    }
  } catch (error) {
    log('red', '❌ Error confirming appointment');
    console.log('   Error:', error.message);
    return false;
  }
}

// Interactive mode - trigger call with custom data
async function interactiveMode() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise((resolve) => readline.question(query, resolve));
  
  log('cyan', '\n🎮 Interactive Mode - Enter call details:');
  
  // First check for connected doctors
  const healthData = await testServerHealth();
  if (!healthData) {
    readline.close();
    return;
  }
  
  let doctorId = 'dr_sarah_123';
  
  if (healthData.doctors && healthData.doctors.length > 0) {
    console.log('\n📋 Available doctors:', healthData.doctors.join(', '));
    const selectedDoctor = await question(`Doctor ID (default: ${healthData.doctors[0]}): `);
    doctorId = selectedDoctor || healthData.doctors[0];
  } else {
    log('yellow', '\n⚠️  No doctors connected. Using default: dr_sarah_123');
    const customId = await question('Enter doctor ID or press Enter to continue: ');
    if (customId) doctorId = customId;
  }
  
  const patientName = await question('\nPatient name: ');
  const symptoms = await question('Symptoms: ');
  const appointmentType = await question('Appointment type (default: Consultation): ') || 'Consultation';
  
  const callData = {
    doctorId: doctorId,
    patientName: patientName || 'Test Patient',
    appointmentType,
    symptoms: symptoms || 'Test symptoms',
    callId: `interactive_${Date.now()}`
  };
  
  console.log('\n📤 Sending call...');
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/initiate-call`, callData);
    if (response.data.success) {
      log('green', '\n✅ Call sent to doctor!');
      log('magenta', '🔔 CHECK YOUR BROWSER NOW!');
    }
  } catch (error) {
    log('red', '\n❌ Failed to send call');
    if (error.response) {
      console.log('   Error:', error.response.data);
    } else {
      console.log('   Error:', error.message);
    }
  }
  
  readline.close();
}

// Main test runner
async function runAllTests() {
  log('cyan', '\n' + '='.repeat(60));
  log('cyan', '🧪 DOCTOR CALL SYSTEM - TEST SUITE');
  log('cyan', '='.repeat(60));
  
  // Test 1: Server health
  const healthData = await testServerHealth();
  if (!healthData) {
    log('red', '\n❌ Cannot proceed - server is not running');
    process.exit(1);
  }
  
  await wait(1000);
  
  // Check if doctors are connected
  const hasDoctors = await checkDoctors();
  
  let doctorId = 'dr_sarah_123';
  
  if (!hasDoctors) {
    log('yellow', '\n⏳ No doctors connected yet...');
    log('cyan', '\n📋 Please follow these steps:');
    console.log('   1. Open another terminal');
    console.log('   2. Navigate to your React app folder');
    console.log('   3. Run: npm start');
    console.log('   4. Open http://localhost:3000 in your browser');
    console.log('   5. Wait for "Connected to server" message');
    console.log('\n   OR press Ctrl+C to exit and run test later\n');
    
    // Wait for doctor to connect
    doctorId = await waitForDoctor(30000);
    
    if (!doctorId) {
      log('red', '\n❌ Test aborted - no doctor available');
      log('yellow', '💡 Tip: Start the React frontend first, then run this test');
      process.exit(1);
    }
  } else if (healthData.doctors && healthData.doctors.length > 0) {
    doctorId = healthData.doctors[0];
  }
  
  await wait(2000);
  
  // Test 2: Initiate call
  const callId = await testIncomingCall(doctorId);
  
  if (callId) {
    log('yellow', '\n⏳ Waiting 10 seconds...');
    log('cyan', '   (This gives you time to interact with the UI)');
    await wait(10000);
    
    // Test 3: Confirm appointment
    await testAppointmentConfirmation(callId);
  } else {
    log('yellow', '\n⚠️  Skipping appointment confirmation test');
  }
  
  log('cyan', '\n' + '='.repeat(60));
  log('green', '✅ TEST SUITE COMPLETED');
  log('cyan', '='.repeat(60));
  
  log('yellow', '\n💡 Tips:');
  console.log('   - Make sure React frontend stays open during tests');
  console.log('   - Check browser DevTools console for WebSocket messages');
  console.log('   - Check server logs for detailed call flow information');
  console.log('   - Use --interactive mode to test with custom data');
}

// Quick test - just one call
async function quickTest() {
  log('cyan', '\n⚡ QUICK TEST\n');
  
  const healthData = await testServerHealth();
  if (!healthData) {
    process.exit(1);
  }
  
  await wait(1000);
  
  const hasDoctors = await checkDoctors();
  
  let doctorId = 'dr_sarah_123';
  
  if (!hasDoctors) {
    log('yellow', '\n⏳ Waiting for doctor to connect...');
    doctorId = await waitForDoctor(15000);
    if (!doctorId) {
      log('red', '\n❌ No doctor connected');
      log('yellow', '💡 Start the React frontend first');
      process.exit(1);
    }
  } else if (healthData.doctors && healthData.doctors.length > 0) {
    doctorId = healthData.doctors[0];
  }
  
  await wait(1000);
  await testIncomingCall(doctorId);
  
  log('cyan', '\n✅ Quick test completed\n');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Doctor Call System - Test Script

Usage:
  node test-call-trigger.js [options]

Options:
  (no args)     Run full test suite with automatic doctor detection
  --interactive Run in interactive mode to create custom calls
  --quick       Quick test - just trigger one call
  --health      Just check server health and connected doctors
  --wait        Wait for doctor to connect before testing
  --help        Show this help message

Examples:
  node test-call-trigger.js
  node test-call-trigger.js --interactive
  node test-call-trigger.js --quick
  node test-call-trigger.js --wait
  `);
  process.exit(0);
}

// Run based on arguments
(async () => {
  try {
    if (args.includes('--interactive') || args.includes('-i')) {
      await interactiveMode();
    } else if (args.includes('--quick') || args.includes('-q')) {
      await quickTest();
    } else if (args.includes('--health')) {
      await testServerHealth();
      await checkDoctors();
    } else if (args.includes('--wait')) {
      await testServerHealth();
      const doctorId = await waitForDoctor(60000);
      if (doctorId) {
        await wait(2000);
        await testIncomingCall(doctorId);
      }
    } else {
      await runAllTests();
    }
  } catch (error) {
    log('red', '\n💥 Unexpected error:');
    console.error(error);
    process.exit(1);
  }
})();