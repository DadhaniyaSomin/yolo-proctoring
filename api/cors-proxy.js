// CORS Proxy for loading ONNX models
// This Vercel serverless function acts as a proxy to bypass CORS restrictions

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Validate URL to prevent abuse
  const allowedDomains = [
    'github.com',
    'huggingface.co',
    'yolo-proctoring.vercel.app',
    'raw.githubusercontent.com'
  ];

  let isAllowed = false;
  try {
    const urlObj = new URL(url);
    isAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!isAllowed) {
    return res.status(403).json({ 
      error: 'Domain not allowed',
      allowedDomains 
    });
  }

  try {
    // Fetch the model file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'YOLO-Model-Loader/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch: ${response.statusText}` 
      });
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', contentType);
    
    // Stream the response
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request',
      details: error.message 
    });
  }
}
