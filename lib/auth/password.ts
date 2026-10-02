import "server-only";
import argon2 from "argon2";

const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (pw: string) => argon2.hash(pw, OPTS);
export const verifyPassword = (hash: string, pw: string) =>
  argon2.verify(hash, pw).catch(() => false);
