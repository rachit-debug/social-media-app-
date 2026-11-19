import express from "express"
import { authMiddleware } from "../middlewares/authMiddleware.js"
import { createPost, deletePost, getAllPosts, getMyPosts, getSInglePost, updatePost } from "../controllers/postController.js"
import upload from "../middlewares/upload.js"

const router = express.Router()

router.post("/create",authMiddleware,upload.single("image"),createPost)
router.get("/all",authMiddleware,getAllPosts)
router.get("/:id", authMiddleware, getSInglePost);
router.get("/my-posts", authMiddleware, getMyPosts);
router.put("/:id",authMiddleware,upload.single("image"),updatePost);
router.delete("/:id", authMiddleware, deletePost);


export default router
