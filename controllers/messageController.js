import { Op } from "sequelize";
import { Message } from "../models.js/Message.model.js";
import { Conversation } from "../models.js/Conversation.model.js";
import { User } from "../models.js/User.model.js";

export const createConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    const currentUserId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (Number(userId) === Number(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot create conversation with yourself",
      });
    }

    const userOneId = Math.min(currentUserId, Number(userId));
    const userTwoId = Math.max(currentUserId, Number(userId));

    let conversation = await Conversation.findOne({
      where: {
        userOneId,
        userTwoId,
      },
    });

    if (conversation) {
      return res.status(200).json({
        success: true,
        message: "Conversation already exists",
        conversation,
      });
    }

    conversation = await Conversation.create({
      userOneId,
      userTwoId,
    });

    return res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      conversation,
    });

  } catch (error) {
    console.log("Create Conversation Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, image } = req.body;

    const senderId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    if (!content?.trim() && !image) {
      return res.status(400).json({
        success: false,
        message: "Message content or image is required",
      });
    }

    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (
      conversation.userOneId !== senderId &&
      conversation.userTwoId !== senderId
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation",
      });
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content: content?.trim() || null,
      image: image || null,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });

  } catch (error) {
    console.log("Send Message Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getAllConversations = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Limit validation
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 10, 1),
      50
    );

    // 2. Base query: current user's conversations
    const where = {
      [Op.and]: [
        {
          [Op.or]: [
            { userOneId: currentUserId },
            { userTwoId: currentUserId },
          ],
        },
      ],
    };

    // 3. Decode cursor
    if (req.query.cursor) {
      let cursorData;

      try {
        cursorData = JSON.parse(
          Buffer.from(req.query.cursor, "base64url").toString("utf-8")
        );
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor",
        });
      }

      const cursorDate = new Date(cursorData.updatedAt);
      const cursorId = Number(cursorData.id);

      if (
        !cursorData.updatedAt ||
        Number.isNaN(cursorDate.getTime()) ||
        !Number.isInteger(cursorId) ||
        cursorId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor",
        });
      }

      // 4. Fetch conversations older than cursor
      where[Op.and].push({
        [Op.or]: [
          {
            updatedAt: {
              [Op.lt]: cursorDate,
            },
          },
          {
            updatedAt: cursorDate,
            id: {
              [Op.lt]: cursorId,
            },
          },
        ],
      });
    }

    // 5. Fetch limit + 1 conversations
    const conversations = await Conversation.findAll({
      where,

      include: [
        {
          model: Message,
          as: "messages",
          limit: 1,
          separate: true,
          order: [["createdAt", "DESC"]],
        },
      ],

      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],

      limit: limit + 1,
    });

    // 6. Check whether more conversations exist
    const hasMore = conversations.length > limit;

    // Remove extra conversation
    if (hasMore) {
      conversations.pop();
    }

    // 7. Generate next cursor
    let nextCursor = null;

    if (hasMore && conversations.length > 0) {
      const lastConversation = conversations[conversations.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          updatedAt: lastConversation.updatedAt,
          id: lastConversation.id,
        })
      ).toString("base64url");
    }

    // 8. Response
    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      totalConversations: conversations.length,
      hasMore,
      nextCursor,
      conversations,
    });

  } catch (error) {
    console.log("Get All Conversations Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.id;

    // 1. Check conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // 2. Check user authorization
    if (
      Number(conversation.userOneId) !== Number(currentUserId) &&
      Number(conversation.userTwoId) !== Number(currentUserId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation",
      });
    }

    // 3. Get limit
    const limit = Number(req.query.limit) || 20;

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50",
      });
    }

    // 4. Base condition
    const where = {
      conversationId,
    };

    // 5. Get cursor
    const { cursor } = req.query;

    if (cursor) {
      let decodedCursor;

      try {
        decodedCursor = JSON.parse(
          Buffer.from(cursor, "base64url").toString("utf-8")
        );
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor",
        });
      }

      const cursorDate = new Date(decodedCursor.createdAt);
      const cursorId = Number(decodedCursor.id);

      if (
        !Number.isFinite(cursorDate.getTime()) ||
        !Number.isInteger(cursorId) ||
        cursorId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor values",
        });
      }

      // 6. Fetch messages older than cursor
      where[Op.or] = [
        {
          createdAt: {
            [Op.lt]: cursorDate,
          },
        },
        {
          createdAt: cursorDate,
          id: {
            [Op.lt]: cursorId,
          },
        },
      ];
    }

    // 7. Fetch latest messages first
    const fetchedMessages = await Message.findAll({
      where,

      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],

      limit: limit + 1,
    });

    // 8. Check more messages
    const hasMore = fetchedMessages.length > limit;

    // 9. Remove extra message
    const pageMessages = hasMore
      ? fetchedMessages.slice(0, limit)
      : fetchedMessages;

    // 10. Generate cursor from oldest message
    let nextCursor = null;

    if (hasMore && pageMessages.length > 0) {
      const oldestMessage = pageMessages[pageMessages.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: oldestMessage.createdAt.toISOString(),
          id: oldestMessage.id,
        })
      ).toString("base64url");
    }

    // 11. Reverse for chat display
    const messages = pageMessages.reverse();

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      totalMessages: messages.length,
      hasMore,
      nextCursor,
      messages,
    });

  } catch (error) {
    console.log("Get Messages Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findByPk(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (
      conversation.userOneId !== currentUserId &&
      conversation.userTwoId !== currentUserId
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation",
      });
    }

    const [updatedCount] = await Message.update(
      {
        isRead: true,
      },
      {
        where: {
          conversationId,
          senderId: {
            [Op.ne]: currentUserId,
          },
          isRead: false,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Messages marked as read successfully",
      updatedMessages: updatedCount,
    });

  } catch (error) {
    console.log("Mark Messages Read Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await Message.findByPk(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages",
      });
    }

    await message.destroy();

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });

  } catch (error) {
    console.log("Delete Message Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    const currentUserId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const message = await Message.findByPk(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages",
      });
    }

    message.content = content.trim();

    await message.save();

    return res.status(200).json({
      success: true,
      message: "Message updated successfully",
      data: message,
    });

  } catch (error) {
    console.log("Edit Message Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getUnreadMessagesCount = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const unreadCount = await Message.count({
      where: {
        isRead: false,
        senderId: {
          [Op.ne]: currentUserId,
        },
      },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: {
            [Op.or]: [
              { userOneId: currentUserId },
              { userTwoId: currentUserId },
            ],
          },
          attributes: [],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      unreadMessages: unreadCount,
    });

  } catch (error) {
    console.log("Unread Messages Count Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user.id;

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: Message,
          as: "messages",
          limit: 1,
          separate: true,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (
      conversation.userOneId !== currentUserId &&
      conversation.userTwoId !== currentUserId
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation",
      });
    }

    const otherUserId =
      conversation.userOneId === currentUserId
        ? conversation.userTwoId
        : conversation.userOneId;

    const otherUser = await User.findByPk(otherUserId, {
      attributes: ["id", "name", "profilePicture"],
    });

    return res.status(200).json({
      success: true,
      message: "Conversation details fetched successfully",
      conversation: {
        id: conversation.id,
        otherUser,
        lastMessage: conversation.messages[0] || null,
        createdAt: conversation.createdAt,
      },
    });

  } catch (error) {
    console.log("Get Conversation Details Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
