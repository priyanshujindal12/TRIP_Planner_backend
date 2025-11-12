const { Router } = require("express");
const router = Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.ChatBot_key);

router.post("/create", async (req, res) => {
    console.log("request came");
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: "Message is required" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `
Instruction for you (very important):
- Always reply in short bullet points (•) or numbered lists (1️⃣, 2️⃣, 3️⃣).
- Use emojis in every point — make it friendly and fun.
- Never write long paragraphs. Keep things concise and travel-guide style.
- If answer is big, summarize in max 5 bullet points.
- Don’t use markdown bolds (**like this**).
- Keep tone simple, cheerful, and human.

User Question:
${message}
    `;
        const result = await model.generateContent(prompt);
        const reply = result?.response?.text() || "No reply ✨";

        res.json({ success: true, reply });
    } catch (err) {
        console.error("Chatbot error:", err);
        return res
            .status(500)
            .json({ success: false, message: err.message || "Something went wrong 💥" });
    }
});

module.exports = router;
