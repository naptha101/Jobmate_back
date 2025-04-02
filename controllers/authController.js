import User from "../models/User.js";
import jwt from "jsonwebtoken";
import  bcrypt from 'bcrypt'
export const handleAuthSuccess = (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${req.user.token}`);
  };
  export const protect = async (req, res, next) => {
    try {
         let token;
         
         // Get token from Authorization header
         if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
           token = req.headers.authorization.split(" ")[1];
         }
         
         if (!token) {
           return res.status(401).json({ message: "Not authorized, no token" });
         }
         
         // Verify token
         const decoded = jwt.verify(token, process.env.JWT_SECRET);
         
         // Find user by id
         const user = await User.findById(decoded.id);
         
         if (!user) {
           return res.status(401).json({ message: "User not found" });
         }
         
         // Attach user to request object
         req.user = user;
         next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  }; 
  export const Register=async (req, res) => {
    try{
    const { email, password, firstName, lastName, userType } = req.body;
  
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      userType: userType || "client", // Use provided userType or default to "client"
      profileComplete: false,
      socialLogin: false
    });


    const savedUser = await newUser.save();

    
    const token = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, { expiresIn: "3d" });
    
    const userToReturn = {
      _id: savedUser._id,
      email: savedUser.email,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      userType: savedUser.userType,
      profileComplete: savedUser.profileComplete
    };

    res.status(201).json({
      message: "User registered successfully",
      user: userToReturn,
      token
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
  }