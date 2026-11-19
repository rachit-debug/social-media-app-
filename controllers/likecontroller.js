import { Like } from "../models.js/like.model.js"
import { Post } from "../models.js/post.model.js"

export const likePost = async (req,res) => {
 try{

  const {postId} = req.params

  const userId = req.userId

  const post = await Post.findByPk(userId)

   if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

   const existingLike = await Like.findOne({
    where : {
      userId,
      postId
    }
   })

   if (existingLike) {
      return res.status(400).json({
        success: false,
        message: "You have already liked this post",
      });
    }

    const newLike = await Like.create({
       userId,
      postId,
    })

    return res.status(201).json({
      success: true,
      message: "Post liked successfully",
      like: newLike,
    });



 }catch (error) {
    console.log("Like Post Error:", error);

    // Handle duplicate like at database level
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "You have already liked this post",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}



export const unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check post exists
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Find user's like
    const existingLike = await Like.findOne({
      where: {
        userId,
        postId,
      },
    });

    if (!existingLike) {
      return res.status(404).json({
        success: false,
        message: "You have not liked this post",
      });
    }

    // Delete like
    await existingLike.destroy();

    return res.status(200).json({
      success: true,
      message: "Post unliked successfully",
    });

  } catch (error) {
    console.log("Unlike Post Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getPostLikes = async (req, res) => {
  try {
    const { postId } = req.params;

    const likes = await Like.findAll({
      where: {
        postId: postId,
      },
      include: [
        {
          model: User,
          attributes: ["id", "name", "profilePicture"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      totalLikes: likes.length,
      likes: likes,
    });

  } catch (error) {
    console.log("Get Post Likes Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const checkLikeStatus = async (req, res) => {
  try {
    const { postId } = req.params;

    // Logged-in user ki ID
    const userId = req.user.id;

    // Check whether user liked this post
    const like = await Like.findOne({
      where: {
        postId: postId,
        userId: userId,
      },
    });

    return res.status(200).json({
      success: true,
      isLiked: !!like,
      message: like
        ? "You have liked this post"
        : "You have not liked this post",
    });

  } catch (error) {
    console.log("Check Like Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

