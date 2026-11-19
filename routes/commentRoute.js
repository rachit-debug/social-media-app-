import express from "express";
import { createComment, deleteComment, getCommentReplies, getPostComments, replyToComment, updateComment } from "../controllers/commentController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/:postId", authMiddleware, createComment);
router.get("/:postId", getPostComments);
router.put("/:commentId", authMiddleware, updateComment);
router.delete("/:commentId", authMiddleware, deleteComment);
router.post("/:commentId/reply",authMiddleware,replyToComment);
router.get("/:commentId/replies", getCommentReplies);

export default router;
