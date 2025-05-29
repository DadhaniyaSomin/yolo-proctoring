# CORS Solution for YOLO Model Loading

## Problem
When deploying to Vercel (or any production environment), loading ONNX models from external URLs fails due to CORS (Cross-Origin Resource Sharing) restrictions. The error typically looks like:

```
Access to fetch at 'https://example.com/model.onnx' from origin 'https://your-app.vercel.app' 
has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header contains the invalid value ''.
```

## Solutions Implemented

### 1. Enhanced Model Loading with Fallback URLs
The worker now tries multiple URLs in sequence:

1. **Primary URL**: `https://yolo-proctoring.vercel.app/models/yolo11n.onnx`
2. **GitHub Release**: `https://github.com/ultralytics/assets/releases/download/v8.2.0/yolo11n.onnx`
3. **Hugging Face**: `https://huggingface.co/Ultralytics/YOLOv8/resolve/main/yolo11n.onnx`
4. **Our CORS Proxy**: `/api/cors-proxy?url=...`
5. **External CORS Proxy**: `https://cors-anywhere.herokuapp.com/...`

### 2. CORS-Aware Fetch Function
The `loadModelWithCORS()` function:
- First tries standard CORS fetch
- Falls back to `no-cors` mode if CORS fails
- Provides detailed error messages
- Handles both URLs and local paths

### 3. Custom CORS Proxy (Vercel Function)
Created `/api/cors-proxy.js` that:
- Acts as a server-side proxy to bypass CORS
- Validates allowed domains for security
- Streams large files efficiently
- Sets proper CORS headers

### 4. Improved Error Handling and Status Updates
- Real-time status updates during model loading
- Detailed error messages for debugging
- Automatic retry with different URLs
- Progress indicators for users

## Files Modified

### `src/workers/yolo-worker.js`
- Added `loadModelWithCORS()` function
- Enhanced `initializeModel()` with fallback logic
- Added multiple fallback URLs
- Improved error handling and status reporting

### `api/cors-proxy.js` (New)
- Vercel serverless function for CORS proxy
- Security validation for allowed domains
- Efficient streaming of large model files

### `test-cors.html` (New)
- Test page to verify CORS solutions
- Tests direct fetch, no-cors, proxy, and worker loading
- Real-time logging and status updates

## Usage

### For Development
```bash
npm run dev
# Visit http://localhost:5173/test-cors.html to test CORS solutions
```

### For Production (Vercel)
1. Deploy to Vercel
2. The CORS proxy will be available at `/api/cors-proxy`
3. Model loading will automatically try fallback URLs

### Testing CORS Solutions
Open `test-cors.html` in your browser and run the tests:
1. **Direct Fetch**: Will likely fail due to CORS
2. **No-CORS Fetch**: Should work but returns opaque response
3. **CORS Proxy**: Should work and return readable response
4. **Worker Loading**: Tests the actual worker implementation

## Configuration

### Adding New Model URLs
Edit `modelConfig.fallbackUrls` in `src/workers/yolo-worker.js`:

```javascript
fallbackUrls: [
  "https://your-new-model-url.com/model.onnx",
  // ... other URLs
]
```

### Adding Allowed Domains to CORS Proxy
Edit `allowedDomains` in `api/cors-proxy.js`:

```javascript
const allowedDomains = [
  'github.com',
  'huggingface.co',
  'your-domain.com'  // Add your domain
];
```

## Security Considerations

1. **Domain Validation**: The CORS proxy only allows specific domains
2. **No Arbitrary URLs**: Prevents abuse by limiting allowed domains
3. **Rate Limiting**: Consider adding rate limiting for production use
4. **File Size Limits**: Consider adding file size limits

## Troubleshooting

### Model Loading Fails
1. Check browser console for detailed error messages
2. Test individual URLs in `test-cors.html`
3. Verify the model file exists and is accessible
4. Check if the domain is in the allowed list

### CORS Proxy Not Working
1. Ensure Vercel deployment includes the `/api` folder
2. Check Vercel function logs for errors
3. Verify the URL parameter is properly encoded

### Performance Issues
1. Consider hosting models on your own CDN
2. Use smaller model files for faster loading
3. Implement caching strategies

## Best Practices

1. **Host Your Own Models**: For production, host models on your own domain
2. **Use CDN**: Use a CDN for faster model delivery
3. **Implement Caching**: Cache models in browser storage
4. **Monitor Loading**: Track model loading success rates
5. **Fallback Strategy**: Always have multiple fallback URLs

## Alternative Solutions

### 1. Host Models Locally
```bash
# Download model to public folder
wget https://example.com/model.onnx -O public/models/yolo11n.onnx
```

### 2. Use Vercel Blob Storage
```javascript
// Upload to Vercel Blob and use the blob URL
const blobUrl = await put('yolo11n.onnx', modelFile, { access: 'public' });
```

### 3. Configure Server CORS Headers
If you control the model server, add CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Content-Type
```
