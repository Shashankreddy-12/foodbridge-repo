import nodemailer from 'nodemailer';
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'loaded' : 'MISSING');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  await transporter.sendMail({
    from: `"FoodBridge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset your FoodBridge password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #16a34a;">🌱 FoodBridge Password Reset</h2>
        <p>You requested a password reset. Click the button below:</p>
        <a href="${resetUrl}" 
           style="background: #16a34a; color: white; padding: 12px 24px; 
                  border-radius: 6px; text-decoration: none; display: inline-block;">
          Reset Password
        </a>
        <p style="color: #666; margin-top: 16px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  });
}
