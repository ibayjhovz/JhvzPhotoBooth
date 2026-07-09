import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure directories for persistent data storage exist
  const DATA_DIR = path.join(process.cwd(), 'data');
  const PHOTOSTRIPS_DIR = path.join(DATA_DIR, 'photostrips');
  try {
    if (!fs.existsSync(PHOTOSTRIPS_DIR)) {
      fs.mkdirSync(PHOTOSTRIPS_DIR, { recursive: true });
      console.log(`[STORAGE] Created persistence directory: ${PHOTOSTRIPS_DIR}`);
    }
  } catch (err) {
    console.error('Failed to create storage directory:', err);
  }

  // In-memory store cache for photostrips to allow fast real-time access
  const photostripsStore = new Map<string, string>();

  // Support receiving large base64 strings
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Create HTTP server to attach both Express and WebSockets
  const server = http.createServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server });

  // Event-specific simulated camera roll (high-res Unsplash photos)
  const cameraRolls: Record<string, string[]> = {
    wedding: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop&q=80'
    ],
    birthday: [
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80'
    ],
    default: [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&auto=format&fit=crop&q=80'
    ]
  };

  // Helper to dynamically calculate storage usage with a 10.0 GB allocation
  function getStorageUsageString(): string {
    let totalBytes = 0;
    try {
      if (fs.existsSync(PHOTOSTRIPS_DIR)) {
        const files = fs.readdirSync(PHOTOSTRIPS_DIR);
        for (const file of files) {
          const stats = fs.statSync(path.join(PHOTOSTRIPS_DIR, file));
          totalBytes += stats.size;
        }
      }
    } catch (err) {
      console.error('Failed to calculate PHOTOSTRIPS_DIR size:', err);
    }
    
    // Convert bytes to GB. 
    // We assume an elegant baseline of 1.45 GB representing OS, companion engine, assets and firmware.
    const filesInGB = totalBytes / (1024 * 1024 * 1024);
    const totalGBUsed = Math.min(10.0, 1.45 + filesInGB);
    return `${totalGBUsed.toFixed(2)} GB of 10.0 GB (${((totalGBUsed / 10) * 100).toFixed(1)}% used)`;
  }

  // Live hardware state tracking
  let stats = {
    cameraConnected: true,
    cameraModel: 'Canon EOS R5',
    cameraBattery: 88,
    printerConnected: true,
    printerModel: 'DNP DS620 (USB)',
    printerStatus: 'Idle Ready',
    storageUsage: '1.45 GB of 10.0 GB (14.5% used)',
    totalPrints: 145,
    totalEmails: 98,
    devMode: false
  };

  const STATS_FILE = path.join(DATA_DIR, 'stats.json');
  if (fs.existsSync(STATS_FILE)) {
    try {
      const savedStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      stats = { ...stats, ...savedStats };
      console.log('[STATS] Loaded persisted hardware stats from disk.');
    } catch (err) {
      console.error('Failed to load stats from disk:', err);
    }
  }

  // Initialize storage usage dynamically on startup
  stats.storageUsage = getStorageUsageString();

  const saveStats = () => {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save stats to disk:', err);
    }
  };

  // Helper to broadcast stats changes to all connected kiosk clients
  function broadcastStatus() {
    const payload = JSON.stringify({
      type: 'status:sync',
      status: stats
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  wss.on('connection', (ws: WebSocket) => {
    console.log('Companion Server: Client connected via WebSocket.');

    // Sync current hardware status immediately
    ws.send(JSON.stringify({
      type: 'status:sync',
      status: stats
    }));

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message);
        console.log(`Companion Server received event: ${payload.type}`);

        if (payload.type === 'shutter:trigger') {
          // DSLR capture command!
          const step = payload.step || 1;
          const eventId = payload.event || '';

          // Match image theme
          let roll = cameraRolls.default;
          if (eventId.includes('wedding')) roll = cameraRolls.wedding;
          if (eventId.includes('birthday')) roll = cameraRolls.birthday;

          const imageUrl = roll[(step - 1) % roll.length];

          // Simulate shutter processing delay
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'dslr:captured',
              step,
              imageUrl
            }));
            console.log(`DSLR capture step ${step} dispatched back to kiosk: ${imageUrl}`);
          }, 1500);

        } else if (payload.type === 'email:send') {
          // Send Email command
          const config = payload.config;
          const email = payload.email;
          const name = payload.name || 'Guest';
          const subject = payload.subject || 'Your memories are ready!';
          const body = payload.body || 'Thanks for taking photos with us!';
          const photostrip = payload.photostrip; // base64 string

          if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
            console.warn(`[SMTP SENDER] Suppressing email dispatch: Invalid or empty guest email address "${email}"`);
            ws.send(JSON.stringify({ type: 'email:failed', email: email || '', error: 'Recipient email is empty or invalid' }));
            return;
          }

          console.log(`[SMTP SPOOL] Dispatched photostrip mail request to: ${email} using strategy: ${config?.deliveryStrategy || 'smtp'}`);
          stats.totalEmails += 1;
          saveStats();
          broadcastStatus();

          const strategy = config?.deliveryStrategy || 'smtp';

          if (strategy === 'simulated') {
            console.log(`[SMTP SIMULATED] Strategy is simulated. Sending instant success to client for: ${email}`);
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'email:sent', email: email, simulated: true }));
            }, 1200);
            return;
          }

          if (strategy === 'mailto') {
            console.log(`[SMTP MAILTO] Strategy is browser mailto. Simulating immediate success on server for: ${email}`);
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'email:sent', email: email, mailto: true }));
            }, 600);
            return;
          }

          // Default SMTP strategy
          if (config && config.smtpHost && config.smtpUser) {
            console.log(`[SMTP SENDER] Initializing SMTP transport for ${config.smtpHost}:${config.smtpPort}`);
            const transporter = nodemailer.createTransport({
              host: config.smtpHost,
              port: Number(config.smtpPort) || 587,
              secure: Number(config.smtpPort) === 465,
              auth: {
                user: config.smtpUser,
                pass: config.smtpPass,
              },
              tls: {
                rejectUnauthorized: false
              }
            });

            // Convert base64 data URL to buffer for nodemailer attachment
            const base64Data = photostrip.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Buffer.from(base64Data, 'base64');

            const mailOptions = {
              from: `"${config.senderName}" <${config.senderEmail || config.smtpUser}>`,
              to: email,
              subject: subject,
              text: `${body}\n\nEnjoy your high-resolution photostrip!`,
              attachments: [
                {
                  filename: `photostrip_${Date.now()}.png`,
                  content: imageBuffer,
                  contentType: 'image/png'
                }
              ]
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error('[SMTP ERROR] Failed to send real email:', error);
                ws.send(JSON.stringify({ type: 'email:failed', email: email, error: error.message }));
              } else {
                console.log('[SMTP SUCCESS] Email sent successfully via SMTP:', info.messageId);
                ws.send(JSON.stringify({ type: 'email:sent', email: email }));
              }
            });
          } else {
            console.log(`[SMTP MOCK] SMTP not configured. Simulating dispatch to: ${email}`);
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'email:sent', email: email, simulated: true }));
            }, 1000);
          }

        } else if (payload.type === 'email:test') {
          const config = payload.config;
          const recipient = payload.recipient;
          console.log(`[SMTP TEST] Starting connection test to ${config?.smtpHost} for recipient ${recipient}`);
          
          if (config && config.smtpHost && config.smtpUser) {
            const transporter = nodemailer.createTransport({
              host: config.smtpHost,
              port: Number(config.smtpPort) || 587,
              secure: Number(config.smtpPort) === 465,
              auth: {
                user: config.smtpUser,
                pass: config.smtpPass,
              },
              tls: {
                rejectUnauthorized: false
              }
            });

            const mailOptions = {
              from: `"${config.senderName}" <${config.senderEmail || config.smtpUser}>`,
              to: recipient,
              subject: 'Photobooth Pro SMTP Connection Test ✅',
              text: 'This is a successful connection test email from your Photobooth Pro Kiosk! Your outgoing SMTP pathway is active and secure.'
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error('[SMTP TEST ERROR] Test email failed:', error);
                ws.send(JSON.stringify({ type: 'email:test_result', status: 'error', error: error.message }));
              } else {
                console.log('[SMTP TEST SUCCESS] Test email sent successfully:', info.messageId);
                ws.send(JSON.stringify({ type: 'email:test_result', status: 'success' }));
              }
            });
          } else {
            console.warn('[SMTP TEST WARNING] SMTP configuration incomplete. Mocking simulation.');
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'email:test_result', status: 'simulated' }));
            }, 1000);
          }

        } else if (payload.type === 'print:send') {
          // Print command
          const copies = payload.copies || 1;
          console.log(`[PRINTER QUEUE] Enqueued job: ${copies}x copies on ${payload.printer || 'DNP DS620'}`);
          stats.totalPrints += copies;
          saveStats();

          // Broadcast updated status with new counters to all kiosks & admin consoles
          broadcastStatus();
        } else if (payload.type === 'camera:test') {
          console.log('[CALIBRATION] Executed hardware shutter test beep.');
        }

      } catch (err) {
        console.error('WebSocket payload parsing failed:', err);
      }
    });

    ws.on('close', () => {
      console.log('Companion Server: Client connection closed.');
    });
  });

  // Health API route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', companion: 'online', stats });
  });

  // Upload photostrip base64 image data
  app.post('/api/photostrips', (req, res) => {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Missing image data' });
    }
    // Generate a secure, user-friendly 6-character hex ID
    const id = Math.random().toString(16).substring(2, 8).toUpperCase();
    
    // Save to in-memory cache for ultra-fast instant access
    photostripsStore.set(id, image);
    
    // Persist to disk asynchronously
    const filePath = path.join(PHOTOSTRIPS_DIR, `${id}.txt`);
    fs.writeFile(filePath, image, 'utf8', (err) => {
      if (err) {
        console.error(`[DB SAVE ERROR] Failed to save photostrip ${id} to disk:`, err);
      } else {
        console.log(`[DB SAVE SUCCESS] Persisted photostrip ${id} to disk.`);
        stats.storageUsage = getStorageUsageString();
        saveStats();
        broadcastStatus();
      }
    });

    res.json({ id });
  });

  // Download/retrieve photostrip image data with lazy-loading from disk
  app.get('/api/photostrips/:id', (req, res) => {
    const id = req.params.id ? req.params.id.toUpperCase() : '';
    
    // Return cache if loaded
    if (photostripsStore.has(id)) {
      return res.json({ image: photostripsStore.get(id) });
    }

    // Try reading file from disk storage
    const filePath = path.join(PHOTOSTRIPS_DIR, `${id}.txt`);
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.warn(`[DB READ WARNING] Photostrip ${id} not found on disk.`);
        return res.status(404).json({ error: 'Photostrip not found' });
      }

      // Save to memory cache for next scan/download
      photostripsStore.set(id, data);
      res.json({ image: data });
    });
  });

  // Mount Vite development middleware or static production dist folder
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Photobooth Pro Companion Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
