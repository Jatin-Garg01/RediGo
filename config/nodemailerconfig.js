const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendMail(to, subject, otp) {
    try {
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #0891b2;">Welcome to Redigo! 🚗</h2>
                
                <p>Hello User,</p>
                
                <p>Thank you for using Redigo!</p>
                
                <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h3 style="color: #0891b2; margin-top: 0;">Your OTP Code:</h3>
                    <div style="font-size: 32px; font-weight: bold; color: #0f172a; letter-spacing: 5px; font-family: monospace;">
                        ${otp}
                    </div>
                </div>
                
                <p>Please enter this code to verify your email address. This OTP is valid for <strong>5 minutes</strong>.</p>
                
                <p style="color: #6b7280; font-size: 14px;">
                    If you did not request this code, please ignore this email.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                
                <p style="color: #6b7280; font-size: 14px;">
                    Best regards,<br>
                    The Redigo Team<br>
                    🚗 Share your ride, share the journey!
                </p>
            </div>
        `;

        const textContent = `Hello User,

Thank you for using Redigo!  

Your One-Time Password (OTP) is: ${otp}

Please enter this code to verify your email address. This OTP is valid for 5 minutes.

If you did not request this code, please ignore this email.

Best regards,
The Redigo Team  
🚗 Share your ride, share the journey!
        `;

        const msg = {
            to: to,
            from: process.env.FROM_EMAIL,
            subject: subject || "Your OTP Code for Redigo",
            text: textContent,
            html: htmlContent,
        };

        console.log('📧 Attempting to send email to:', to);
        
        const result = await sgMail.send(msg);
        
        console.log("✅ Email sent successfully!");
        return result;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        if (error.response) {
            console.error("Error details:", error.response.body);
        }
        throw error;
    }
}

module.exports = {
    sendMail
}