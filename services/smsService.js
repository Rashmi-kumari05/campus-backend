// Lazy load Twilio only if enabled
let twilioClient = null;

const initTwilio = () => {
  if (!twilioClient && process.env.SMS_ENABLED === 'true') {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
};

// Send SMS using Twilio
const sendSMSTwilio = async (to, message) => {
  try {
    const client = initTwilio();
    
    if (!client) {
      throw new Error('Twilio client not initialized');
    }

    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log(`✅ SMS sent to ${to}: ${response.sid}`);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error('❌ SMS Error:', error.message);
    throw error;
  }
};

// Mock SMS for development
const sendSMSMock = async (to, message) => {
  console.log('\n📱 ========== MOCK SMS ==========');
  console.log(`📞 To: ${to}`);
  console.log(`💬 Message: ${message}`);
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log('================================\n');
  
  return { 
    success: true, 
    mock: true,
    to,
    message,
    timestamp: new Date()
  };
};

// Main SMS function
exports.sendSMS = async (to, message) => {
  try {
    // Check if SMS is enabled
    if (process.env.SMS_ENABLED !== 'true') {
      console.log('ℹ️ SMS is disabled. Using mock service.');
      return await sendSMSMock(to, message);
    }

    // Check SMS provider
    const provider = process.env.SMS_PROVIDER || 'mock';

    if (provider === 'twilio') {
      return await sendSMSTwilio(to, message);
    } else {
      return await sendSMSMock(to, message);
    }
  } catch (error) {
    console.error('SMS Service Error:', error.message);
    // Fallback to mock if real SMS fails
    return await sendSMSMock(to, message);
  }
};

// Validate phone number
exports.isValidPhone = (phone) => {
  // Indian phone number format
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

// Format phone number for SMS
exports.formatPhone = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (cleaned.length === 10) {
    return `+91${cleaned}`; // India
  }
  
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  return cleaned;
};