
// const express = require('express');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const cors = require('cors');
// const Redis = require('ioredis');

// const app = express();
// const port = 3000;

// // Log all incoming requests for monitoring
// app.use((req, res, next) => {
//   console.log(`[LOG] Incoming request: ${req.method} ${req.originalUrl}`);
//   next();
// });

// // Enable CORS for all origins
// app.use(cors());

// // Increase payload size limit to handle larger uploads
// app.use(express.json({ limit: '1gb' }));
// app.use(express.urlencoded({ limit: '1gb', extended: true }));

// // Create directories for uploads and processed files if they don't exist
// const uploadDir = path.join(__dirname, 'uploads');
// const processedDir = path.join(__dirname, 'processed_videos');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
//   console.log(`[LOG] Created directory: ${uploadDir}`);
// }
// if (!fs.existsSync(processedDir)) {
//   fs.mkdirSync(processedDir, { recursive: true });
//   console.log(`[LOG] Created directory: ${processedDir}`);
// }

// // Configure Multer for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const fileName = `${Date.now()}-${file.originalname}`;
//     console.log(`[LOG] Storing file: ${fileName}`);
//     cb(null, fileName);
//   }
// });
// const upload = multer({ storage: storage });

// // Connect to Redis
// const redis = new Redis();
// redis.on('connect', () => console.log('[LOG] Successfully connected to Redis.'));
// redis.on('error', err => console.error('[ERROR] Redis connection error:', err));

// // Serve static processed files
// app.use('/downloads', express.static(processedDir));

// // API endpoint to check job status
// app.get('/job-status/:jobId', async (req, res) => {
//   const jobId = req.params.jobId;
//   console.log(`[LOG] Checking status for job ID: ${jobId}`);
//   try {
//     const jobStatus = await redis.hgetall(`job_status:${jobId}`);
    
//     if (Object.keys(jobStatus).length === 0) {
//       console.log(`[LOG] Job ID ${jobId} not found.`);
//       return res.status(404).json({ message: 'Job not found.' });
//     }

//     const processedFiles = [];
//     let isComplete = true;
//     let hasFailed = false;

//     for (const originalName in jobStatus) {
//       const status = jobStatus[originalName];
//       if (status === 'processing') {
//         isComplete = false;
//         break;
//       } else if (status === 'failed') {
//         hasFailed = true;
//         break;
//       } else {
//         processedFiles.push(JSON.parse(status));
//       }
//     }

//     if (hasFailed) {
//       res.json({ status: 'failed', message: `One or more videos failed to process.` });
//     } else if (isComplete) {
//       res.json({ status: 'complete', processedFiles });
//     } else {
//       res.json({ status: 'processing', message: 'Videos are still being processed.' });
//     }
//   } catch (error) {
//     console.error(`[ERROR] Error checking job status for ${jobId}:`, error);
//     res.status(500).json({ status: 'error', message: 'Failed to retrieve job status.' });
//   }
// });

// // NEW: Endpoint to retrieve processed files after job status is cleared
// app.get('/processed-files/:jobId', async (req, res) => {
//   const jobId = req.params.jobId;
//   console.log(`[LOG] Frontend is requesting processed files for job ID: ${jobId}`);
  
//   // Add a small delay to give Redis time to commit the data
//   await new Promise(resolve => setTimeout(resolve, 250)); // Wait for 250ms

//   try {
//     const processedFiles = await redis.lrange(`processed_files:${jobId}`, 0, -1);
    
//     if (processedFiles.length === 0) {
//       console.log(`[LOG] No processed files found in persistent list for job ${jobId}.`);
//       return res.status(404).json({ message: 'No processed files found for this job.' });
//     }
    
//     const files = processedFiles.map(file => JSON.parse(file));
//     console.log(`[LOG] Found ${files.length} processed files for job ${jobId}.`);
//     res.json(files);
//   } catch (error) {
//     console.error(`[ERROR] Error retrieving processed files for ${jobId}:`, error);
//     res.status(500).json({ status: 'error', message: 'Failed to retrieve processed files.' });
//   }
// });


// // API endpoint for video processing
// app.post('/process-video', upload.fields([
//   { name: 'videos', maxCount: 25 },
//   { name: 'logo', maxCount: 1 }
// ]), async (req, res) => {
//   const videoFiles = req.files.videos;
//   const logoFile = req.files.logo ? req.files.logo[0] : null;
//   const logoPosition = req.body.logoPosition ? JSON.parse(req.body.logoPosition) : { x: 10, y: 10 };

//   console.log(`[LOG] Received new video processing request.`);
//   if (videoFiles) {
//     console.log(`[LOG] Uploaded videos: ${videoFiles.length}`);
//   }
//   if (logoFile) {
//     console.log(`[LOG] Uploaded logo: ${logoFile.originalname}`);
//   }
//   console.log(`[LOG] Logo position data:`, logoPosition);

//   if (!videoFiles || videoFiles.length === 0 || !logoFile) {
//     console.log('[ERROR] Bad request: Missing video or logo file.');
//     if (videoFiles) {
//       videoFiles.forEach(file => fs.unlink(file.path, () => {}));
//     }
//     if (logoFile) {
//       fs.unlink(logoFile.path, () => {});
//     }
//     return res.status(400).json({ error: 'Please upload at least one video and a logo file.' });
//   }

//   const jobId = Date.now().toString();
//   console.log(`[LOG] Generated new job ID: ${jobId}`);

//   try {
//     // Set initial status for all videos in the job
//     const initialStatus = {};
//     videoFiles.forEach(file => {
//       initialStatus[file.originalname] = 'processing';
//     });
//     await redis.hmset(`job_status:${jobId}`, initialStatus);

//     // Enqueue a separate job for each video file
//     for (const videoFile of videoFiles) {
//       const jobDetails = {
//         jobId,
//         videoPath: videoFile.path,
//         logoPath: logoFile.path,
//         logoPosition,
//         originalName: videoFile.originalname
//       };
//       await redis.lpush('video_jobs_queue', JSON.stringify(jobDetails));
//       console.log(`[LOG] Enqueued video for processing: ${videoFile.originalname}`);
//     }
    
//     res.json({ message: `Your videos have been added to the queue for processing. Job ID: ${jobId}`, jobId });
  
//   } catch (error) {
//     console.error('[ERROR] Error adding job to Redis queue:', error);
//     if (videoFiles) {
//       videoFiles.forEach(file => fs.unlink(file.path, () => {}));
//     }
//     if (logoFile) {
//       fs.unlink(logoFile.path, () => {});
//     }
//     res.status(500).json({ error: 'Failed to add job to queue.' });
//   }
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`[LOG] Server listening at http://localhost:${port}`);
// });



const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Redis = require('ioredis');
const https = require('https');
const http = require('http');

// ===== SSL Certificates =====
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/srv945655.hstgr.cloud/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/srv945655.hstgr.cloud/fullchain.pem')
};

const app = express();
const port = 3000;

// ===== HTTP → HTTPS Redirect =====
const redirectApp = express();
redirectApp.use((req, res) => {
  res.redirect(`https://${req.hostname}${req.url}`);
});
http.createServer(redirectApp).listen(80, () => {
  console.log('[LOG] HTTP redirect server running on port 80');
});

// ===== Middleware =====
app.use((req, res, next) => {
  console.log(`[LOG] Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});
app.use(cors());
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ limit: '1gb', extended: true }));

// ===== Create directories =====
const uploadDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed_videos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

// ===== Multer config =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}-${file.originalname}`;
    console.log(`[LOG] Storing file: ${fileName}`);
    cb(null, fileName);
  }
});
const upload = multer({ storage });

// ===== Redis connection =====
const redis = new Redis();
redis.on('connect', () => console.log('[LOG] Connected to Redis.'));
redis.on('error', err => console.error('[ERROR] Redis connection error:', err));

// ===== Serve processed files =====
app.use('/downloads', express.static(processedDir));

// ===== Job Status Endpoint =====
app.get('/job-status/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  try {
    const jobStatus = await redis.hgetall(`job_status:${jobId}`);
    if (Object.keys(jobStatus).length === 0) return res.status(404).json({ message: 'Job not found.' });

    const processedFiles = [];
    let isComplete = true;
    let hasFailed = false;

    for (const originalName in jobStatus) {
      const status = jobStatus[originalName];
      if (status === 'processing') {
        isComplete = false;
        break;
      } else if (status === 'failed') {
        hasFailed = true;
        break;
      } else {
        processedFiles.push(JSON.parse(status));
      }
    }

    if (hasFailed) {
      res.json({ status: 'failed', message: 'One or more videos failed to process.' });
    } else if (isComplete) {
      res.json({ status: 'complete', processedFiles });
    } else {
      res.json({ status: 'processing', message: 'Videos are still being processed.' });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve job status.' });
  }
});

// ===== Processed Files Endpoint =====
app.get('/processed-files/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  await new Promise(resolve => setTimeout(resolve, 250));

  try {
    const processedFiles = await redis.lrange(`processed_files:${jobId}`, 0, -1);
    if (processedFiles.length === 0) return res.status(404).json({ message: 'No processed files found for this job.' });

    const files = processedFiles.map(file => JSON.parse(file));
    res.json(files);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve processed files.' });
  }
});

// ===== Video Processing Endpoint =====
app.post('/process-video', upload.fields([
  { name: 'videos', maxCount: 25 },
  { name: 'logo', maxCount: 1 }
]), async (req, res) => {
  const videoFiles = req.files.videos;
  const logoFile = req.files.logo ? req.files.logo[0] : null;
  const logoPosition = req.body.logoPosition ? JSON.parse(req.body.logoPosition) : { x: 10, y: 10 };

  if (!videoFiles || videoFiles.length === 0 || !logoFile) {
    if (videoFiles) videoFiles.forEach(file => fs.unlink(file.path, () => {}));
    if (logoFile) fs.unlink(logoFile.path, () => {});
    return res.status(400).json({ error: 'Please upload at least one video and a logo file.' });
  }

  const jobId = Date.now().toString();
  try {
    const initialStatus = {};
    videoFiles.forEach(file => { initialStatus[file.originalname] = 'processing'; });
    await redis.hmset(`job_status:${jobId}`, initialStatus);

    for (const videoFile of videoFiles) {
      const jobDetails = {
        jobId,
        videoPath: videoFile.path,
        logoPath: logoFile.path,
        logoPosition,
        originalName: videoFile.originalname
      };
      await redis.lpush('video_jobs_queue', JSON.stringify(jobDetails));
    }
    
    res.json({ message: `Your videos have been added to the queue. Job ID: ${jobId}`, jobId });
  } catch (error) {
    if (videoFiles) videoFiles.forEach(file => fs.unlink(file.path, () => {}));
    if (logoFile) fs.unlink(logoFile.path, () => {});
    res.status(500).json({ error: 'Failed to add job to queue.' });
  }
});

// ===== Start HTTPS Server =====
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`[LOG] HTTPS server running at https://srv945655.hstgr.cloud:${port}`);
});
