
import { Comment } from "../models.js/comment.model.js";
import { Post } from "../models.js/Post.model.js";
import { User } from "../models.js/User.model.js";

export const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    // Logged-in user ID
    const userId = req.user.id;

    // Validate content
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    // Check whether post exists
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Create comment
    const comment = await Comment.create({
      content: content.trim(),
      userId,
      postId,
    });

    // Fetch comment with user details
    const result = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "profilePicture"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment: result,
    });

  } catch (error) {
    console.log("Create Comment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    // 1. Validate limit
    const limit = Number(req.query.limit) || 10;

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50",
      });
    }

    // 2. Get cursor
    const { cursor } = req.query;

    // 3. Create unique cache key
    const cacheKey = `comments:post:${postId}:limit:${limit}:cursor:${cursor || "first"}`;

    // 4. Check Redis
    const cachedComments = await redisClient.get(cacheKey);

    if (cachedComments) {
      console.log("Comments Cache HIT");

      return res.status(200).json({
        ...JSON.parse(cachedComments),
        message: "Comments fetched successfully (Redis)",
      });
    }

    console.log("Comments Cache MISS");

    // 5. Check post exists
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // 6. Base condition
    const where = {
      postId,
      parentId: null,
    };

    // 7. Decode cursor
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

      // 8. Cursor conditions
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

    // 9. Fetch comments
    const fetchedComments = await Comment.findAll({
      where,

      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "profilePicture"],
        },
        {
          model: Comment,
          as: "replies",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "profilePicture"],
            },
          ],
        },
      ],

      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],

      limit: limit + 1,
    });

    // 10. Check more comments
    const hasMore = fetchedComments.length > limit;

    // 11. Remove extra comment
    const comments = hasMore
      ? fetchedComments.slice(0, limit)
      : fetchedComments;

    // 12. Generate next cursor
    let nextCursor = null;

    if (hasMore && comments.length > 0) {
      const lastComment = comments[comments.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: lastComment.createdAt.toISOString(),
          id: lastComment.id,
        })
      ).toString("base64url");
    }

    // 13. Prepare response
    const responseData = {
      success: true,
      message: "Comments fetched successfully",
      totalComments: comments.length,
      hasMore,
      nextCursor,
      comments,
    };

    // 14. Save in Redis for 2 minutes
    await redisClient.setEx(
      cacheKey,
      120,
      JSON.stringify(responseData)
    );

    return res.status(200).json(responseData);

  } catch (error) {
    console.log("Get Post Comments Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const userId = req.user.id;

    // Validate content
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    // Find comment
    const comment = await Comment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check ownership
    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot update someone else's comment",
      });
    }

    // Update comment
    await comment.update({
      content: content.trim(),
    });

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      comment,
    });

  } catch (error) {
    console.log("Update Comment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const userId = req.user.id;

    // Find comment
    const comment = await Comment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check ownership
    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete someone else's comment",
      });
    }

    // Delete comment and its replies
    await Comment.destroy({
      where: {
        parentId: commentId,
      },
    });

    await comment.destroy();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });

  } catch (error) {
    console.log("Delete Comment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const replyToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const userId = req.user.id;

    // Validate content
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply content is required",
      });
    }

    // Find parent comment
    const parentComment = await Comment.findByPk(commentId);

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }

    // Create reply
    const reply = await Comment.create({
      content: content.trim(),
      userId,
      postId: parentComment.postId,
      parentId: parentComment.id,
    });

    // Fetch reply with user details
    const result = await Comment.findByPk(reply.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "profilePicture"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Reply added successfully",
      reply: result,
    });

  } catch (error) {
    console.log("Reply Comment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;

    // Check whether parent comment exists
    const parentComment = await Comment.findByPk(commentId);

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Fetch replies
    const replies = await Comment.findAll({
      where: {
        parentId: commentId,
      },

      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "profilePicture"],
        },
      ],

      order: [["createdAt", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      totalReplies: replies.length,
      replies: replies,
    });

  } catch (error) {
    console.log("Get Comment Replies Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

