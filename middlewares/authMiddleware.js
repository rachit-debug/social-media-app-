import jwt from "jsonwebtoken";
import crypto from "crypto";
import { TokenBlacklist } from "../models.js/TokenBlacklist.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const blacklisted = await TokenBlacklist.findOne({
      where: { tokenHash },
    });

    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: "Token has been revoked. Please login again"
      });
    }

    req.user = decoded;
    req.token = token;
    req.tokenHash = tokenHash;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
