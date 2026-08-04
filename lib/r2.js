const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

let _client = null;

function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

async function uploadToR2(buffer, fileName, mimeType = 'application/pdf') {
  const client = getClient();
  const key = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'private, max-age=31536000',
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function deleteFromR2(url) {
  if (!url || !process.env.R2_PUBLIC_URL) return;
  const key = url.replace(`${process.env.R2_PUBLIC_URL}/`, '');
  await getClient().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  })).catch(() => {});
}

function r2Enabled() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
            process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME &&
            process.env.R2_PUBLIC_URL);
}

module.exports = { uploadToR2, deleteFromR2, r2Enabled };
