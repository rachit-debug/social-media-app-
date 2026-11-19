
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { likePost , checkLikeStatus, getPostLikes, unlikePost } from "../controllers/likecontroller.js";

const router = express.Router();

router.post("/:postId", authMiddleware, likePost);
router.delete("/:postId", authMiddleware, unlikePost);
router.get("/:postId", getPostLikes);
router.get("/:postId/status",authMiddleware,checkLikeStatus);

export default router;
