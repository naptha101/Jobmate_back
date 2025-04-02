import express from "express";
import passport from "passport";
import { handleAuthSuccess, protect, Register } from "../controllers/authController.js";

const router = express.Router();

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), handleAuthSuccess);

// LinkedIn OAuth
router.get("/linkedin", passport.authenticate("linkedin", { scope: ["r_emailaddress", "r_liteprofile"] }));
router.get("/linkedin/callback", passport.authenticate("linkedin", { session: false }), handleAuthSuccess);
router.get('/protect',protect,(req,res)=>{
    if(req.user){
        return res.status(200).send(req.user)
    }
    return res.status(404).send({})


})
router.post("/register",Register);
  
  /**
   * @route POST /api/auth/signout
   * @desc Sign out a user (invalidate token)
   * @access Private
   */
  router.post("/signout", (req, res) => {
    try {
    
      res.status(200).json({ message: "Signed out successfully" });
    } catch (error) {
      console.error("Signout error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
export default router;
