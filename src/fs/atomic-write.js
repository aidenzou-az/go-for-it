import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export async function atomicWriteFile(targetPath, content) {
  const directory = path.dirname(targetPath);
  const tempPath = path.join(directory, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);

  await mkdir(directory, { recursive: true });
  await writeFile(tempPath, content, "utf8");

  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
