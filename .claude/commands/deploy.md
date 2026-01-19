m# Deploy RaveFlow

Deploy updated files to production server (raveflow.ru).

## Connection Details
- **Server**: kar43lov@176.123.161.248
- **Domain**: raveflow.ru
- **Path**: /var/www/rave-visualizer

## Instructions

Execute the following steps sequentially:

### 1. Build the project
```bash
npm run build
```
Verify build succeeds before continuing.

### 2. Upload files to server
```bash
scp -r dist/* kar43lov@176.123.161.248:/var/www/rave-visualizer/
```

### 3. Report completion
After successful upload, inform the user that deploy is complete and the site is available at https://raveflow.ru/

## Notes
- This command only uploads files, it does NOT reconfigure Nginx (to preserve HTTPS/certbot settings)
- If upload fails, check SSH key authentication