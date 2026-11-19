
import express from "express";
import { checkFollowStatus, followUser, getFollowers, getFollowing, unfollowUser } from "../controllers/followController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/:userId", authMiddleware, followUser);
router.delete("/:userId", authMiddleware, unfollowUser);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);
router.get("/:userId/status", authMiddleware, checkFollowStatus);

export default router;
