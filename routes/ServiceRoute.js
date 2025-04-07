import express from "express";
import Service from "../models/Service.js";
import Expert from "../models/Expert.js";
import User from "../models/User.js";
import { authenticateUser } from "../middleware/auth.js";
import mongoose from "mongoose";

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
    
    // Update expert's service count
    expert.serviceCount = (expert.serviceCount || 0) + 1;
    await expert.save();
    
    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all services (with enhanced filters)
router.get("/", async (req, res) => {
  try {
    const { 
      type, 
      minPrice, 
      maxPrice, 
      expertId, 
      topic, 
      meetingType, 
      sortBy,
      duration,
      availability,
      rating,
      searchTerm,
      page = 1,
      limit = 10
    } = req.query;
    
    let query = { isActive: true };
    
    // Basic filters
    if (type) query.type = type;
    if (expertId) query.expert = expertId;
    if (meetingType) query.meetingType = meetingType;
    
    // Topic filtering (can be multiple)
    if (topic) {
      if (Array.isArray(topic)) {
        query.topics = { $in: topic };
      } else {
        query.topics = { $in: [topic] };
      }
    }
    
    // Duration filtering
    if (duration) {
      const [minDuration, maxDuration] = duration.split('-').map(Number);
      query.duration = {};
      if (minDuration) query.duration.$gte = minDuration;
      if (maxDuration) query.duration.$lte = maxDuration;
    }
    
    // Price range filtering
    if (minPrice || maxPrice) {
      query["pricing.amount"] = {};
      if (minPrice) query["pricing.amount"].$gte = parseFloat(minPrice);
      if (maxPrice) query["pricing.amount"].$lte = parseFloat(maxPrice);
    }
    
    // Rating filtering
    if (rating) {
      query.rating = { $gte: parseFloat(rating) };
    }
    
    // Search term for name, description
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { topics: { $in: [new RegExp(searchTerm, 'i')] } }
      ];
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
    } else if (sortBy === "newest") {
      sort = { createdAt: -1 };
    } else if (sortBy === "duration_asc") {
      sort = { duration: 1 };
    } else if (sortBy === "duration_desc") {
      sort = { duration: -1 };
    } else {
      // Default sort by rating and then bookings
      sort = { rating: -1, bookings: -1 };
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination
    const total = await Service.countDocuments(query);
    
    const services = await Service.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: "expert",
        select: "title user specialties experience education rating totalReviews",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      });
    
    // Get review count information
    const servicesWithReviewCount = services.map(service => {
      const plainService = service.toObject();
      plainService.reviewCount = service.reviews.length;
      return plainService;
    });
    
    res.status(200).json({
      services: servicesWithReviewCount,
      pagination: {
        total,
        pages: Math.ceil(total / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get featured services
router.get("/featured", async (req, res) => {
  try {
    const featuredServices = await Service.find({
      isActive: true,
      visibility: "Public",
      $or: [
        { rating: { $gte: 4.5 } },
        { bookings: { $gte: 5 } }
      ]
    })
    .sort({ rating: -1, bookings: -1 })
    .limit(6)
    .populate({
      path: "expert",
      select: "title user rating",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture"
      }
    });
    
    res.status(200).json(featuredServices);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get recommended services based on user's interests or past bookings
router.get("/recommended", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // If user has interests or past bookings, recommend similar services
    let query = { 
      isActive: true,
      visibility: "Public"
    };
    
    // If user has interests, prioritize matching topics
    if (user.interests && user.interests.length > 0) {
      query.topics = { $in: user.interests };
    }
    
    const recommendations = await Service.find(query)
      .sort({ rating: -1, bookings: -1 })
      .limit(10)
      .populate({
        path: "expert",
        select: "title user rating",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      });
    
    res.status(200).json(recommendations);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get trending services (most booked in the last month)
router.get("/trending", async (req, res) => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const trendingServices = await Service.aggregate([
      {
        $match: {
          isActive: true,
          visibility: "Public",
          updatedAt: { $gte: oneMonthAgo }
        }
      },
      {
        $sort: { bookings: -1 }
      },
      {
        $limit: 8
      }
    ]);
    
    // Populate expert information
    const populatedServices = await Service.populate(trendingServices, {
      path: "expert",
      select: "title user rating",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture"
      }
    });
    
    res.status(200).json(populatedServices);
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
        select: "title user description specialties experience education rating totalReviews",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      })
      .populate({
        path: "reviews.user",
        select: "firstName lastName profilePicture"
      });
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Get similar services by the same expert or similar topics
    const similarServices = await Service.find({
      $and: [
        { _id: { $ne: service._id } },
        { isActive: true },
        { visibility: "Public" },
        {
          $or: [
            { expert: service.expert._id },
            { topics: { $in: service.topics } }
          ]
        }
      ]
    })
    .limit(4)
    .populate({
      path: "expert",
      select: "title user",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture"
      }
    });
    
    // Return both the service and similar services
    res.status(200).json({
      service,
      similarServices
    });
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
        select: "title user description specialties experience education rating totalReviews",
        populate: {
          path: "user",
          select: "firstName lastName profilePicture"
        }
      })
      .populate({
        path: "reviews.user",
        select: "firstName lastName profilePicture"
      });
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Get similar services by the same expert or similar topics
    const similarServices = await Service.find({
      $and: [
        { _id: { $ne: service._id } },
        { isActive: true },
        { visibility: "Public" },
        {
          $or: [
            { expert: service.expert._id },
            { topics: { $in: service.topics } }
          ]
        }
      ]
    })
    .limit(4)
    .populate({
      path: "expert",
      select: "title user",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture"
      }
    });
    
    // Return both the service and similar services
    res.status(200).json({
      service,
      similarServices
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all services for an expert
router.get("/expert/:expertId", async (req, res) => {
  try {
    const { visibilityFilter, activeOnly, sortBy } = req.query;
    
    // Build query based on parameters
    let query = { expert: req.params.expertId };
    
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    if (visibilityFilter) {
      query.visibility = visibilityFilter;
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

// Get services by topic
router.get("/topics/:topic", async (req, res) => {
  try {
    const services = await Service.find({
      topics: { $in: [req.params.topic] },
      isActive: true,
      visibility: "Public"
    })
    .sort({ rating: -1 })
    .limit(10)
    .populate({
      path: "expert",
      select: "title user rating",
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
    if (name !== undefined) serviceFields.name = name;
    if (description !== undefined) serviceFields.description = description;
    if (type !== undefined) serviceFields.type = type;
    if (pricing !== undefined) serviceFields.pricing = pricing;
    if (duration !== undefined) serviceFields.duration = duration;
    if (topics !== undefined) serviceFields.topics = topics;
    if (details !== undefined) serviceFields.details = details;
    if (meetingType !== undefined) serviceFields.meetingType = meetingType;
    if (capacity !== undefined) serviceFields.capacity = capacity;
    if (customQuestions !== undefined) serviceFields.customQuestions = customQuestions;
    if (visibility !== undefined) serviceFields.visibility = visibility;
    
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
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Toggle service active status
router.patch("/:id/toggle-status", authenticateUser, isServiceOwner, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    service.isActive = !service.isActive;
    await service.save();
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update service visibility
router.patch("/:id/visibility", authenticateUser, isServiceOwner, async (req, res) => {
  try {
    const { visibility } = req.body;
    
    if (!["Public", "Private", "Unlisted"].includes(visibility)) {
      return res.status(400).json({ message: "Invalid visibility option" });
    }
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { visibility },
      { new: true }
    );
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Increment booking count when a service is booked
router.patch("/:id/increment-bookings", authenticateUser, async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $inc: { bookings: 1 } },
      { new: true }
    );
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Also update expert's booking count
    await Expert.findByIdAndUpdate(
      service.expert,
      { $inc: { totalBookings: 1 } }
    );
    
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
    
    // Populate the user data for the new review
    const populatedService = await Service.findById(req.params.id)
      .populate({
        path: "reviews.user",
        select: "firstName lastName profilePicture"
      });
    
    res.status(201).json({ 
      message: "Review added", 
      service: populatedService 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a review
router.patch("/:serviceId/reviews/:reviewId", authenticateUser, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const service = await Service.findById(req.params.serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Find the review
    const reviewIndex = service.reviews.findIndex(
      review => review._id.toString() === req.params.reviewId && 
                review.user.toString() === req.user.id
    );
    
    if (reviewIndex === -1) {
      return res.status(404).json({ message: "Review not found or you're not authorized to update it" });
    }
    
    // Update the review
    if (rating !== undefined) service.reviews[reviewIndex].rating = Number(rating);
    if (comment !== undefined) service.reviews[reviewIndex].comment = comment;
    service.reviews[reviewIndex].date = Date.now();
    
    // Recalculate service rating
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
    await expert.save();
    
    res.status(200).json({ message: "Review updated", service });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a review
router.delete("/:serviceId/reviews/:reviewId", authenticateUser, async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Find the review
    const reviewIndex = service.reviews.findIndex(
      review => review._id.toString() === req.params.reviewId && 
                review.user.toString() === req.user.id
    );
    
    if (reviewIndex === -1) {
      return res.status(404).json({ message: "Review not found or you're not authorized to delete it" });
    }
    
    // Remove the review
    service.reviews.splice(reviewIndex, 1);
    
    // Recalculate service rating
    service.rating = service.reviews.length > 0 
      ? service.reviews.reduce((acc, item) => item.rating + acc, 0) / service.reviews.length
      : 0;
    
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
    
    expert.rating = totalReviews > 0 ? totalRatings / totalReviews : 0;
    expert.totalReviews = totalReviews;
    
    await expert.save();
    
    res.status(200).json({ message: "Review deleted", service });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all reviews for a service
router.get("/:id/reviews", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate({
        path: "reviews.user",
        select: "firstName lastName profilePicture"
      });
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Sort reviews by date (newest first)
    const sortedReviews = service.reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.status(200).json({
      reviews: sortedReviews,
      averageRating: service.rating,
      totalReviews: service.reviews.length
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get top-rated services
router.get("/discover/top-rated", async (req, res) => {
  try {
    const topRatedServices = await Service.find({
      isActive: true,
      visibility: "Public",
      rating: { $gte: 4 },
      "reviews.0": { $exists: true } // Has at least one review
    })
    .sort({ rating: -1 })
    .limit(10)
    .populate({
      path: "expert",
      select: "title user rating totalReviews",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture"
      }
    });
    
    res.status(200).json(topRatedServices);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get most affordable services
router.get("/discover/affordable", async (req, res) => {
  try {
    const affordableServices = await Service.find({
      isActive: true,
      visibility: "Public",
      "pricing.amount": { $lte: 50 }, // Services priced under $50
      rating: { $gte: 3.5 } // With decent ratings
    })
    .sort({ "pricing.amount": 1 })
    .limit(10)
    .populate({
      path: "expert",
      select: "title user rating",
      populate: {
        path: "user",
        select: "firstName lastName profilePicture"
      }
    });
    
    res.status(200).json(affordableServices);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Batch update services
router.post("/batch-update", authenticateUser, async (req, res) => {
  try {
    const { serviceIds, updateData } = req.body;
    
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ message: "No service IDs provided" });
    }
    
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No update data provided" });
    }
    
    // Verify user owns all these services
    for (const serviceId of serviceIds) {
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ message: `Service not found: ${serviceId}` });
      }
      
      const expert = await Expert.findById(service.expert);
      if (!expert || expert.user.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: `Access denied. You do not own service: ${serviceId}` 
        });
      }
    }
    
    // Perform batch update
    const updateResult = await Service.updateMany(
      { _id: { $in: serviceIds } },
      { $set: updateData }
    );
    
    res.status(200).json({ 
      message: "Services updated successfully", 
      updated: updateResult.modifiedCount 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete service
router.delete("/:id", authenticateUser, isServiceOwner, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    
    // Get expert before deleting service
    const expert = await Expert.findById(service.expert);
    
    await Service.findByIdAndDelete(req.params.id);
    
    // Update expert's service count and potentially ratings
    if (expert) {
      // Decrement service count
      expert.serviceCount = Math.max(0, (expert.serviceCount || 1) - 1);
      
      // Recalculate expert ratings if this service had reviews
      if (service.reviews && service.reviews.length > 0) {
        const remainingServices = await Service.find({ expert: expert._id });
        
        let totalRatings = 0;
        let totalReviews = 0;
        
        remainingServices.forEach(service => {
          totalRatings += service.rating * service.reviews.length;
          totalReviews += service.reviews.length;
        });
        
        expert.rating = totalReviews > 0 ? totalRatings / totalReviews : 0;
        expert.totalReviews = totalReviews;
      }
      
      await expert.save();
    }
    
    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router