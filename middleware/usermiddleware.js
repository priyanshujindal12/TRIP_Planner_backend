    const jwt=require("jsonwebtoken");
    const {JWT_SECRET}=require("../config");
    const usermiddleware=(req, res, next)=>{
        const authheader=req.headers["authorization"];
        if(!authheader){
            return res.status(401).json({
                messege: "no token "
            })
        }
        const token=authheader.split(" ")[1];
        jwt.verify(token, JWT_SECRET, (err, decoded)=>{
            if(err){
                console.log(err);
                return res.status(403).json({messege: "expired token"})
            }
            console.log(decoded);
            req.user=decoded;
            next();

        });

    }
    module.exports=usermiddleware;