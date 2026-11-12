const config = require('../config');

const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif',
  'pdf', 'txt', 'csv', 'json', 'md',
  'mp3', 'wav', 'm4a', 'mp4', 'webm'
]);

const UPLOADS_DIR = 'uploads';

class UploadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireToken() {
  if (!config.githubToken) {
    throw new UploadError(
      503,
      'File storage is not configured yet. Add GITHUB_TOKEN to the server environment (a GitHub token with repo access) and restart.'
    );
  }
}

function sanitizeName(rawName) {
  const name = String(rawName || '').trim().replace(/\\/g, '/');
  const base = name.split('/').pop() || '';
  if (!base || base.startsWith('.')) {
    throw new UploadError(400, 'Please give the file a name like my-picture.jpg.');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(base)) {
    throw new UploadError(400, 'File names can only use letters, numbers, dots, dashes, and underscores.');
  }
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new UploadError(400, `That file type is not supported. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`);
  }
  return `${Date.now()}-${base}`;
}

function decodeData(data) {
  const cleaned = String(data || '').replace(/^data:[^;]+;base64,/, '');
  if (!cleaned) {
    throw new UploadError(400, 'No file content was received. Please choose a file and try again.');
  }
  const buffer = Buffer.from(cleaned, 'base64');
  if (!buffer.length) {
    throw new UploadError(400, 'The file appears to be empty.');
  }
  if (buffer.length > config.maxUploadBytes) {
    throw new UploadError(413, `That file is too large. The limit is ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.`);
  }
  return buffer;
}

async function githubFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${config.githubApiBase}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (err) {
    throw new UploadError(502, 'Could not reach GitHub file storage. Please try again.');
  }
  return response;
}

function publicUrls(name) {
  return {
    url: `https://raw.githubusercontent.com/${config.githubRepo}/${config.githubBranch}/${UPLOADS_DIR}/${name}`,
    cdnUrl: `https://cdn.jsdelivr.net/gh/${config.githubRepo}@${config.githubBranch}/${UPLOADS_DIR}/${name}`
  };
}

async function upload(rawName, data) {
  requireToken();
  const name = sanitizeName(rawName);
  const buffer = decodeData(data);
  const response = await githubFetch(
    `/repos/${config.githubRepo}/contents/${UPLOADS_DIR}/${name}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `Upload file ${name}`,
        content: buffer.toString('base64'),
        branch: config.githubBranch
      })
    }
  );
  if (response.status === 422) {
    throw new UploadError(409, 'A file with that exact name already exists. Please rename it and try again.');
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[fileStore] GitHub upload failed: HTTP ${response.status} ${detail.slice(0, 300)}`);
    throw new UploadError(502, 'GitHub refused the upload. Check that GITHUB_TOKEN has write access to the repo.');
  }
  return { name, size: buffer.length, ...publicUrls(name) };
}

async function list() {
  requireToken();
  const response = await githubFetch(
    `/repos/${config.githubRepo}/contents/${UPLOADS_DIR}?ref=${config.githubBranch}`
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`[fileStore] GitHub list failed: HTTP ${response.status} ${detail.slice(0, 300)}`);
    throw new UploadError(502, 'Could not list stored files. Check that GITHUB_TOKEN has read access to the repo.');
  }
  const entries = await response.json();
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter((entry) => entry && entry.type === 'file')
    .map((entry) => ({
      name: entry.name,
      size: entry.size,
      ...publicUrls(entry.name)
    }));
}

async function remove(rawName) {
  requireToken();
  const name = String(rawName || '');
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new UploadError(400, 'Invalid file name.');
  }
  const head = await githubFetch(
    `/repos/${config.githubRepo}/contents/${UPLOADS_DIR}/${name}?ref=${config.githubBranch}`
  );
  if (head.status === 404) {
    throw new UploadError(404, 'That file was not found. It may already be deleted.');
  }
  if (!head.ok) {
    throw new UploadError(502, 'Could not look up that file. Please try again.');
  }
  const info = await head.json();
  const del = await githubFetch(
    `/repos/${config.githubRepo}/contents/${UPLOADS_DIR}/${name}`,
    {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete file ${name}`,
        sha: info.sha,
        branch: config.githubBranch
      })
    }
  );
  if (!del.ok) {
    throw new UploadError(502, 'GitHub refused the delete. Check that GITHUB_TOKEN has write access to the repo.');
  }
  return { name, deleted: true };
}

module.exports = { upload, list, remove, UploadError };
