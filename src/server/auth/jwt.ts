import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config";

export interface TokenPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  driverId?: string;
  customerId?: string;
  permissions?: string[];
  registrationId?: string;
  registrationStatus?: string;
  accountApproved?: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (err) {
    return null;
  }
}
