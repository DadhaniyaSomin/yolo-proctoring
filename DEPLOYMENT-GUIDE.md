# Deployment Guide: YOLO with CORS Fix

## 🚀 Deploy to Vercel

### 1. Prepare for Deployment
```bash
# Ensure all files are committed
git add .
git commit -m "Add CORS fix for YOLO model loading"
git push origin main
```

### 2. Deploy to Vercel
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# ? Set up and deploy "~/yolo-test"? [Y/n] y
# ? Which scope do you want to deploy to? [Your Account]
# ? Link to existing project? [y/N] n
# ? What's your project's name? yolo-proctoring
# ? In which directory is your code located? ./
```

### 3. Verify Deployment
After deployment, Vercel will provide URLs like:
- **Preview**: `https://yolo-proctoring-abc123.vercel.app`
- **Production**: `https://yolo-proctoring.vercel.app`

### 4. Test CORS Solution
Visit your deployed app and test:
```
https://your-app.vercel.app/test-cors.html
```

## 🔧 Configuration for Production

### Update Model URLs
Edit `src/workers/yolo-worker.js` with your production model URLs:

```javascript
const modelConfig = {
  modelPath: "https://your-app.vercel.app/models/yolo11n.onnx",
  fallbackUrls: [
    // Your hosted models
    "https://your-cdn.com/models/yolo11n.onnx",
    
    // CORS proxy fallback
    `/api/cors-proxy?url=${encodeURIComponent(
      "https://external-source.com/model.onnx"
    )}`,
    
    // Local fallback
    "./models/yolo11n.onnx",
  ]
};
```

### Environment Variables (Optional)
Create `.env.local` for sensitive configuration:
```bash
# .env.local
MODEL_BASE_URL=https://your-cdn.com/models
CORS_PROXY_SECRET=your-secret-key
```

## 📁 File Structure for Deployment

```
your-project/
├── api/
│   └── cors-proxy.js          # CORS proxy function
├── public/
│   └── models/                # Local model files (optional)
│       └── yolo11n.onnx
├── src/
│   ├── workers/
│   │   └── yolo-worker.js     # Enhanced with CORS handling
│   └── ...
├── test-cors.html             # CORS testing page
├── vercel.json               # Vercel configuration (optional)
└── package.json
```

## ⚙️ Vercel Configuration

### Optional: `vercel.json`
```json
{
  "functions": {
    "api/cors-proxy.js": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/models/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET"
        }
      ]
    }
  ]
}
```

## 🔍 Testing in Production

### 1. Test CORS Solutions
```bash
# Visit your test page
curl https://your-app.vercel.app/test-cors.html
```

### 2. Test CORS Proxy
```bash
# Test the proxy endpoint
curl "https://your-app.vercel.app/api/cors-proxy?url=https%3A//example.com/model.onnx"
```

### 3. Test Worker Loading
Open browser console and check for:
- ✅ Model loading success messages
- ❌ CORS error messages
- 📊 Performance metrics

## 🚨 Common Issues & Solutions

### Issue: "Function not found"
**Solution**: Ensure `api/` folder is in project root
```bash
# Check file structure
ls -la api/
# Should show: cors-proxy.js
```

### Issue: "Domain not allowed"
**Solution**: Add your domain to allowed list in `api/cors-proxy.js`
```javascript
const allowedDomains = [
  'github.com',
  'your-domain.com'  // Add this
];
```

### Issue: Model loading timeout
**Solution**: Increase timeout in worker or use smaller models
```javascript
// In worker
const TIMEOUT_MS = 30000; // 30 seconds
```

### Issue: CORS still failing
**Solution**: Check browser console for specific error messages
1. Verify model URL is accessible
2. Test with CORS proxy
3. Check Vercel function logs

## 📊 Monitoring & Analytics

### Vercel Function Logs
```bash
# View function logs
vercel logs --follow

# Filter for CORS proxy
vercel logs --follow | grep cors-proxy
```

### Performance Monitoring
Add to your worker:
```javascript
// Track model loading performance
const startTime = performance.now();
// ... model loading code ...
const loadTime = performance.now() - startTime;
console.log(`Model loaded in ${loadTime}ms`);
```

## 🔐 Security Best Practices

### 1. Limit CORS Proxy Usage
```javascript
// Add rate limiting
const RATE_LIMIT = 100; // requests per hour
```

### 2. Validate Model URLs
```javascript
// Only allow specific model types
const allowedExtensions = ['.onnx', '.pb', '.tflite'];
```

### 3. Monitor Usage
```javascript
// Log proxy usage
console.log(`Proxy request: ${url} from ${req.headers.origin}`);
```

## 🎯 Optimization Tips

### 1. Model Hosting
- Host models on Vercel's CDN for fastest loading
- Use compressed models when possible
- Implement progressive loading for large models

### 2. Caching Strategy
```javascript
// Cache models in browser
const modelCache = new Map();
if (modelCache.has(modelUrl)) {
  return modelCache.get(modelUrl);
}
```

### 3. Error Handling
```javascript
// Graceful degradation
if (!modelLoaded) {
  showFallbackUI();
  return;
}
```

## ✅ Deployment Checklist

- [ ] CORS proxy function deployed (`/api/cors-proxy`)
- [ ] Model URLs updated for production
- [ ] Test page accessible (`/test-cors.html`)
- [ ] All CORS tests passing
- [ ] Error handling implemented
- [ ] Performance monitoring added
- [ ] Security measures in place
- [ ] Documentation updated

## 🎉 Success!

Your YOLO application should now work in production with proper CORS handling! 

Test it at: `https://your-app.vercel.app`
