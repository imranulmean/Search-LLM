import { pipeline, env } from "@huggingface/transformers"; // Use the NEW package
import wavefile from 'wavefile';
import { exec } from 'child_process';

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';

// --- CRITICAL WINDOWS STABILITY SETTINGS ---
env.backends.onnx.wasm.simd = false; // Disable SIMD (fixes 'Illegal Instruction' crashes)
env.backends.onnx.wasm.numThreads = 1;
env.allowLocalModels = false;

dotenv.config();

const __dirname = path.resolve();
const app = express();
const server= http.createServer(app);


app.use(cors({
  origin: '*'
}));
app.use(express.json());
app.use(cookieParser());


const CONFIG = {
  ffmpeg: "G:/Node Projects/ffmpeg/ffmpeg-8.0.1-essentials_build/bin/ffmpeg.exe",
};

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/");
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname); // keep extension
//     cb(null, file.originalname + ext);
//   }
// });

// const upload = multer({ storage });

// app.post('/transcribe', upload.single('audio'), async (req, res) => {
//     try {
//       if (!req.file) return res.status(400).json({ error: "No audio file" });
  
//       const inputPath = path.resolve(req.file.path);
//       const outputPath = inputPath + "_fixed.wav";
  
//       console.log(`--- New Request: ${req.file.originalname} ---`);
  
//       // STEP 1: CONVERT TO WHISPER-READY WAV
//       // Forced 16kHz, Mono, PCM 16-bit
//       const ffmpegCmd = `"${CONFIG.ffmpeg}" -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}" -y`;
  
//       console.log("[1/2] Converting audio with FFmpeg...");
      
//       exec(ffmpegCmd, async (fErr) => {
//         if (fErr) {
//           console.error("FFmpeg Error:", fErr.message);
//           return res.status(500).json({ error: "Audio conversion failed" });
//         }
//         const transcribe=await runWishper(outputPath);        
//         fs.unlink(inputPath, () => {});
//         fs.unlink(outputPath, () => {});
//         res.json(transcribe);
//       });
  
//     } catch (err) {
//       console.error("Route Error:", err);
//       res.status(500).json({ error: "Internal Server Error" });
//     }
//   });

// async function runWishper(filepath) {
//     // const audioPath = "G:/Node Projects/Whisper CPP/Release/test.wav";
//     const audioPath = filepath;

//     console.log("🚀 Initializing Official Whisper Pipeline...");

//     try {
//         // We use 'q8' (8-bit quantization) to stay under the Windows 2GB memory limit
//         const transcriber = await pipeline(
//             'automatic-speech-recognition', 
//             'onnx-community/whisper-large-v3-turbo', 
//             { 
//                 dtype: 'q8', 
//                 device: 'cpu' 
//             }
//         );

//         console.log("✅ Model Ready. Reading Audio...");
//         if (!fs.existsSync(audioPath)) throw new Error("File not found!");

//         const buffer = fs.readFileSync(audioPath);
//         const wav = new wavefile.WaveFile(buffer);
//         wav.toBitDepth('32f'); 
//         wav.toSampleRate(16000);
//         let audioData = wav.getSamples();
//         if (Array.isArray(audioData)) audioData = audioData[0];

//         console.log("📝 Transcribing...");
//         const result = await transcriber(audioData);
//         console.log("\n--- RESULT ---\n" + JSON.stringify(result));    
//         console.log("\n--- RESULT ---\n" + result.text);
//         return result.text;

//     } catch (err) {
//         console.error("❌ CRASH PREVENTED:", err);
//     }
// }

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});


import { Server } from "socket.io";

const users = {};

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {

  users[socket.id] = socket.id;
	// 1. Send the connected user their unique ID
	socket.emit("me", socket.id);

  // 2. Send the updated user list to EVERYONE
  io.emit("updateUserList", Object.values(users));
  socket.on("disconnect", () => {
    delete users[socket.id]; // Remove user
    io.emit("updateUserList", Object.values(users)); // Update everyone
    socket.broadcast.emit("callEnded");
  });

	// 3. User A initiates a call to User B
	socket.on("callUser", (data) => {
		io.to(data.userToCall).emit("callUser", { 
            signal: data.signalData, 
            from: data.from, 
            name: data.name 
        });
	});

	// 4. User B answers the call from User A
	socket.on("answerCall", (data) => {
		io.to(data.to).emit("callAccepted", data.signal);
	});
});