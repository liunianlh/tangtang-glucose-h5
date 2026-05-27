import { randomUUID } from 'node:crypto';
import { normalizeUsername } from '../lib/auth.js';

function cloneUser(user) {
  return user ? { ...user } : null;
}

export function createMemoryUserRepository(seedUsers = []) {
  const usersById = new Map();
  const usersByUsername = new Map();

  for (const user of seedUsers) {
    const normalized = normalizeUsername(user.username);
    const nextUser = {
      ...user,
      id: user.id || randomUUID(),
      username: normalized,
      displayName: user.displayName || normalized
    };
    usersById.set(nextUser.id, nextUser);
    usersByUsername.set(nextUser.username, nextUser);
  }

  return {
    kind: 'memory',

    async findById(id) {
      return cloneUser(usersById.get(id));
    },

    async findByUsername(username) {
      return cloneUser(usersByUsername.get(normalizeUsername(username)));
    },

    async createUser(input) {
      const username = normalizeUsername(input.username);
      if (usersByUsername.has(username)) {
        const error = new Error('DUPLICATE_USERNAME');
        error.code = 'DUPLICATE_USERNAME';
        throw error;
      }

      const user = {
        id: randomUUID(),
        username,
        displayName: input.displayName || username,
        passwordHash: input.passwordHash,
        createdAt: new Date().toISOString()
      };

      usersById.set(user.id, user);
      usersByUsername.set(user.username, user);
      return cloneUser(user);
    },

    async updateUserProfile(id, input) {
      const existing = usersById.get(id);
      if (!existing) return null;

      const updated = {
        ...existing,
        displayName: input.displayName || existing.displayName,
        updatedAt: new Date().toISOString()
      };

      usersById.set(id, updated);
      usersByUsername.set(updated.username, updated);
      return cloneUser(updated);
    }
  };
}
