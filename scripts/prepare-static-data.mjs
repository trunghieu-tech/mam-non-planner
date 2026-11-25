import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const webDataDir = path.join(webRoot, 'data');
const parentDataDir = path.resolve(webRoot, '..', 'data');
const outDir = path.join(webRoot, 'public', 'static-data');

fs.mkdirSync(outDir, { recursive: true });

const copyIfAvailable = (srcPath, destName) => {
  const destPath = path.join(outDir, destName);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`[static-data] Synced ${destName}`);
  } else if (fs.existsSync(destPath)) {
    console.log(`[static-data] Kept existing ${destName}`);
  } else {
    console.warn(`[static-data] Missing optional ${destName}`);
  }
};

// Dữ liệu cấu hình & giáo án mẫu từ web-demo/data
copyIfAvailable(path.join(webDataDir, 'seed_objectives.json'), 'seed_objectives.json');
copyIfAvailable(path.join(webDataDir, 'plans.json'), 'plans.json');
copyIfAvailable(path.join(webDataDir, 'seed_plans.json'), 'seed_plans.json');
copyIfAvailable(path.join(webDataDir, 'annual_plans.json'), 'annual_plans.json');
copyIfAvailable(path.join(webDataDir, 'assessments.json'), 'assessments.json');
copyIfAvailable(path.join(webDataDir, 'lesson_templates.json'), 'lesson_templates.json');
copyIfAvailable(path.join(webDataDir, 'media_resources.json'), 'media_resources.json');

// Kho tri thức thực tế từ ../data (hoặc giữ nguyên trong public/static-data khi chạy trên CI/GitHub Actions)
copyIfAvailable(path.join(parentDataDir, 'works_corpus.json'), 'works_corpus.json');
copyIfAvailable(path.join(parentDataDir, 'kb_summary.json'), 'kb_summary.json');
copyIfAvailable(path.join(parentDataDir, 'kb_by_mt.json'), 'kb_by_mt.json');
copyIfAvailable(path.join(parentDataDir, 'crawled_docs.json'), 'crawled_docs.json');
