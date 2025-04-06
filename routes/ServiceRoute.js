import express from "express";
import Service from "../models/Service.js";
import Expert from "../models/Expert.js";
import { authenticateUser } from "../middleware/auth.js";

const router = express.Router();

// Middleware to check if user owns the expert profile related to this service
const isServiceOwner = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    const expert = await Expert.findById(service.expert);
    
    if (!expert) {
      return res.status(404).json({ message: "Expert not found" });
    }
    
    if (expert.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied. You do not own this service" });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new service
router.post("/", authenticateUser, async (req, res) => {
  try {
    // Check if user has an expert profile
    const expert = await Expert.findOne({ user: req.user.id });
    
    if (!expert) {
      return res.status(404).json({ message: "Expert profile not found. Create an expert profile first" });
    }
    
    const {
      name,
      description,
      type,
      pricing,
      duration,
      topics,
      details,
      meetingType,
      capacity,
      customQuestions,
      visibility
    } = req.body;
    
    const newService = new Service({
      expert: expert._id,
      name,
      description,
      type,
      pricing,
      duration,
      topics,
      details,
      meetingType,
      capacity,
      customQuestions,
      visibility
    });
    
    await newService.save();
    
    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all services (with filters)
router.get("/", async (req, res) => {
  try {
    const { 
      type, 
      minPrice, 
      maxPrice, 
      expertId, 
      topic, 
      meetingType, 
      sortBy 
    } = req.query;
    
    let query = { isActive: true };
    
    if (type) query.type = type;
    if (expertId) query.expert = expertId;
    if (topic) query.topics = { $in: [topic] };
    if (meetingType) query.meetingType = meetingType;
    
    if (minPrice || maxPrice) {
      query["pricing.amount"] = {};
      if (minPrice) query["pricing.amount"].$gte = parseFloat(minPrice);
      if (maxPrice) query["pricing.amount"].$lte = parseFloat(maxPrice);
    }
    
    // Exclude private services unless specifically requested by expert ID
    if (!expertId) {
      query.visibility = { $ne: "Private" };
    }
    
    // Sort options
    let sort = {};
    if (sortBy === "price_asc") {
      sort = { "pricing.amount": 1 };
    } else if (sortBy === "price_desc") {
      sort = { "pricing.amount": -1 };
    } else if (sortBy === "rating") {
      sort = { rating: -1 };
    } else if (sortBy === "popularity") {
      sort = { bookings: -1 };
    } else {
      sort = { createdAt: -1 };
    }
    
    const services = await Service.find(query)
      .sort(sort)
      .populate({
        path: "expert",
        select: "title user",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      });
    
    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get service by ID
router.get("/:id", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate({
        path: "expert",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      });
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get service by slug
router.get("/slug/:slug", async (req, res) => {
  try {
    const service = await Service.findOne({ slug: req.params.slug })
      .populate({
        path: "expert",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      });
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all services for an expert
router.get("/expert/:expertId", async (req, res) => {
  try {
    const services = await Service.find({ 
      expert: req.params.expertId,
      isActive: true
    });
    
    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update service
router.put("/:id", authenticateUser, isServiceOwner, async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      pricing,
      duration,
      topics,
      details,
      meetingType,
      capacity,
      customQuestions,
      visibility
    } = req.body;
    
    const serviceFields = {};
    if (name) serviceFields.name = name;
    if (description) serviceFields.description = description;
    if (type) serviceFields.type = type;
    if (pricing) serviceFields.pricing = pricing;
    if (duration) serviceFields.duration = duration;
    if (topics) serviceFields.topics = topics;
    if (details) serviceFields.details = details;
    if (meetingType) serviceFields.meetingType = meetingType;
    if (capacity) serviceFields.capacity = capacity;
    if (customQuestions) serviceFields.customQuestions = customQuestions;
    if (visibility) serviceFields.visibility = visibility;
    
    // If name is updated, regenerate the slug
    if (name) {
      serviceFields.slug = name
        .toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-') + 
        '-' + Math.floor(Math.random() * 1000);
    }
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: serviceFields },
      { new: true }
    );
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Toggle service active status
router.patch("/:id/toggle-status", authenticateUser, isServiceOwner, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    service.isActive = !service.isActive;
    await service.save();
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add review to a service
router.post("/:id/reviews", authenticateUser, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Check if user has already reviewed
    const alreadyReviewed = service.reviews.find(
      review => review.user.toString() === req.user.id
    );
    
    if (alreadyReviewed) {
      return res.status(400).json({ message: "Service already reviewed" });
    }
    
    const review = {
      user: req.user.id,
      rating: Number(rating),
      comment
    };
    
    service.reviews.push(review);
    
    // Update service rating
    service.rating = service.reviews.reduce((acc, item) => item.rating + acc, 0) / 
                     service.reviews.length;
    
    await service.save();
    
    // Update expert's rating
    const expert = await Expert.findById(service.expert);
    const allExpertServices = await Service.find({ expert: service.expert });
    
    const totalRatings = allExpertServices.reduce((acc, service) => {
      return acc + (service.rating * service.reviews.length);
    }, 0);
    
    const totalReviews = allExpertServices.reduce((acc, service) => {
      return acc + service.reviews.length;
    }, 0);
    
    expert.rating = totalRatings / totalReviews;
    expert.totalReviews = totalReviews;
    
    await expert.save();
    
    res.status(201).json({ message: "Review added", service });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete service
router.delete("/:id", authenticateUser, isServiceOwner, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;