import mongoose from "mongoose";

export const connectDb = async () => {
  try {
    if (!process.env.URI) {
      throw new Error("Database URI is not defined in environment variables.");
    }
    
    await mongoose.connect(process.env.URI);
    console.log("Connected to the database successfully");
  } catch (err) {
    console.error("Error connecting to the database:", err);
    process.exit(1); // Exit the process on failure
  }
};
