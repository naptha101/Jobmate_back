import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema({
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Expert",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["OneOnOne", "Group", "Course", "Workshop", "Review", "QnA", "Mentorship"],
    required: true
  },
  pricing: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: "USD"
    },
    billingType: {
      type: String,
      enum: ["Fixed", "Hourly"],
      default: "Fixed"
    }
  },
  duration: {
    type: Number,  // Duration in minutes
    required: true
  },
  topics: [{
    type: String
  }],
  details: {
    structure: {
      type: String
    },
    prerequisites: {
      type: String
    },
    deliverables: {
      type: String
    }
  },
  meetingType: {
    type: String,
    enum: ["Video", "Phone", "InPerson", "Chat"],
    default: "Video"
  },
  capacity: {
    type: Number,
    default: 1
  },
  customQuestions: [{
    question: {
      type: String
    },
    required: {
      type: Boolean,
      default: false
    }
  }],
  visibility: {
    type: String,
    enum: ["Public", "Private", "Unlisted"],
    default: "Public"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  slug: {
    type: String,
    unique: true
  },
  bookings: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User5"
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

// Generate a slug before saving
ServiceSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-') + 
      '-' + Math.floor(Math.random() * 1000);
  }
  next();
});

export default mongoose.model("Service", ServiceSchema);