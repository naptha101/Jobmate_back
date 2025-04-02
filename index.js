const express=require("express")
const app=express()
const dotenv=require("dotenv")
const cors=require("cors")
dotenv.config();
const {connectDb}=require("./config/db")
const {passp} =require("./config/passport.config.js");
const { default: router } = require("./routes/GoogleAuth.js");

connectDb();
app.use(
    cors({
      origin: "*", // Allows requests from any origin
      
    })
  );
const port =process.env.PORT||4000
app.use(express.json());
app.use(passp.initialize());
app.use('/api/auth',router)
app.listen(port,()=>{
    console.log("server is running on port ",port)
})