import express, { json } from "express"
import dotenv from "dotenv"
import { connectDb, sequelize } from "./config/db.js"
import {User} from './models.js/User.model.js'
import { TokenBlacklist } from "./models.js/TokenBlacklist.model.js";
import { Post } from "./models.js/post.model.js";
import "./models.js/associations.js";
import authRoutes from "./routes/authRoutes.js"
import postRoutes from "./routes/postRoutes.js";
import likeRoutes from "./routes/likeroutes.js";
import commentRoutes from "./routes/commentRoute.js";
import followRoutes from "./routes/followRoutes.js"
import messageRoutes from "./routes/messageRoutes.js";
import { connectRedis , redisClient } from "./config/redis.js";

import cors from "cors"
dotenv.config()

const app = express()


app.use(express.json());
app.use(cors())

const PORT = process.env.PORT || 5000

app.get("/health",(req,res)=>{
   res.json({
    message : "good health "
   })
})

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/message", messageRoutes);

const startServer = async () => {
  try {
    await connectDb();
    await connectRedis();
    await sequelize.sync()

    app.listen(PORT, () => {
      console.log(`Server started at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
