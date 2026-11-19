import { Post } from "../models.js/post.model.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import cloudinary from "../config/cloudinary.js";
import { User } from "../models.js/User.model.js";
import { redisClient } from "../config/redis.js";

export const createPost = async (req, res) => {
  try {
    const { caption } = req.body;

    // Caption validation
    if (!caption || !caption.trim()) {
      return res.status(400).json({
        success: false,
        message: "Caption is required",
      });
    }

    // Image validation
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image not received. Please upload an image.",
      });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    const post = await Post.create({
      caption,
      image: result.secure_url,
      imagePublicId: result.public_id,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const getAllPosts = async (req, res) => {
  try {
    // 1. Get limit from query
    const limit = Number(req.query.limit) || 10;

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50",
      });
    }

    // 2. Get cursor
    const { cursor } = req.query;

    // 3. Unique cache key for each pagination request
    const cacheKey = `posts:all:limit:${limit}:cursor:${cursor || "first"}`;

    // 4. Check Redis
    const cachedPosts = await redisClient.get(cacheKey);

    if (cachedPosts) {
      console.log("All Posts Cache HIT");

      return res.status(200).json({
        ...JSON.parse(cachedPosts),
        message: "Posts fetched successfully (Redis)",
      });
    }

    console.log("All Posts Cache MISS");

    let where = {};

    // 5. Decode cursor
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

      // 6. Cursor pagination condition
      where = {
        [Op.or]: [
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
        ],
      };
    }

    // 7. Fetch posts from PostgreSQL
    const posts = await Post.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "profilePicture"],
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: limit + 1,
    });

    // 8. Check more posts
    const hasMore = posts.length > limit;

    // 9. Remove extra post
    const post = hasMore ? posts.slice(0, limit) : posts;

    // 10. Generate next cursor
    let nextCursor = null;

    if (hasMore && post.length > 0) {
      const lastPost = post[post.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: lastPost.createdAt.toISOString(),
          id: lastPost.id,
        })
      ).toString("base64url");
    }

    // 11. Prepare response
    const responseData = {
      success: true,
      message: "Posts fetched successfully",
      totalPosts: post.length,
      hasMore,
      nextCursor,
      post,
    };

    // 12. Save response in Redis for 2 minutes
    await redisClient.setEx(
      cacheKey,
      120,
      JSON.stringify(responseData)
    );

    return res.status(200).json(responseData);

  } catch (error) {
    console.log("Get All Posts Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




export const getSInglePost = async (req, res) => {
  try {
    const { id } = req.params;

    // Step 1: Redis cache key
    const cacheKey = `post:single:${id}`;

    // Step 2: Redis mein post check karo
    const cachedPost = await redisClient.get(cacheKey);

    // Step 3: Cache HIT
    if (cachedPost) {
      console.log("Single Post Cache HIT");

      return res.status(200).json({
        success: true,
        message: "Post fetched successfully (Redis)",
        post: JSON.parse(cachedPost),
      });
    }

    console.log("Single Post Cache MISS");

    // Step 4: Cache MISS - PostgreSQL se fetch
    const post = await Post.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "profilePicture"],
        },
      ],
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Step 5: Redis mein 5 minutes ke liye save
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify(post)
    );

    // Step 6: Response
    return res.status(200).json({
      success: true,
      message: "Post fetched successfully",
      post,
    });

  } catch (error) {
    console.log("Get Single Post Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const getMyPosts = async (req, res) => {
  try {
    // 1. Get logged-in user ID
    const userId = req.user.id;

    // 2. Get limit
    const limit = Number(req.query.limit) || 10;

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50",
      });
    }

    // 3. Get cursor
    const { cursor } = req.query;

    // 4. Create unique cache key
    const cacheKey = `posts:user:${userId}:limit:${limit}:cursor:${cursor || "first"}`;

    // 5. Check Redis
    const cachedPosts = await redisClient.get(cacheKey);

    if (cachedPosts) {
      console.log("My Posts Cache HIT");

      return res.status(200).json({
        ...JSON.parse(cachedPosts),
        message: "Your posts fetched successfully (Redis)",
      });
    }

    console.log("My Posts Cache MISS");

    let where = {
      userId,
    };

    // 6. Decode cursor
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

      // 7. Cursor condition
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

    // 8. Fetch posts from PostgreSQL
    const posts = await Post.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ["id", "name", "email", "profilePicture"],
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: limit + 1,
    });

    // 9. Check more posts
    const hasMore = posts.length > limit;

    // 10. Remove extra post
    const myPosts = hasMore
      ? posts.slice(0, limit)
      : posts;

    // 11. Generate next cursor
    let nextCursor = null;

    if (hasMore && myPosts.length > 0) {
      const lastPost = myPosts[myPosts.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: lastPost.createdAt.toISOString(),
          id: lastPost.id,
        })
      ).toString("base64url");
    }

    // 12. Prepare response
    const responseData = {
      success: true,
      message: "Your posts fetched successfully",
      totalPosts: myPosts.length,
      hasMore,
      nextCursor,
      posts: myPosts,
    };

    // 13. Store in Redis for 5 minutes
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify(responseData)
    );

    return res.status(200).json(responseData);

  } catch (error) {
    console.log("Get My Posts Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check post ownership
    if (post.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this post",
      });
    }

    // Update caption if provided
    if (caption !== undefined) {
      if (!caption.trim()) {
        return res.status(400).json({
          success: false,
          message: "Caption cannot be empty",
        });
      }

      post.caption = caption.trim();
    }

    // Update image if new image is uploaded
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);

      // Delete old image from Cloudinary
      if (post.imagePublicId) {
        await cloudinary.uploader.destroy(post.imagePublicId);
      }

      post.image = result.secure_url;
      post.imagePublicId = result.public_id;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post,
    });

  } catch (error) {
    console.log("Update Post Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check ownership
    if (post.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this post",
      });
    }

    // Delete image from Cloudinary
    if (post.imagePublicId) {
      await cloudinary.uploader.destroy(post.imagePublicId);
    }

    // Delete post from PostgreSQL
    await post.destroy();

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });

  } catch (error) {
    console.log("Delete Post Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
