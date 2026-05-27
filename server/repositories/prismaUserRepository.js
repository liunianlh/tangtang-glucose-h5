import { PrismaClient } from '@prisma/client';
import { normalizeUsername } from '../lib/auth.js';

function toApiUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.name || user.username,
    passwordHash: user.passwordHash
  };
}

export function createPrismaUserRepository(prisma = new PrismaClient()) {
  return {
    kind: 'mysql',

    async findById(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return toApiUser(user);
    },

    async findByUsername(username) {
      const user = await prisma.user.findUnique({
        where: { username: normalizeUsername(username) }
      });
      return toApiUser(user);
    },

    async createUser(input) {
      const username = normalizeUsername(input.username);
      try {
        const user = await prisma.user.create({
          data: {
            username,
            passwordHash: input.passwordHash,
            email: `${username}@local.glucose`,
            name: input.displayName || username
          }
        });
        return toApiUser(user);
      } catch (error) {
        if (error.code === 'P2002') {
          const duplicateError = new Error('DUPLICATE_USERNAME');
          duplicateError.code = 'DUPLICATE_USERNAME';
          throw duplicateError;
        }
        throw error;
      }
    },

    async updateUserProfile(id, input) {
      const user = await prisma.user.update({
        where: { id },
        data: {
          name: input.displayName
        }
      });
      return toApiUser(user);
    }
  };
}
