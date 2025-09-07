const { Router } = require('express');
const userRouter = Router();
const bcrypt = require('bcrypt');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require("../config");
const { userModel } = require('../db');
const usermiddleware = require("../middleware/usermiddleware");

userRouter.post('/signup', async function (req, res) {
    const required_body = z.object({
        email: z.string().min(3).max(100).email(),
        password: z.string().min(5).max(67).regex(/[a-z]/)
    });
    const parsedDataWithSuccess = required_body.safeParse(req.body);
    if (!parsedDataWithSuccess.success) {
        res.json({
            msg: "incoorect data",
            error: parsedDataWithSuccess.error
        })
        return
    }
    const { email, password } = req.body;
    let error = false;
    try {
        const exists = await userModel.findOne({ email });
        if (exists) {
            return res.status(409).json({ msg: "User already exists" }); // 409 Conflict
        }
        const hashedPassword = await bcrypt.hash(password, 5);
        //console.log(hashedPassword);
        await userModel.create({
            email: email,
            password: hashedPassword,
        })
    } catch (e) {
        console.log(e);
        res.json({
            msg: "user already exit"
        })
        error = true;
    }
    if (!error) {
        res.json({
            msg: "you are signup succesfully"
        })
    }
});
userRouter.post('/signin', async function (req, res) {
    const { email, password } = req.body;
    const response = await userModel.findOne({
        email: email,

    })
    if (!response) {
        res.status(404).json({
            msg: "user does not exist"
        })
    }

    const passwordmatch = await bcrypt.compare(password, response.password);

    if (passwordmatch) {
        const token = jwt.sign({
            id: response._id.toString(), email: response.email
        }, JWT_SECRET, { expiresIn: "1h" });
        res.json({
            token: token
        })



    }
    else {
        res.status(404).json({
            msg: "your credentials are wrong"
        })
    }
});
userRouter.get("/dashboard-data", usermiddleware, (req, res) => {
    res.json({ email: req.user.email, message: `Welcome ${req.user.email}`, data: "This is protected info" });
});

module.exports = {
    userRouter: userRouter
}