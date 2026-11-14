import nodemailer from "nodemailer";

export const sendOtpEmail = async (email, otp) => {
  const isSmtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );

  console.log("\n=======================================================");
  console.log(`🔑 [OTP GENERATED] Email: ${email} | CODE: [ ${otp} ]`);
  console.log(`⏰ Valid for 10 minutes.`);
  console.log("=======================================================\n");

  if (!isSmtpConfigured) {
    return {
      success: true,
      delivered: false,
      devMode: true,
      message: "SMTP not configured: OTP output to server console",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || `"Vairaa Whiteboard" <noreply@whiteboard.com>`,
      to: email,
      subject: `Your Vairaa Whiteboard Verification Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">Vairaa Whiteboard</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Collaborative Canvas & Visual Workspace</p>
          </div>
          
          <p style="color: #1e293b; font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">Use the one-time code below to verify your account and access your personal whiteboard workspace:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; padding: 14px 28px; background-color: #f1f5f9; border-radius: 8px; border: 1px dashed #cbd5e1; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e1b4b;">
              ${otp}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">This code will expire in 10 minutes.</p>
          </div>
          
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If you did not request this verification code, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">&copy; ${new Date().getFullYear()} Vairaa Whiteboard. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, delivered: true, devMode: false };
  } catch (error) {
    console.error("[Mailer Error] Failed to send email via SMTP:", error.message);
    // Fall back to server console so user is never blocked
    return {
      success: true,
      delivered: false,
      devMode: true,
      error: error.message,
    };
  }
};

