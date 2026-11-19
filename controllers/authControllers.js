import { User } from "../models.js/User.model.js";
import { TokenBlacklist } from "../models.js/TokenBlacklist.model.js";
import { redisClient } from "../config/redis.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "all fields are required",
      });
    }

    const existUser = await User.findOne({
      where: { email },
    });

    if (existUser) {
      return res.status(409).json({
        success: false,
        message: "User already exits",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 8);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: safeUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "internal server error",
      success: false,
      error: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if ((!email || !password)) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "internal server error",
      success: false,
      error: error.message,
    });
  }
};


export const logoutUser = async (req, res) => {
  try {

    const decoded = jwt.decode(req.token);

    await TokenBlacklist.create({
      tokenHash: req.tokenHash,
      expiresAt: new Date(decoded.exp * 1000)
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful. Token revoked."
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};



export const getProfile = async (req, res) => {
  try {
    // Logged-in user ki ID
    const userID = req.user.id;

    // Redis cache key
    const cacheKey = `user:profile:${userID}`;

    // Step 1: Redis mein data check karo
    const cachedUser = await redisClient.get(cacheKey);

    // Step 2: Agar cache mein data mil gaya
    if (cachedUser) {
      console.log("Profile Cache HIT");

      return res.status(200).json({
        success: true,
        message: "Profile fetched successfully (Redis)",
        user: JSON.parse(cachedUser),
      });
    }

    console.log("Profile Cache MISS");

    // Step 3: Redis mein data nahi mila,
    // PostgreSQL se fetch karo
    const user = await User.findByPk(userID, {
      attributes: ["id", "name", "email"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Step 4: User data Redis mein save karo
    await redisClient.setEx(
      cacheKey,
      600,
      JSON.stringify(user)
    );

    // Step 5: Response
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user,
    });

  } catch (error) {
    console.log("Get Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const updateProfile = async (req, res) => {
  try {
    const { name, bio, profilePicture } = req.body;

    if (
      name === undefined &&
      bio === undefined &&
      profilePicture === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required",
      });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only provided fields will be updated
    await user.update({
      ...(name !== undefined && { name }),
      ...(bio !== undefined && { bio }),
      ...(profilePicture !== undefined && { profilePicture }),
    });

    // Clear Redis cache
    await redis.del(`user:${user.id}`);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profilePicture: user.profilePicture,
      },
    });

  } catch (error) {
    console.error("Update Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const changePassword = async (req,res) => {
  try {

    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

     if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match"
      });
    }

    const user = await User.findByPk(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(oldPassword,user.password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect"
      });
    }

      const hashedPassword = await bcrypt.hash(newPassword, 8);

      user.password = hashedPassword;

      await user.save()

      return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });


  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


