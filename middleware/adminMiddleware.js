const adminMiddleware=(req, res, next)=>{
    if(!req.user.isAdmin){
        return res.status(403).json({message: "You are not authorized to access this resource"});
    }
    next(); //if the user is admin, then go to the next middleware
}
module.exports=adminMiddleware;