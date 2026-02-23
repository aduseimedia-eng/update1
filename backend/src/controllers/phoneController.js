const { query } = require('../config/database');
const { generateOTP, sendOTP, verifyOTPViaArkesel } = require('../services/smsService');

/**
 * Send OTP to phone number
 * POST /api/v1/phone/send-otp
 * 
 * Uses Arkesel's OTP API which generates its own OTP and sends it.
 * We also store a record locally for rate-limiting and tracking.
 */
const sendPhoneOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate phone format (Ghana format: 233XXXXXXXXX or 0XXXXXXXXX)
    if (!/^(233[0-9]{9}|0[0-9]{9})$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Ghana phone number. Use format: 233XXXXXXXXX or 0XXXXXXXXX'
      });
    }

    // Clean up expired OTPs for this phone
    await query(
      'DELETE FROM phone_verification WHERE phone = $1 AND expires_at < NOW()',
      [phone]
    );

    // Check if there's already a valid OTP (rate-limiting: 1 per minute)
    const existingOTP = await query(
      'SELECT * FROM phone_verification WHERE phone = $1 AND expires_at > NOW() AND is_verified = false ORDER BY created_at DESC LIMIT 1',
      [phone]
    );

    if (existingOTP.rows.length > 0) {
      const timeSinceCreation = Date.now() - new Date(existingOTP.rows[0].created_at).getTime();
      const minutesPassed = Math.floor(timeSinceCreation / 60000);
      
      if (minutesPassed < 1) {
        return res.status(429).json({
          success: false,
          message: 'Please wait 1 minute before requesting a new OTP'
        });
      }
    }

    // Generate a local OTP for logging (Arkesel generates its own for SMS)
    const otp = generateOTP();

    // Save tracking record to database (expires in 10 minutes)
    await query(
      `INSERT INTO phone_verification (phone, otp, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes') 
       RETURNING id, phone, expires_at`,
      [phone, otp]
    );

    // Respond immediately — send SMS in background (Arkesel call takes 1-3s)
    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: '10 minutes'
      }
    });

    // Fire-and-forget: send OTP via Arkesel in the background
    sendOTP(phone, otp).then(sent => {
      if (!sent) {
        console.error(`❌ Background SMS send failed for ${phone}`);
      }
    }).catch(err => {
      console.error(`❌ Background SMS error for ${phone}:`, err.message);
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify OTP
 * POST /api/v1/phone/verify-otp
 * 
 * Verifies the OTP via Arkesel's OTP verify API.
 * On success, marks the user's phone as verified in our database.
 */
const verifyPhoneOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    // Try Arkesel OTP verify first (works when OTP API was used to send)
    const arkeselResult = await verifyOTPViaArkesel(phone, otp);

    if (!arkeselResult.success) {
      // Arkesel verify failed — fall back to local DB check
      // This handles: SMS v2 fallback sends, dev mode, or Arkesel verify errors
      console.log('\ud83d\udcf1 Arkesel verify failed, checking local database...');
      const localResult = await query(
        `SELECT * FROM phone_verification 
         WHERE phone = $1 AND otp = $2 AND expires_at > NOW() AND is_verified = false
         ORDER BY created_at DESC LIMIT 1`,
        [phone, otp]
      );

      if (localResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }
      console.log('\u2705 OTP verified via local database');
    } else {
      console.log('\u2705 OTP verified via Arkesel');
    }

    // Mark local records as verified
    await query(
      `UPDATE phone_verification 
       SET is_verified = true, verified_at = NOW() 
       WHERE phone = $1 AND is_verified = false`,
      [phone]
    );

    // Mark phone as verified for user
    await query(
      `UPDATE users 
       SET phone_verified = true, updated_at = NOW() 
       WHERE phone = $1`,
      [phone]
    );

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: {
        phone,
        verified: true,
        message: 'You can now login to your account'
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Resend OTP
 * POST /api/v1/phone/resend-otp
 */
const resendPhoneOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if user exists with this phone
    const userCheck = await query(
      'SELECT id, phone_verified FROM users WHERE phone = $1',
      [phone]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number'
      });
    }

    // Don't allow resending if already verified
    if (userCheck.rows[0].phone_verified) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already verified. You can login now.'
      });
    }

    // Delete old unverified OTPs
    await query(
      `DELETE FROM phone_verification 
       WHERE phone = $1 AND is_verified = false`,
      [phone]
    );

    // Send new OTP via Arkesel
    const otp = generateOTP();
    await query(
      `INSERT INTO phone_verification (phone, otp, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes') 
       RETURNING id, phone, expires_at`,
      [phone, otp]
    );

    // Respond immediately — send SMS in background
    res.json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        phone,
        expiresIn: '10 minutes'
      }
    });

    // Fire-and-forget: send OTP via Arkesel in background
    sendOTP(phone, otp).then(sent => {
      if (!sent) {
        console.error(`❌ Background resend failed for ${phone}`);
      }
    }).catch(err => {
      console.error(`❌ Background resend error for ${phone}:`, err.message);
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  sendPhoneOTP,
  verifyPhoneOTP,
  resendPhoneOTP
};
