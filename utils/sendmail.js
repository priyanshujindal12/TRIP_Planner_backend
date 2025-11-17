const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

async function sendMail(to, subject, html) {
    try {
        await transporter.sendMail({
            from: `"Ghumakkad Trips" <${process.env.MAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log("📩 Mail sent to:", to);
    } catch (error) {
        console.error("❌ Mail error:", error);
    }
}

module.exports = sendMail;
