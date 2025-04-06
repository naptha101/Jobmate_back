import express from "express";
import Expert from "../models/Expert.js";
import User from "../models/User5.js";
import { authenticateUser } from "../middleware/auth.js";

const router = express.Router();

// Middleware to check if user is an expert
const isExpertOwner = async (req, res, next) => {
  try {
    const expert = await Expert.findById(req.params.id || req.params.expertId);
    
    if (!expert) {
      return res.status(404).json({ message: "Expert profile not found" });
    }
    
    if (expert.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create expert profile
router.post("/", authenticateUser, async (req, res) => {
  try {
    // Check if expert profile already exists for this user
    let expertProfile = await Expert.findOne({ user: req.user.id });
    
    if (expertProfile) {
      return res.status(400).json({ message: "Expert profile already exists for this user" });
    }
    
    // Check if user exists and update user type
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Update user type to expert
    user.userType = "expert";
    await user.save();
    
    // Create new expert profile
    const {
      title,
      bio,
      expertise,
      experience,
      education,
      socialLinks,
      hourlyRate,
      currency,
      availability,
      languages
    } = req.body;
    
    expertProfile = new Expert({
      user: req.user.id,
      title,
      bio,
      expertise,
      experience,
      education,
      socialLinks,
      hourlyRate,
      currency,
      availability,
      languages
    });
    
    await expertProfile.save();
    
    res.status(201).json(expertProfile);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all experts
router.get("/", async (req, res) => {
  try {
    const { expertise, language, rating, sortBy } = req.query;
    
    let query = { isActive: true };
    
    // Apply filters
    if (expertise) {
      query.expertise = { $in: [expertise] };
    }
    
    if (language) {
      query.languages = { $in: [language] };
    }
    
    if (rating) {
      query.rating = { $gte: parseFloat(rating) };
    }
    
    // Sort options
    let sort = {};
    if (sortBy === "rating") {
      sort = { rating: -1 };
    } else if (sortBy === "sessions") {
      sort = { completedSessions: -1 };
    } else {
      sort = { createdAt: -1 };
    }
    
    const experts = await Expert.find(query)
      .sort(sort)
      .populate("user", "firstName lastName email profilePicture");
      
    res.status(200).json(experts);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get expert by ID
router.get("/:id", async (req, res) => {
  try {
    const expert = await Expert.findById(req.params.id)
      .populate("user", "firstName lastName email profilePicture");
      
    if (!expert) {
      return res.status(404).json({ message: "Expert not found" });
    }
    
    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get expert profile by user ID
router.get("/user/:userId", async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.params.userId })
      .populate("user", "firstName lastName email profilePicture");
      
    if (!expert) {
      return res.status(404).json({ message: "Expert profile not found" });
    }
    
    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update expert profile
router.put("/:id", authenticateUser, isExpertOwner, async (req, res) => {
  try {
    const {
      title,
      bio,
      expertise,
      experience,
      education,
      socialLinks,
      hourlyRate,
      currency,
      availability,
      languages
    } = req.body;
    
    const expertFields = {};
    if (title) expertFields.title = title;
    if (bio) expertFields.bio = bio;
    if (expertise) expertFields.expertise = expertise;
    if (experience) expertFields.experience = experience;
    if (education) expertFields.education = education;
    if (socialLinks) expertFields.socialLinks = socialLinks;
    if (hourlyRate) expertFields.hourlyRate = hourlyRate;
    if (currency) expertFields.currency = currency;
    if (availability) expertFields.availability = availability;
    if (languages) expertFields.languages = languages;
    
    const expert = await Expert.findByIdAndUpdate(
      req.params.id,
      { $set: expertFields },
      { new: true }
    );
    
    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update expertise
router.patch("/:id/expertise", authenticateUser, isExpertOwner, async (req, res) => {
  try {
    const { expertise } = req.body;
    
    const expert = await Expert.findByIdAndUpdate(
      req.params.id,
      { $set: { expertise } },
      { new: true }
    );
    
    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update availability
router.patch("/:id/availability", authenticateUser, isExpertOwner, async (req, res) => {
  try {
    const { availability } = req.body;
    
    const expert = await Expert.findByIdAndUpdate(
      req.params.id,
      { $set: { availability } },
      { new: true }
    );
    
    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Toggle active status
router.patch("/:id/toggle-status", authenticateUser, isExpertOwner, async (req, res) => {
  try {
    const expert = await Expert.findById(req.params.id);
    
    expert.isActive = !expert.isActive;
    await expert.save();
    
    res.status(200).json(expert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete expert profile
router.delete("/:id", authenticateUser, isExpertOwner, async (req, res) => {
  try {
    // Find and delete the expert profile
    await Expert.findByIdAndDelete(req.params.id);
    
    // Update the user type back to client
    await User.findByIdAndUpdate(req.user.id, { $set: { userType: "client" } });
    
    res.status(200).json({ message: "Expert profile deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;