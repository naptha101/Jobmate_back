import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    // ... existing fields
    email:{
      type:String,
      required:true,
      unique:true
    },
    firstName: String,
        lastName: String,
    userType: { type: String, default: "client" },
    profileComplete: { type: Boolean, default: false },
    profilePicture: String,
   
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    linkedinId: {
      type: String,
      unique: true,
      sparse: true
    },
    profilePicture: {
      type: String
    },
    socialLogin: {
      type: Boolean,
      default: false
    }
  });
  export default mongoose.model("User5", UserSchema);