import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const subdirs = ['images', 'videos', 'documents', 'templates', 'temp'];
for (const dir of subdirs) {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    let subdir = 'documents';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
      subdir = 'images';
    } else if (['.mp4', '.avi', '.mov', '.webm', '.mkv'].includes(ext)) {
      subdir = 'videos';
    }
    cb(null, path.join(UPLOAD_DIR, subdir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const VIDEO_MAX_SIZE = 500 * 1024 * 1024;

/** 压缩图片（≤5MB 时自动压缩优化） */
export async function compressImage(filePath: string): Promise<string> {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return filePath;
  }

  if (stat.size <= IMAGE_MAX_SIZE) {
    const outputPath = filePath.replace(ext, `_compressed${ext === '.png' ? '.jpg' : ext}`);
    await sharp(filePath)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(outputPath);

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(filePath);
      return outputPath;
    }
  }

  return filePath;
}

/** 视频压缩标记（大文件记录元信息，实际转码需 ffmpeg） */
export async function processVideo(filePath: string): Promise<string> {
  const stat = fs.statSync(filePath);
  if (stat.size <= VIDEO_MAX_SIZE) {
    // 标记已处理，实际生产环境可集成 ffmpeg
    const metaPath = `${filePath}.meta.json`;
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ originalSize: stat.size, processed: true, note: 'ready for playback' })
    );
  }
  return filePath;
}

export function getRelativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
}

export { UPLOAD_DIR };
