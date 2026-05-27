import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const EXTENSIONS_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export const ALLOWED_FOOD_IMAGE_TYPES = Object.keys(EXTENSIONS_BY_MIME);
export const MAX_FOOD_IMAGE_SIZE = 5 * 1024 * 1024;

export function createFoodImageStorage(uploadDir = process.env.FOOD_UPLOAD_DIR || 'uploads/food-images') {
  const rootDir = resolve(uploadDir);

  function keyToPath(key) {
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return null;
    return resolve(rootDir, key);
  }

  return {
    rootDir,

    async save(file) {
      const extension = EXTENSIONS_BY_MIME[file.mimetype];
      if (!extension) {
        const error = new Error('Unsupported image type');
        error.code = 'INVALID_FOOD_IMAGE';
        throw error;
      }

      if (!file.buffer?.length || file.size > MAX_FOOD_IMAGE_SIZE) {
        const error = new Error('Invalid image size');
        error.code = 'INVALID_FOOD_IMAGE';
        throw error;
      }

      await mkdir(rootDir, { recursive: true });
      const key = `${randomUUID()}.${extension}`;
      await writeFile(resolve(rootDir, key), file.buffer);

      return {
        imageKey: key,
        imageMime: file.mimetype,
        imageSize: file.size
      };
    },

    async delete(key) {
      const filePath = keyToPath(key);
      if (!filePath) return;

      try {
        await unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },

    async open(key) {
      const filePath = keyToPath(key);
      if (!filePath) return null;

      try {
        await stat(filePath);
        return createReadStream(filePath);
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }
  };
}
