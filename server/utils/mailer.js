import nodemailer from "nodemailer";

const getTransporter = () => {
  // Explicit SMTP host takes priority (SendGrid, SES, Brevo, Mailgun, etc.)
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  // Gmail with an App Password
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (user && pass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  throw new Error("Email service is not configured. Set SMTP_HOST or EMAIL_USER and EMAIL_PASS.");
};

export const sendOtpEmail = async (email, otp, expiresInMinutes = 10) => {
  const transporter = getTransporter();

  const sender =
    process.env.SMTP_FROM ||
    `"Vairaa Whiteboard" <${process.env.EMAIL_USER || "noreply@whiteboard.com"}>`;

  const mailOptions = {
    from: sender,
    to: email,
    subject: `Your Vairaa Whiteboard Verification Code: ${otp}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #4f46e5; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Vairaa Whiteboard</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Secure Passwordless Authentication</p>
        </div>
        
        <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin-bottom: 12px;">Hello,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Here is your one-time verification code to sign in and access your personal whiteboard workspace:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; padding: 16px 36px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 2px dashed #818cf8; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #312e81; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 10px;">Valid for <strong>${expiresInMinutes} minutes</strong>. Do not share this code with anyone.</p>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px;">
          If you did not request this verification code, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} Vairaa Whiteboard. All rights reserved.
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`\n📧 [Mailer] Real email delivered to: ${email} (MessageId: ${info.messageId})`);
  return { success: true, messageId: info.messageId };
};
