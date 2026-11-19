
import { Follow } from "../models.js/Follow.model.js";
import { User } from "../models.js/User.model.js";

export const followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = Number(req.params.userId);

    // Validate user ID
    if (!followingId || !Number.isInteger(followingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // User cannot follow himself
    if (followerId === followingId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself",
      });
    }

    // Check whether target user exists
    const targetUser = await User.findByPk(followingId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check whether already following
    const existingFollow = await Follow.findOne({
      where: {
        followerId,
        followingId,
      },
    });

    if (existingFollow) {
      return res.status(409).json({
        success: false,
        message: "You are already following this user",
      });
    }

    // Create follow record
    const follow = await Follow.create({
      followerId,
      followingId,
    });

    return res.status(201).json({
      success: true,
      message: "User followed successfully",
      data: follow,
    });

  } catch (error) {
    console.error("Follow User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = Number(req.params.userId);

    // Validate user ID
    if (!followingId || !Number.isInteger(followingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Cannot unfollow yourself
    if (followerId === followingId) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation",
      });
    }

    // Check whether follow relationship exists
    const existingFollow = await Follow.findOne({
      where: {
        followerId,
        followingId,
      },
    });

    if (!existingFollow) {
      return res.status(404).json({
        success: false,
        message: "You are not following this user",
      });
    }

    // Delete follow record
    await existingFollow.destroy();

    return res.status(200).json({
      success: true,
      message: "User unfollowed successfully",
    });

  } catch (error) {
    console.error("Unfollow User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};




export const getFollowers = async (req, res) => {
  try {
    // 1. Validate user ID
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

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

    // 4. Create cache key
    const cacheKey = `followers:user:${userId}:limit:${limit}:cursor:${cursor || "first"}`;

    // 5. Check Redis
    const cachedFollowers = await redisClient.get(cacheKey);

    if (cachedFollowers) {
      console.log("Followers Cache HIT");

      return res.status(200).json({
        ...JSON.parse(cachedFollowers),
        message: "Followers fetched successfully (Redis)",
      });
    }

    console.log("Followers Cache MISS");

    // 6. Check user exists
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 7. Base condition
    const where = {
      followingId: userId,
    };

    // 8. Decode cursor
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

      // 9. Cursor condition
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

    // 10. Fetch followers
    const fetchedFollowers = await Follow.findAll({
      where,

      include: [
        {
          model: User,
          as: "follower",
          attributes: ["id", "name", "profilePicture"],
        },
      ],

      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],

      limit: limit + 1,
    });

    // 11. Check more followers
    const hasMore = fetchedFollowers.length > limit;

    // 12. Remove extra record
    const followers = hasMore
      ? fetchedFollowers.slice(0, limit)
      : fetchedFollowers;

    // 13. Generate next cursor
    let nextCursor = null;

    if (hasMore && followers.length > 0) {
      const lastFollower = followers[followers.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: lastFollower.createdAt.toISOString(),
          id: lastFollower.id,
        })
      ).toString("base64url");
    }

    // 14. Prepare response
    const responseData = {
      success: true,
      message: "Followers fetched successfully",
      totalFollowers: followers.length,
      hasMore,
      nextCursor,
      data: followers,
    };

    // 15. Save in Redis for 5 minutes
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify(responseData)
    );

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("Get Followers Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





export const getFollowing = async (req, res) => {
  try {
    // 1. Validate user ID
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

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
    const cacheKey = `following:user:${userId}:limit:${limit}:cursor:${cursor || "first"}`;

    // 5. Check Redis
    const cachedFollowing = await redisClient.get(cacheKey);

    if (cachedFollowing) {
      console.log("Following Cache HIT");

      return res.status(200).json({
        ...JSON.parse(cachedFollowing),
        message: "Following list fetched successfully (Redis)",
      });
    }

    console.log("Following Cache MISS");

    // 6. Check user exists
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 7. Base condition
    const where = {
      followerId: userId,
    };

    // 8. Decode cursor
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

      // 9. Cursor condition
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

    // 10. Fetch following list
    const fetchedFollowing = await Follow.findAll({
      where,

      include: [
        {
          model: User,
          as: "following",
          attributes: ["id", "name", "email", "profilePicture"],
        },
      ],

      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],

      limit: limit + 1,
    });

    // 11. Check more records
    const hasMore = fetchedFollowing.length > limit;

    // 12. Remove extra record
    const following = hasMore
      ? fetchedFollowing.slice(0, limit)
      : fetchedFollowing;

    // 13. Generate next cursor
    let nextCursor = null;

    if (hasMore && following.length > 0) {
      const lastFollowing = following[following.length - 1];

      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: lastFollowing.createdAt.toISOString(),
          id: lastFollowing.id,
        })
      ).toString("base64url");
    }

    // 14. Prepare response
    const responseData = {
      success: true,
      message: "Following list fetched successfully",
      totalFollowing: following.length,
      hasMore,
      nextCursor,
      following,
    };

    // 15. Save in Redis for 5 minutes
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify(responseData)
    );

    return res.status(200).json(responseData);

  } catch (error) {
    console.log("Get Following Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    const follow = await Follow.findOne({
      where: {
        followerId,
        followingId: userId,
      },
    });

    return res.status(200).json({
      success: true,
      isFollowing: !!follow,
      message: follow
        ? "You are following this user"
        : "You are not following this user",
    });
  } catch (error) {
    console.log("Check Follow Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
