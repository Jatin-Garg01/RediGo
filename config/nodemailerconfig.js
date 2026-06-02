const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
     host: 'smtp.gmail.com',
     port: 587,
     secure: false, // Use TLS (not SSL)
     requireTLS: true,
     auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASSWORD 
     },
     connectionTimeout: 10000,
     socketTimeout: 10000
});

 

 async function sendMail(to, subject, otp) {
    return await new Promise((resolve, reject) => {
        const mailOptions = {
            from: `"Redigo" <${process.env.EMAIL}>`,  
            to: to,
            subject: subject || "Your OTP Code for Redigo",  
            html: `
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
            `,
            text: `Hello User,

        Thank you for using Redigo!  

        Your One-Time Password (OTP) is: ${otp}

        Please enter this code to verify your email address. This OTP is valid for 5 minutes.

        If you did not request this code, please ignore this email.

        Best regards,
        The Redigo Team  
        🚗 Share your ride, share the journey!
        `
        };
        
        console.log('📧 Attempting to send email to:', to);
        
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("❌ Error sending email:", error);
                reject(error);
            } else {
                console.log("✅ Email sent successfully:", info.response);
                resolve(info);
            }
        });
    });
}

module.exports = {
    sendMail
}