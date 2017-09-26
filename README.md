# express-filebin
Upload files and create download links.

Currently supports Amazon S3 and local disk storage.

## Environment Variables

### General
- `HANDLER` Handler could be one of `s3`, `local`
- `BASE_URL` (*)Base url for public access, defaults to http://localhost
- `UPLOAD_PATH` Upload path, defaults to `/uploads`
- `DOWNLOAD_PATH` (*)Download path, defaults to `/download/:id`
> (*) only works with `HANDLER=local`

### File
- `FILE__DEST` File destination, defaults to __dirname + '/uploads'
- `FILE__LIMITS__FIELDNAMESIZE` Maximum size of field name, defaults to 100
- `FILE__LIMITS__FILESIZE` Maximum size of each upload file, defaults to 1024 * 1024 * 100 bytes ~= 100 MB
- `FILE__LIMITS__FILES` Number of upload files, defaults to 5
- `FILE__LIMITS__FIELDS` Number of fields, defaults to 5

### S3
- `S3__PRESIGNED__EXPIRES` Pre-signed download link expire time in seconds, defaults to 1209600 (14 days)
- `S3__ACCESSKEYID` Access key id for S3
- `S3__SECRETACCESSKEY` Secret access key for S3
- `S3__REGION` AWS Region for example `us-west-2`
- `S3__PARAMS__BUCKET` Bucket name

### Local
- `LOCAL__MAX` Max number of files, defaults to 50
- `LOCAL__MAX__AGE` Max age of files in seconds, defaults to 3600000 (1000 mins)


## Example

```js
app = express();
app.use(filebin({
    handler: 's3',
    s3Options: {
    accessKeyId: '1234',
    secretAccessKey: '5678',
    endpoint: 'http://localhost:5566',
    s3BucketEndpoint: false,
    use_ssl: false,
    s3ForcePathStyle: true,
    params: {
        Bucket: 'test-bucket'
    }
    },
    uploadOptions: {
    dest: __dirname + '/uploads'
    }
}));
```

Response format
- Single file (HANDLER=s3)
```json
{
    "fieldname": "firmware.zip",
    "physicalPath": "/test/uploads/f6951d0c2b1ce84f56da1fe15d6eb6a5",
    "url: "http://localhost:5566/test-bucket/f6951d0c2b1ce84f56da1fe15d6eb6a5?AWSAccessKeyId=1234&Expires=1507650209&Signature=mehx3Ws5fqyoSlMrbbD7WVi%2FOAU%3D"
}
```

- Multiple files (HANDLER=local)
```json
[{
    "fieldname": "firmware.zip",
    "physicalPath": "/test/uploads/7b56c995b84aefa61c08f820133a7c98",
    "url": "http://localhost/download/7b56c995b84aefa61c08f820133a7c98"
}, {
    "fieldname": "firmware2.zip",
    "physicalPath": "/test/uploads/364285130128f73422d178c2ecbc56d0",
    "url": "http://localhost/download/364285130128f73422d178c2ecbc56d0"
}]
```
