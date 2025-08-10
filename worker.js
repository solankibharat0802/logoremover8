


// // worker.js
// const Redis = require('ioredis');
// const { spawn } = require('child_process');
// const path = require('path');
// const fs = require('fs');

// const redis = new Redis();
// const processedDir = path.join(__dirname, 'processed_videos');
// const uploadDir = path.join(__dirname, 'uploads');

// if (!fs.existsSync(processedDir)) {
//   fs.mkdirSync(processedDir, { recursive: true });
// }

// async function processJob() {
//   while (true) {
//     let job;
//     try {
//       const result = await redis.blpop('video_jobs_queue', 0);
//       job = JSON.parse(result[1]);
      
//       console.log(`[WORKER] Processing job: ${job.originalName} with logo position ${job.logoPosition.corner}`);

//       const sanitizedOriginalName = job.originalName.replace(/[^\w\s\.\-_]/g, '');
//       const outputFileName = `processed-${sanitizedOriginalName}`;
//       const outputPath = path.join(processedDir, outputFileName);
      
//       const videoPath = job.videoPath;
//       const logoPath = job.logoPath;
      
//       let overlayPosition = '';
//       const padding = 10;
//       switch (job.logoPosition.corner) {
//         case 'top-left':
//           overlayPosition = `${padding}:${padding}`;
//           break;
//         case 'top-right':
//           overlayPosition = `main_w-overlay_w-${padding}:${padding}`;
//           break;
//         case 'bottom-left':
//           overlayPosition = `${padding}:main_h-overlay_h-${padding}`;
//           break;
//         case 'bottom-right':
//           overlayPosition = `main_w-overlay_w-${padding}:main_h-overlay_h-${padding}`;
//           break;
//         case 'center':
//           overlayPosition = `(main_w-overlay_w)/2:(main_h-overlay_h)/2`;
//           break;
//         default:
//           overlayPosition = `${padding}:${padding}`;
//           break;
//       }
      
//       const ffmpegArgs = [
//         '-i', videoPath,
//         '-i', logoPath,
//         '-filter_complex', `[1]scale=w=iw/2:h=-1[logo];[0][logo]overlay=${overlayPosition}`,
//         '-c:v', 'libx264',
//         '-c:a', 'aac',
//         '-preset', 'fast',
//         outputPath
//       ];

//       console.log(`[WORKER] Executing command: ffmpeg ${ffmpegArgs.join(' ')}`);

//       const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

//       ffmpegProcess.stdout.on('data', (data) => {
//         console.log(`[FFMPEG-STDOUT] ${data}`);
//       });

//       ffmpegProcess.stderr.on('data', (data) => {
//         console.log(`[FFMPEG-STDERR] ${data}`);
//       });

//       await new Promise((resolve, reject) => {
//         ffmpegProcess.on('close', async (code) => {
//           const originalName = job.originalName;
//           const jobId = job.jobId;

//           try {
//             fs.unlinkSync(job.videoPath);
//             console.log(`[WORKER] Cleaned up temporary video file for job ${jobId}`);
//           } catch (cleanupError) {
//             console.error(`[WORKER] Failed to clean up video file for job ${jobId}:`, cleanupError);
//           }

//           if (code === 0) {
//             console.log(`[WORKER] Successfully processed job ${jobId}, video ${originalName}`);
//             const processedFileDetails = {
//               name: originalName,
//               url: `/downloads/${outputFileName}`
//             };
//             try {
//               // THIS IS THE KEY FIX: save processed file details to a persistent list
//               await redis.lpush(`processed_files:${jobId}`, JSON.stringify(processedFileDetails));
//               await redis.expire(`processed_files:${jobId}`, 3600); // 1 hour TTL

//               await redis.hset(`job_status:${jobId}`, originalName, JSON.stringify(processedFileDetails));
//               console.log(`[WORKER] Updated Redis status for video '${originalName}' to 'complete'`);
              
//               const jobStatus = await redis.hgetall(`job_status:${jobId}`);
//               const allVideosProcessed = Object.values(jobStatus).every(status => status.startsWith('{') || status === 'failed');

//               if (allVideosProcessed) {
//                 console.log(`[WORKER] All videos for job ${jobId} are completed. Cleaning up logo file and job status.`);
//                 try {
//                   fs.unlinkSync(job.logoPath);
//                   console.log(`[WORKER] Cleaned up logo file: ${job.logoPath}`);
//                   await redis.del(`job_status:${jobId}`);
//                   console.log(`[WORKER] Cleaned up job status for ${jobId}`);
//                 } catch (cleanupError) {
//                   console.error(`[WORKER] Failed to clean up logo file or job status for job ${jobId}:`, cleanupError);
//                 }
//               }
//               resolve();
//             } catch (redisError) {
//               console.error(`[WORKER] Failed to update Redis status for job ${jobId}:`, redisError);
//               reject(redisError);
//             }
//           } else {
//             console.error(`[WORKER] FFmpeg process exited with code ${code} for job ${jobId}, video ${originalName}`);
//             try {
//               await redis.hset(`job_status:${jobId}`, originalName, 'failed');
//               console.log(`[WORKER] Updated Redis status for video '${originalName}' to 'failed'`);

//               const jobStatus = await redis.hgetall(`job_status:${jobId}`);
//               const allVideosProcessed = Object.values(jobStatus).every(status => status.startsWith('{') || status === 'failed');

//               if (allVideosProcessed) {
//                   console.log(`[WORKER] All videos for job ${jobId} have been processed (some may have failed). Cleaning up logo file and job status.`);
//                   try {
//                       fs.unlinkSync(job.logoPath);
//                       console.log(`[WORKER] Cleaned up logo file: ${job.logoPath}`);
//                       await redis.del(`job_status:${jobId}`);
//                       console.log(`[WORKER] Cleaned up job status for ${jobId}`);
//                   } catch (cleanupError) {
//                       console.error(`[WORKER] Failed to clean up logo file or job status for job ${jobId}:`, cleanupError);
//                   }
//               }
//               reject(new Error('FFmpeg process failed'));
//             } catch (redisError) {
//               console.error(`[WORKER] Failed to update Redis status for failed job ${jobId}:`, redisError);
//               reject(redisError);
//             }
//           }
//         });
//       });
//     } catch (error) {
//       console.error('[WORKER] Error processing job:', error);
//     }
//   }
// }

// console.log('[WORKER] Worker started. Waiting for jobs...');
// processJob();


// worker.js
const Redis = require('ioredis');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const redis = new Redis();
const processedDir = path.join(__dirname, 'processed_videos');
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

async function processJob() {
  while (true) {
    let job;
    try {
      const result = await redis.blpop('video_jobs_queue', 0);
      job = JSON.parse(result[1]);
      
      console.log(`[WORKER] Processing job: ${job.originalName} with logo position ${job.logoPosition.corner}`);

      const sanitizedOriginalName = job.originalName.replace(/[^\w\s\.\-_]/g, '');
      const outputFileName = `processed-${sanitizedOriginalName}`;
      const outputPath = path.join(processedDir, outputFileName);
      
      const videoPath = job.videoPath;
      const logoPath = job.logoPath;
      
      let overlayPosition = '';
      const padding = 10;
      // Set the logo position. Defaulting to 'bottom-left' as requested.
      switch (job.logoPosition.corner) {
        case 'top-left':
          overlayPosition = `${padding}:${padding}`;
          break;
        case 'top-right':
          overlayPosition = `main_w-overlay_w-${padding}:${padding}`;
          break;
        case 'bottom-left':
          overlayPosition = `${padding}:main_h-overlay_h-${padding}`;
          break;
        case 'bottom-right':
          overlayPosition = `main_w-overlay_w-${padding}:main_h-overlay_h-${padding}`;
          break;
        case 'center':
          overlayPosition = `(main_w-overlay_w)/2:(main_h-overlay_h)/2`;
          break;
        default:
          overlayPosition = `${padding}:main_h-overlay_h-${padding}`; // Default to bottom-left
          break;
      }
      
      // FFmpeg command arguments for spawn
      const ffmpegArgs = [
        '-y', // Crucial fix: Force overwrite without prompting
        '-i', videoPath,
        '-i', logoPath,
        '-filter_complex', `[1]scale=w=iw/2:h=-1[logo];[0][logo]overlay=${overlayPosition}`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        outputPath
      ];

      console.log(`[WORKER] Executing command: ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      ffmpegProcess.stdout.on('data', (data) => {
        console.log(`[FFMPEG-STDOUT] ${data}`);
      });

      ffmpegProcess.stderr.on('data', (data) => {
        console.log(`[FFMPEG-STDERR] ${data}`);
      });

      await new Promise((resolve, reject) => {
        ffmpegProcess.on('close', async (code) => {
          const originalName = job.originalName;
          const jobId = job.jobId;

          try {
            fs.unlinkSync(job.videoPath);
            console.log(`[WORKER] Cleaned up temporary video file for job ${jobId}`);
          } catch (cleanupError) {
            console.error(`[WORKER] Failed to clean up video file for job ${jobId}:`, cleanupError);
          }

          if (code === 0) {
            console.log(`[WORKER] Successfully processed job ${jobId}, video ${originalName}`);
            const processedFileDetails = {
              name: originalName,
              url: `/downloads/${outputFileName}`
            };
            try {
              // THIS IS THE KEY FIX: save processed file details to a persistent list
              await redis.lpush(`processed_files:${jobId}`, JSON.stringify(processedFileDetails));
              await redis.expire(`processed_files:${jobId}`, 3600); // 1 hour TTL

              await redis.hset(`job_status:${jobId}`, originalName, JSON.stringify(processedFileDetails));
              console.log(`[WORKER] Updated Redis status for video '${originalName}' to 'complete'`);
              
              const jobStatus = await redis.hgetall(`job_status:${jobId}`);
              const allVideosProcessed = Object.values(jobStatus).every(status => status.startsWith('{') || status === 'failed');

              if (allVideosProcessed) {
                console.log(`[WORKER] All videos for job ${jobId} are completed. Cleaning up logo file and job status.`);
                try {
                  fs.unlinkSync(job.logoPath);
                  console.log(`[WORKER] Cleaned up logo file: ${job.logoPath}`);
                  await redis.del(`job_status:${jobId}`);
                  console.log(`[WORKER] Cleaned up job status for ${jobId}`);
                } catch (cleanupError) {
                  console.error(`[WORKER] Failed to clean up logo file or job status for job ${jobId}:`, cleanupError);
                }
              }
              resolve();
            } catch (redisError) {
              console.error(`[WORKER] Failed to update Redis status for job ${jobId}:`, redisError);
              reject(redisError);
            }
          } else {
            console.error(`[WORKER] FFmpeg process exited with code ${code} for job ${jobId}, video ${originalName}`);
            try {
              await redis.hset(`job_status:${jobId}`, originalName, 'failed');
              console.log(`[WORKER] Updated Redis status for video '${originalName}' to 'failed'`);

              const jobStatus = await redis.hgetall(`job_status:${jobId}`);
              const allVideosProcessed = Object.values(jobStatus).every(status => status.startsWith('{') || status === 'failed');

              if (allVideosProcessed) {
                  console.log(`[WORKER] All videos for job ${jobId} have been processed (some may have failed). Cleaning up logo file and job status.`);
                  try {
                      fs.unlinkSync(job.logoPath);
                      console.log(`[WORKER] Cleaned up logo file: ${job.logoPath}`);
                      await redis.del(`job_status:${jobId}`);
                      console.log(`[WORKER] Cleaned up job status for ${jobId}`);
                  } catch (cleanupError) {
                      console.error(`[WORKER] Failed to clean up logo file or job status for job ${jobId}:`, cleanupError);
                  }
              }
              reject(new Error('FFmpeg process failed'));
            } catch (redisError) {
              console.error(`[WORKER] Failed to update Redis status for failed job ${jobId}:`, redisError);
              reject(redisError);
            }
          }
        });
      });
    } catch (error) {
      console.error('[WORKER] Error processing job:', error);
    }
  }
}

console.log('[WORKER] Worker started. Waiting for jobs...');
processJob();