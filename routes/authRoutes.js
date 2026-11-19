import express, { Router } from "express"
import { changePassword, getProfile, loginUser, logoutUser, registerUser, updateProfile } from "../controllers/authControllers.js"
import { authMiddleware } from "../middlewares/authMiddleware.js"

const router = express.Router()

router.post("/register", registerUser)
router.post("/login", loginUser)
router.post("/logout", authMiddleware ,logoutUser)
router.get("/profile", authMiddleware ,getProfile)
router.get("/update-profile", authMiddleware ,updateProfile)
router.put("/change-password", authMiddleware ,changePassword)


export default router

