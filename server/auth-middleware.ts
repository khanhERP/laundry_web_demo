import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    userName: string;
    storeCode: string;
    isAdmin: boolean;
    typeUser: number;
    priceListId?: number;
  };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    // Try to get token from cookie first, then fall back to Authorization header
    let token =
      req.cookies?.authToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token không được cung cấp",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    req.user = {
      userId: decoded.userId,
      userName: decoded.userName,
      storeCode: decoded.storeCode,
      isAdmin: decoded.isAdmin,
      typeUser: decoded.typeUser,
      priceListId: decoded.priceListId,
    };

    // Check if token will expire soon (within 1 hour)
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    if (timeUntilExpiry < 3600) {
      // Less than 1 hour
      // Generate new token
      const newToken = generateToken({
        userId: decoded.userId,
        userName: decoded.userName,
        storeCode: decoded.storeCode,
        isAdmin: decoded.isAdmin,
        typeUser: decoded.typeUser,
        priceListId: decoded.priceListId,
      });

      // Set new cookie
      res.cookie("authToken", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Add new token to response header for client update
      res.setHeader("X-New-Token", newToken);

      console.log(`🔄 Token refreshed for user: ${decoded.userName}`);
    }

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);

    // Clear invalid cookie
    res.clearCookie("authToken");

    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}

export function generateToken(payload: {
  userId: number;
  userName: string;
  storeCode: string;
  isAdmin: boolean;
  typeUser: number;
  priceListId?: number;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}