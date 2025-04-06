import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User5",
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ["Mentorship", "Consultation", "Training", "Meeting", "Workshop", "Other"]
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: "USD"
  },
  duration: {
    type: Number,  // duration in minutes
    required: true
  },
  availability: [{
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true
    },
    slots: [{
      startTime: {
        type: String,  // Format: "HH:MM" in 24-hour format
        required: true
      },
      endTime: {
        type: String,  // Format: "HH:MM" in 24-hour format
        required: true
      },
      isBooked: {
        type: Boolean,
        default: false
      }
    }]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  maxParticipants: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model("Service", ServiceSchema);