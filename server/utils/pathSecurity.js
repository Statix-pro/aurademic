import path from 'path';

/**
 * Safely resolves a target file path within a base directory.
 * Prevents directory traversal attacks.
 * 
 * @param {string} baseDir - The trusted base directory.
 * @param {string} targetFile - The filename or relative path to resolve.
 * @returns {string|null} - The resolved absolute path if safe, otherwise null.
 */
export function safeResolvePath(baseDir, targetFile) {
    if (!baseDir || !targetFile) return null;

    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(baseDir, targetFile);

    // Ensure the resolved target path is within the resolved base directory
    if (resolvedTarget.startsWith(resolvedBase)) {
        return resolvedTarget;
    }

    return null;
}
