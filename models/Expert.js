import mongoose from "mongoose";

const ExpertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User5",
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  bio: {
    type: String,
    required: true
  },
  expertise: [{
    type: String,
    required: true
  }],
  experience: [{
    position: {
      type: String,
      required: true
    },
    company: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    current: {
      type: Boolean,
      default: false
    },
    description: {
      type: String
    }
  }],
  education: [{
    institution: {
      type: String
    },
    degree: {
      type: String
    },
    field: {
      type: String
    },
    from: {
      type: Date
    },
    to: {
      type: Date
    }
  }],
  socialLinks: {
    linkedin: {
      type: String
    },
    twitter: {
      type: String
    },
    github: {
      type: String
    },
    website: {
      type: String
    }
  },
  hourlyRate: {
    type: Number
  },
  currency: {
    type: String,
    default: "USD"
  },
  availability: {
    timeZone: {
      type: String,
      default: "UTC"
    },
    weeklySchedule: [{
      day: {
        type: String,
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      },
      available: {
        type: Boolean,
        default: true
      },
      slots: [{
        startTime: String, // Format: "HH:MM"
        endTime: String    // Format: "HH:MM"
      }]
    }]
  },
  languages: [{
    type: String
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featuredExpert: {
    type: Boolean,
    default: false
  },
  completedSessions: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model("Expert", ExpertSchema);