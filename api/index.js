// import { pipeline, env } from "@huggingface/transformers"; 
// import wavefile from 'wavefile';
// import { exec } from 'child_process';

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';

import {StreamClient} from '@stream-io/node-sdk';

// --- CRITICAL WINDOWS STABILITY SETTINGS ---
// env.backends.onnx.wasm.simd = false; // Disable SIMD (fixes 'Illegal Instruction' crashes)
// env.backends.onnx.wasm.numThreads = 1;
// env.allowLocalModels = false;

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

///////////////////Stream IO Audio Video //////////////

// REPLACE THESE with your actual keys from GetStream Dashboard
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET; 

const client = new StreamClient(API_KEY, API_SECRET);

app.post('/get-token', (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        // validity_in_seconds: 3600 = 1 hour
        const token = client.generateUserToken({ 
            user_id: userId, 
            validity_in_seconds: 3600 
        });

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

////////////////////////////////////////////


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

const getPublicRoomUsers = () => {
  const clients = io.sockets.adapter.rooms.get("public_room");
  const roomUsers = {};
  if (clients) {
      clients.forEach((socketId) => {
          if (users[socketId]) {
              roomUsers[socketId] = users[socketId];
          }
      });
  }
  return roomUsers;
};

io.on("connection", (socket) => {
    const userId = socket.handshake.auth.username || socket.id;
    users[socket.id] = userId;

    socket.emit("me", socket.id);
    io.emit("updateUserList", users);

    // 2. User A calls User B
    socket.on("callUser", ({ userToCall, from, fromUserId,callId }) => {
        io.to(userToCall).emit("callUser", { 
            from: socket.id, // sending socketId so B knows where to reply
            fromUserId: fromUserId, // the string ID
            callId: callId 
        });
    });

    // 3. User B answers User A
    socket.on("answerCall", (data) => {
        io.to(data.to).emit("callAccepted");
    });

    /////////////////Chat Options ////////////
    socket.on('outgoing', (data)=>{
      io.to(data.fid).emit('incoming', data);
    });

    // --- PUBLIC ROOM LOGIC ---
        
    socket.on("join_public", () => {
      socket.join("public_room");
      
      // Notify everyone in the room to update their member list
      io.to("public_room").emit("update_room_users", getPublicRoomUsers());
      
      // Optional: Send a "User joined" message to the chat
      io.to("public_room").emit("receive_group_msg", {
          username: "System",
          text: `${userId} joined the lounge.`,
          isSystem: true
      });
    });

    socket.on("send_group_msg", (data) => {
      // Broadcast message to everyone in the public room
      io.to("public_room").emit("receive_group_msg", {
          username: data.username,
          text: data.text,
          id: socket.id
      });
    });    

    socket.on("disconnecting", () => {
      // Before the socket is fully gone, notify rooms it was in
      socket.rooms.forEach(room => {
          if (room === "public_room") {
              // We use a small timeout to let the socket finish leaving
              setTimeout(() => {
                  io.to("public_room").emit("update_room_users", getPublicRoomUsers());
              }, 100);
          }
      });
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("updateUserList", users);
    });
});

// io.on("connection", (socket) => {

//   const username = socket.handshake.auth.username;

//   users[socket.id] = socket.id;
//   // users[socket.id]={socketId: socket.id, username};
//   console.log(Object.values(users));
// 	// 1. Send the connected user their unique ID
// 	socket.emit("me", socket.id);

//   // 2. Send the updated user list to EVERYONE
//   io.emit("updateUserList", Object.values(users));

//   socket.on("disconnect", () => {
//     delete users[socket.id]; // Remove user
//     io.emit("updateUserList", Object.values(users)); // Update everyone
//     socket.broadcast.emit("callEnded");
//   });

// 	// 3. User A initiates a call to User B
// 	socket.on("callUser", (data) => {
// 		io.to(data.userToCall).emit("callUser", { 
//             signal: data.signalData, 
//             from: data.from, 
//             name: data.name 
//         });
// 	});

// 	// 4. User B answers the call from User A
// 	socket.on("answerCall", (data) => {
// 		io.to(data.to).emit("callAccepted", data.signal);
// 	});

//   /////////////////Chat Options ////////////
//   socket.on('outgoing', (data)=>{
//     io.to(data.fid).emit('incoming', data);
//   })

// });