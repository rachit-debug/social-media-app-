import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { createConversation, deleteMessage, editMessage, getAllConversations, getConversationDetails, getMessages, getUnreadMessagesCount, markMessagesAsRead, sendMessage } from "../controllers/messageController.js";


const router = express.Router();

router.post("/conversation", authMiddleware, createConversation);
router.post("/send", authMiddleware, sendMessage);
router.get("/conversations", authMiddleware, getAllConversations);
router.get("/:conversationId/messages",authMiddleware,getMessages);
router.put("/:conversationId/read",authMiddleware,markMessagesAsRead);
router.delete("/:messageId", authMiddleware, deleteMessage);
router.put("/:messageId", authMiddleware, editMessage);
router.get("/unread/count", authMiddleware, getUnreadMessagesCount);
router.get("/conversation/:conversationId",authMiddleware,getConversationDetails);

export default router;
